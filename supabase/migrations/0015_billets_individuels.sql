-- Billetterie : un QR code par billet.
-- Une réservation de plusieurs places donne autant de billets, chacun avec son propre code secret,
-- partageable séparément. À l'entrée, chaque billet est scanné, payé et validé un par un : il ne
-- laisse entrer qu'une personne, une seule fois.
-- La commande garde le total et le nombre d'entrées (mis à jour à chaque billet) pour l'admin.

create table if not exists billets (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references commandes(id) on delete cascade,
  numero int not null check (numero >= 1),
  jeton text not null unique default replace(gen_random_uuid()::text, '-', ''),
  paye_le timestamptz,
  encaisse_par uuid references auth.users(id) on delete set null,
  utilise_le timestamptz,
  unique (commande_id, numero)
);
alter table billets enable row level security;
create policy "billets lus par billetterie" on billets for select using (prive.a_le_role('{billetterie}'));

-- Réservations déjà faites : un billet par place, en reprenant paiement et entrées.
insert into billets (commande_id, numero, paye_le, utilise_le)
select c.id, n,
  case when c.statut = 'payée' then coalesce(c.paye_le, c.cree_le) end,
  case when n <= c.entrees_validees then coalesce(c.derniere_entree, c.cree_le) end
from commandes c cross join generate_series(1, c.quantite) n
where not exists (select 1 from billets b where b.commande_id = c.id);

-- ---------------------------------------------------------------------------
-- Réservation : crée la commande et ses billets
-- ---------------------------------------------------------------------------
create or replace function reserver_billet(p_match uuid, p_categorie uuid, p_quantite int, p_nom text, p_telephone text)
returns table (reference text, jeton text)
language plpgsql security definer set search_path = public
as $$
declare
  cat categories_billet;
  m matchs;
  tel text := regexp_replace(coalesce(p_telephone, ''), '[\s.\-]', '', 'g');
  nom text := left(trim(coalesce(p_nom, '')), 80);
  libres int;
  ref text;
  j text;
  cid uuid;
begin
  if length(nom) < 2 then raise exception 'Indiquez votre nom.'; end if;
  if tel !~ '^\+?\d{8,15}$' then raise exception 'Numéro de téléphone invalide. Exemple : 07 00 00 00 00.'; end if;
  if p_quantite is null or p_quantite < 1 or p_quantite > 10 then raise exception 'Choisissez entre 1 et 10 billets.'; end if;
  select * into cat from categories_billet where id = p_categorie for update;
  if not found or not cat.en_vente then raise exception 'Cette catégorie n''est pas en vente.'; end if;
  select * into m from matchs where id = p_match;
  if not found or not m.reservation_ouverte or m.statut not in ('programmé', 'en cours') then raise exception 'Ce match n''est plus ouvert à la réservation.'; end if;
  if (select count(*) from commandes co where co.match_id = p_match and co.telephone = tel and co.statut = 'en attente') >= 3 then
    raise exception 'Vous avez déjà 3 réservations pour ce match avec ce numéro.';
  end if;
  libres := cat.places_par_match - coalesce((
    select sum(co.quantite) from commandes co
    where co.match_id = p_match and co.categorie_id = p_categorie and co.statut in ('payée', 'en attente')
  ), 0);
  if libres < p_quantite then
    raise exception '%', case when libres <= 0 then 'Plus de place dans cette catégorie pour ce match.'
      else format('Il ne reste que %s place(s) dans cette catégorie pour ce match.', libres) end;
  end if;
  loop
    ref := 'BDC-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from commandes co where co.reference = ref);
  end loop;
  j := replace(gen_random_uuid()::text, '-', '');
  insert into commandes (reference, jeton, match_id, categorie_id, quantite, prix_unitaire_fcfa, total_fcfa, nom_acheteur, telephone, moyen_paiement, statut)
  values (ref, j, p_match, p_categorie, p_quantite, cat.prix_fcfa, cat.prix_fcfa * p_quantite, nom, tel, 'sur place', 'en attente')
  returning id into cid;
  insert into billets (commande_id, numero) select cid, n from generate_series(1, p_quantite) n;
  return query select ref, j;
end;
$$;

-- ---------------------------------------------------------------------------
-- Page du billet : le lien de la réservation montre tous ses billets ; le lien d'un billet
-- (celui qu'on partage) ne montre que lui.
-- ---------------------------------------------------------------------------
create or replace function billets_par_jeton(p_jeton text)
returns table (groupe boolean, reference text, numero int, quantite int, jeton text, statut text,
  prix_unitaire_fcfa int, nom_acheteur text, categorie text, date_heure timestamptz, terrain text, phase text,
  domicile text, exterieur text, utilise_le timestamptz)
language sql stable security definer set search_path = public
as $$
  select co.jeton = p_jeton, co.reference, b.numero, co.quantite, b.jeton,
    case when co.statut in ('annulée', 'échouée') then 'annulé' when b.utilise_le is not null then 'utilisé'
      when b.paye_le is not null then 'payé' else 'à payer' end,
    co.prix_unitaire_fcfa, co.nom_acheteur, cb.nom, m.date_heure, m.terrain, m.phase, cd.nom, ce.nom, b.utilise_le
  from billets b
  join commandes co on co.id = b.commande_id
  join categories_billet cb on cb.id = co.categorie_id
  join matchs m on m.id = co.match_id
  left join clubs cd on cd.id = m.club_domicile
  left join clubs ce on ce.id = m.club_exterieur
  where co.jeton = p_jeton or b.jeton = p_jeton
  order by b.numero;
$$;
revoke execute on function billets_par_jeton(text) from public;
grant execute on function billets_par_jeton(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contrôle à l'entrée, billet par billet (billetterie et administrateurs)
-- ---------------------------------------------------------------------------
-- Retrouve un billet : jeton du QR code, ou référence tapée (BDC-XXXXXX-2 ; sans numéro si la
-- réservation n'a qu'un billet).
create or replace function prive.trouver_billet(p_code text)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  code text := upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));
  ref text;
  num int;
  bid uuid;
  q int;
begin
  select b.id into bid from billets b where b.jeton = lower(code);
  if found then return bid; end if;
  ref := substring(code from '^(BDC-[A-Z0-9]{6})');
  if ref is null then return null; end if;
  num := nullif(substring(code from '^BDC-[A-Z0-9]{6}-(\d{1,2})$'), '')::int;
  select co.quantite into q from commandes co where co.reference = ref;
  if not found then return null; end if;
  if num is null then
    if q > 1 then raise exception 'Cette réservation a % billets : tapez le numéro du billet, par exemple %-1.', q, ref; end if;
    num := 1;
  end if;
  select b.id into bid from billets b join commandes co on co.id = b.commande_id where co.reference = ref and b.numero = num;
  return bid;
end;
$$;

create or replace function controle_billet_unique(p_code text)
returns table (jeton text, reference text, numero int, quantite int, statut text, prix_unitaire_fcfa int, nom_acheteur text,
  telephone text, categorie text, date_heure timestamptz, terrain text, domicile text, exterieur text,
  utilise_le timestamptz, entrees_commande int)
language plpgsql stable security definer set search_path = public
as $$
declare bid uuid;
begin
  if not prive.a_le_role('{billetterie}') then raise exception 'accès refusé'; end if;
  bid := prive.trouver_billet(p_code);
  return query
    select b.jeton, co.reference, b.numero, co.quantite,
      case when co.statut in ('annulée', 'échouée') then 'annulé' when b.utilise_le is not null then 'utilisé'
        when b.paye_le is not null then 'payé' else 'à payer' end,
      co.prix_unitaire_fcfa, co.nom_acheteur, co.telephone, cb.nom, m.date_heure, m.terrain, cd.nom, ce.nom,
      b.utilise_le, co.entrees_validees
    from billets b
    join commandes co on co.id = b.commande_id
    join categories_billet cb on cb.id = co.categorie_id
    join matchs m on m.id = co.match_id
    left join clubs cd on cd.id = m.club_domicile
    left join clubs ce on ce.id = m.club_exterieur
    where b.id = bid;
end;
$$;
revoke execute on function controle_billet_unique(text) from public, anon;
grant execute on function controle_billet_unique(text) to authenticated;

-- Encaisse (si besoin) et valide UN billet, de façon atomique : un billet ne fait entrer qu'une fois.
create or replace function entrer_billet(p_jeton text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b billets;
  c commandes;
begin
  if not prive.a_le_role('{billetterie}') then raise exception 'accès refusé'; end if;
  select * into b from billets bi where bi.jeton = lower(trim(coalesce(p_jeton, ''))) for update;
  if not found then raise exception 'Billet inconnu.'; end if;
  select * into c from commandes co where co.id = b.commande_id for update;
  if c.statut in ('annulée', 'échouée') then raise exception 'Ce billet est annulé : refuser l''entrée.'; end if;
  if b.utilise_le is not null then raise exception 'Billet déjà utilisé : refuser l''entrée.'; end if;
  update billets bi set paye_le = coalesce(b.paye_le, now()), encaisse_par = coalesce(b.encaisse_par, auth.uid()), utilise_le = now()
  where bi.id = b.id;
  -- Totaux de la réservation : payée quand tous ses billets le sont.
  update commandes co set
    entrees_validees = (select count(*) from billets x where x.commande_id = c.id and x.utilise_le is not null),
    derniere_entree = now(),
    paye_le = coalesce(c.paye_le, now()),
    encaisse_par = coalesce(c.encaisse_par, auth.uid()),
    statut = case when not exists (select 1 from billets x where x.commande_id = c.id and x.paye_le is null) then 'payée'::statut_commande else c.statut end
  where co.id = c.id;
end;
$$;
revoke execute on function entrer_billet(text) from public, anon;
grant execute on function entrer_billet(text) to authenticated;

-- Annule une réservation dont aucun billet n'a encore été payé (libère ses places).
create or replace function annuler_reservation_billet(p_jeton text)
returns void
language plpgsql security definer set search_path = public
as $$
declare cid uuid;
begin
  if not prive.a_le_role('{billetterie}') then raise exception 'accès refusé'; end if;
  select b.commande_id into cid from billets b where b.jeton = lower(trim(coalesce(p_jeton, '')));
  if not found then raise exception 'Billet inconnu.'; end if;
  perform 1 from commandes co where co.id = cid for update;
  if exists (select 1 from billets b where b.commande_id = cid and b.paye_le is not null) then
    raise exception 'Un billet de cette réservation est déjà payé : elle ne peut plus être annulée.';
  end if;
  update commandes co set statut = 'annulée' where co.id = cid and co.statut = 'en attente';
end;
$$;
revoke execute on function annuler_reservation_billet(text) from public, anon;
grant execute on function annuler_reservation_billet(text) to authenticated;
