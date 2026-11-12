-- Réservation des billets sur le site, paiement sur place.
-- Le supporter réserve en ligne (sans payer) et reçoit un billet avec QR code. À l'entrée du terrain,
-- l'équipe de la billetterie scanne le QR code, encaisse et fait entrer.
-- Une réservation « en attente » (non payée) bloque ses places jusqu'au match, comme avant.

alter table commandes
  add column if not exists jeton text unique,
  add column if not exists paye_le timestamptz,
  add column if not exists encaisse_par uuid references auth.users(id) on delete set null,
  add column if not exists derniere_entree timestamptz;

update commandes set jeton = replace(gen_random_uuid()::text, '-', '') where jeton is null;
alter table commandes alter column jeton set default replace(gen_random_uuid()::text, '-', '');
alter table commandes alter column jeton set not null;
create index if not exists commandes_telephone_idx on commandes (telephone);

-- valider_entree (0001) reste en place mais n'est plus utilisé : le site passe par
-- controle_billet + enregistrer_entree, qui acceptent les billets à payer sur place.

-- ---------------------------------------------------------------------------
-- Places restantes de tous les matchs à venir, pour le formulaire de réservation
-- ---------------------------------------------------------------------------
create or replace function places_matchs_a_venir()
returns table (match_id uuid, categorie_id uuid, restantes int)
language sql stable security definer set search_path = public
as $$
  select m.id, cb.id,
    (cb.places_par_match - coalesce((
      select sum(co.quantite) from commandes co
      where co.match_id = m.id and co.categorie_id = cb.id and co.statut in ('payée', 'en attente')
    ), 0))::int
  from matchs m cross join categories_billet cb
  where cb.en_vente and m.statut in ('programmé', 'en cours');
$$;
grant execute on function places_matchs_a_venir() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Réservation (ouverte à tous, sans compte)
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
begin
  if length(nom) < 2 then raise exception 'Indiquez votre nom.'; end if;
  if tel !~ '^\+?\d{8,15}$' then raise exception 'Numéro de téléphone invalide. Exemple : 07 00 00 00 00.'; end if;
  if p_quantite is null or p_quantite < 1 or p_quantite > 10 then raise exception 'Choisissez entre 1 et 10 billets.'; end if;

  -- Verrou sur la catégorie : deux réservations simultanées ne peuvent pas dépasser la jauge.
  select * into cat from categories_billet where id = p_categorie for update;
  if not found or not cat.en_vente then raise exception 'Cette catégorie n''est pas en vente.'; end if;
  select * into m from matchs where id = p_match;
  if not found or m.statut not in ('programmé', 'en cours') then raise exception 'Ce match n''est plus ouvert à la réservation.'; end if;

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

  -- Référence courte à lire à voix haute (sans 0/O ni 1/I), jeton long et secret dans le QR code.
  loop
    ref := 'BDC-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from commandes co where co.reference = ref);
  end loop;
  j := replace(gen_random_uuid()::text, '-', '');

  insert into commandes (reference, jeton, match_id, categorie_id, quantite, prix_unitaire_fcfa, total_fcfa, nom_acheteur, telephone, moyen_paiement, statut)
  values (ref, j, p_match, p_categorie, p_quantite, cat.prix_fcfa, cat.prix_fcfa * p_quantite, nom, tel, 'sur place', 'en attente');

  return query select ref, j;
end;
$$;
revoke execute on function reserver_billet(uuid, uuid, int, text, text) from public;
grant execute on function reserver_billet(uuid, uuid, int, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Billet du supporter, lu avec son jeton secret (lien du QR code)
-- ---------------------------------------------------------------------------
create or replace function billet_par_jeton(p_jeton text)
returns table (reference text, statut statut_commande, quantite int, entrees_validees int, prix_unitaire_fcfa int, total_fcfa int,
  nom_acheteur text, categorie text, date_heure timestamptz, terrain text, phase text, domicile text, exterieur text, cree_le timestamptz)
language sql stable security definer set search_path = public
as $$
  select co.reference, co.statut, co.quantite, co.entrees_validees, co.prix_unitaire_fcfa, co.total_fcfa,
    co.nom_acheteur, cb.nom, m.date_heure, m.terrain, m.phase, cd.nom, ce.nom, co.cree_le
  from commandes co
  join categories_billet cb on cb.id = co.categorie_id
  join matchs m on m.id = co.match_id
  left join clubs cd on cd.id = m.club_domicile
  left join clubs ce on ce.id = m.club_exterieur
  where co.jeton = p_jeton;
$$;
revoke execute on function billet_par_jeton(text) from public;
grant execute on function billet_par_jeton(text) to anon, authenticated;

-- Billet perdu : la référence et le numéro de téléphone de la réservation redonnent le lien.
create or replace function retrouver_billet(p_reference text, p_telephone text)
returns text
language sql stable security definer set search_path = public
as $$
  select co.jeton from commandes co
  where co.reference = upper(trim(p_reference))
    and right(regexp_replace(co.telephone, '\D', '', 'g'), 8) = right(regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g'), 8)
    and length(regexp_replace(coalesce(p_telephone, ''), '\D', '', 'g')) >= 8;
$$;
revoke execute on function retrouver_billet(text, text) from public;
grant execute on function retrouver_billet(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contrôle à l'entrée (billetterie et administrateurs)
-- ---------------------------------------------------------------------------
-- Lit un billet à partir du QR code (jeton) ou de la référence tapée à la main, sans rien modifier.
create or replace function controle_billet(p_code text)
returns table (reference text, statut statut_commande, quantite int, entrees_validees int, total_fcfa int, nom_acheteur text,
  telephone text, categorie text, date_heure timestamptz, terrain text, domicile text, exterieur text, paye_le timestamptz, derniere_entree timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare code text := trim(coalesce(p_code, ''));
begin
  if not prive.a_le_role('{billetterie}') then raise exception 'accès refusé'; end if;
  return query
    select co.reference, co.statut, co.quantite, co.entrees_validees, co.total_fcfa, co.nom_acheteur, co.telephone,
      cb.nom, m.date_heure, m.terrain, cd.nom, ce.nom, co.paye_le, co.derniere_entree
    from commandes co
    join categories_billet cb on cb.id = co.categorie_id
    join matchs m on m.id = co.match_id
    left join clubs cd on cd.id = m.club_domicile
    left join clubs ce on ce.id = m.club_exterieur
    where co.jeton = lower(code) or co.reference = upper(code);
end;
$$;
revoke execute on function controle_billet(text) from public, anon;
grant execute on function controle_billet(text) to authenticated;

-- Encaisse (si ce n'est pas déjà fait) et fait entrer p_nombre personnes, de façon atomique :
-- deux contrôleurs qui scannent le même billet en même temps ne peuvent pas dépasser la quantité.
create or replace function enregistrer_entree(p_reference text, p_nombre int)
returns table (statut statut_commande, entrees_validees int, quantite int)
language plpgsql security definer set search_path = public
as $$
declare c commandes;
begin
  if not prive.a_le_role('{billetterie}') then raise exception 'accès refusé'; end if;
  select * into c from commandes co where co.reference = upper(trim(p_reference)) for update;
  if not found then raise exception 'Billet inconnu.'; end if;
  if c.statut in ('annulée', 'échouée') then raise exception 'Ce billet est annulé : refuser l''entrée.'; end if;
  if p_nombre is null or p_nombre < 1 then raise exception 'Nombre de personnes invalide.'; end if;
  if c.entrees_validees + p_nombre > c.quantite then
    raise exception '%', case when c.entrees_validees >= c.quantite then 'Billet déjà utilisé : toutes les entrées ont été faites.'
      else format('Il ne reste que %s entrée(s) sur ce billet.', c.quantite - c.entrees_validees) end;
  end if;
  update commandes co set
    statut = 'payée',
    paye_le = coalesce(c.paye_le, now()),
    encaisse_par = coalesce(c.encaisse_par, auth.uid()),
    entrees_validees = c.entrees_validees + p_nombre,
    derniere_entree = now()
  where co.id = c.id;
  return query select 'payée'::statut_commande, c.entrees_validees + p_nombre, c.quantite;
end;
$$;
revoke execute on function enregistrer_entree(text, int) from public, anon;
grant execute on function enregistrer_entree(text, int) to authenticated;

-- Annule une réservation non payée (libère ses places).
create or replace function annuler_reservation(p_reference text)
returns void
language plpgsql security definer set search_path = public
as $$
declare c commandes;
begin
  if not prive.a_le_role('{billetterie}') then raise exception 'accès refusé'; end if;
  select * into c from commandes co where co.reference = upper(trim(p_reference)) for update;
  if not found then raise exception 'Billet inconnu.'; end if;
  if c.statut <> 'en attente' then raise exception 'Seule une réservation non payée peut être annulée.'; end if;
  update commandes co set statut = 'annulée' where co.id = c.id;
end;
$$;
revoke execute on function annuler_reservation(text) from public, anon;
grant execute on function annuler_reservation(text) to authenticated;
