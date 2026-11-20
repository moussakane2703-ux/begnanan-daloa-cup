-- Billetterie : paiement en ligne avec Wave Business, au moment de la réservation.
--
-- Le site crée la réservation (« en attente », moyen « wave »), ouvre une session de paiement Wave
-- et envoie le supporter sur Wave. Les billets ne deviennent valables (QR code affiché, entrée
-- possible) qu'une fois le paiement confirmé par Wave : webhook, ou vérification par le site au
-- retour du supporter. La clé API Wave reste sur le serveur (Vercel) : la base ne la voit jamais.
--
-- Une réservation Wave non payée garde ses places le temps de la session Wave (30 minutes), plus
-- 5 minutes de marge, puis les libère. Les réservations « payer sur place » ne changent pas.
-- Les fonctions de paiement ne sont appelables qu'avec la clé de service (serveur du site).

alter table commandes
  add column if not exists wave_session_id text unique,
  add column if not exists wave_lien text,
  add column if not exists wave_expire_le timestamptz;

-- ---------------------------------------------------------------------------
-- Places tenues par une réservation
-- ---------------------------------------------------------------------------
create or replace function prive.tient_places(p_statut statut_commande, p_moyen text, p_expire timestamptz)
returns boolean
language sql stable set search_path = public
as $$
  select p_statut = 'payée'
    or (p_statut = 'en attente' and (p_moyen is distinct from 'wave' or coalesce(p_expire, now()) > now() - interval '5 minutes'));
$$;

create or replace function prive.places_libres(p_match uuid, p_categorie uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select (cb.places_par_match - coalesce((
    select sum(co.quantite) from commandes co
    where co.match_id = p_match and co.categorie_id = p_categorie
      and prive.tient_places(co.statut, co.moyen_paiement, co.wave_expire_le)
  ), 0))::int
  from categories_billet cb where cb.id = p_categorie;
$$;

create or replace function places_matchs_a_venir()
returns table (match_id uuid, categorie_id uuid, restantes int)
language sql stable security definer set search_path = public
as $$
  select m.id, cb.id, prive.places_libres(m.id, cb.id)
  from matchs m cross join categories_billet cb
  where cb.en_vente and m.reservation_ouverte and m.statut in ('programmé', 'en cours');
$$;

-- ---------------------------------------------------------------------------
-- Réservation (commune aux deux moyens de paiement)
-- ---------------------------------------------------------------------------
create or replace function prive.creer_reservation(p_match uuid, p_categorie uuid, p_quantite int, p_nom text, p_telephone text, p_moyen text)
returns commandes
language plpgsql security definer set search_path = public
as $$
declare
  cat categories_billet;
  m matchs;
  tel text := regexp_replace(coalesce(p_telephone, ''), '[\s.\-]', '', 'g');
  nom text := left(trim(coalesce(p_nom, '')), 80);
  libres int;
  ref text;
  c commandes;
begin
  if length(nom) < 2 then raise exception 'Indiquez votre nom.'; end if;
  if tel !~ '^\+?\d{8,15}$' then raise exception 'Numéro de téléphone invalide. Exemple : 07 00 00 00 00.'; end if;
  if p_quantite is null or p_quantite < 1 or p_quantite > 10 then raise exception 'Choisissez entre 1 et 10 billets.'; end if;
  -- Verrou sur la catégorie : deux réservations simultanées ne peuvent pas dépasser la jauge.
  select * into cat from categories_billet where id = p_categorie for update;
  if not found or not cat.en_vente then raise exception 'Cette catégorie n''est pas en vente.'; end if;
  select * into m from matchs where id = p_match;
  if not found or not m.reservation_ouverte or m.statut not in ('programmé', 'en cours') then raise exception 'Ce match n''est plus ouvert à la réservation.'; end if;

  -- Paiements Wave abandonnés : la session a expiré, la réservation n'a pas abouti.
  update commandes co set statut = 'échouée'
  where co.match_id = p_match and co.moyen_paiement = 'wave' and co.statut = 'en attente'
    and co.wave_expire_le < now() - interval '5 minutes';

  if (select count(*) from commandes co where co.match_id = p_match and co.telephone = tel and co.statut = 'en attente') >= 3 then
    raise exception 'Vous avez déjà 3 réservations non payées pour ce match avec ce numéro.';
  end if;
  libres := prive.places_libres(p_match, p_categorie);
  if libres < p_quantite then
    raise exception '%', case when libres <= 0 then 'Plus de place dans cette catégorie pour ce match.'
      else format('Il ne reste que %s place(s) dans cette catégorie pour ce match.', libres) end;
  end if;
  -- Référence courte à lire à voix haute (sans 0/O ni 1/I), jeton long et secret dans le lien.
  loop
    ref := 'BDC-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from commandes co where co.reference = ref);
  end loop;
  insert into commandes (reference, jeton, match_id, categorie_id, quantite, prix_unitaire_fcfa, total_fcfa, nom_acheteur, telephone,
    moyen_paiement, statut, wave_expire_le)
  values (ref, replace(gen_random_uuid()::text, '-', ''), p_match, p_categorie, p_quantite, cat.prix_fcfa, cat.prix_fcfa * p_quantite, nom, tel,
    p_moyen, 'en attente', case when p_moyen = 'wave' then now() + interval '35 minutes' end)
  returning * into c;
  insert into billets (commande_id, numero) select c.id, n from generate_series(1, p_quantite) n;
  return c;
end;
$$;

-- Payer sur place : inchangé pour le supporter.
create or replace function reserver_billet(p_match uuid, p_categorie uuid, p_quantite int, p_nom text, p_telephone text)
returns table (reference text, jeton text)
language plpgsql security definer set search_path = public
as $$
declare c commandes;
begin
  c := prive.creer_reservation(p_match, p_categorie, p_quantite, p_nom, p_telephone, 'sur place');
  return query select c.reference, c.jeton;
end;
$$;

-- Paiement Wave : appelée par le serveur du site, qui ouvre ensuite la session Wave.
create or replace function reserver_billet_wave(p_match uuid, p_categorie uuid, p_quantite int, p_nom text, p_telephone text)
returns table (reference text, jeton text, total_fcfa int)
language plpgsql security definer set search_path = public
as $$
declare c commandes;
begin
  c := prive.creer_reservation(p_match, p_categorie, p_quantite, p_nom, p_telephone, 'wave');
  return query select c.reference, c.jeton, c.total_fcfa;
end;
$$;
revoke execute on function reserver_billet_wave(uuid, uuid, int, text, text) from public, anon, authenticated;
grant execute on function reserver_billet_wave(uuid, uuid, int, text, text) to service_role;

-- La session Wave est ouverte : on garde son identifiant, son lien de paiement et son expiration.
create or replace function enregistrer_session_wave(p_reference text, p_session text, p_lien text, p_expire timestamptz)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update commandes co set wave_session_id = p_session, wave_lien = p_lien, wave_expire_le = coalesce(p_expire, co.wave_expire_le)
  where co.reference = p_reference and co.moyen_paiement = 'wave' and co.statut = 'en attente';
  if not found then raise exception 'Réservation Wave introuvable.'; end if;
end;
$$;
revoke execute on function enregistrer_session_wave(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function enregistrer_session_wave(text, text, text, timestamptz) to service_role;

-- La session Wave n'a pas pu être ouverte : la réservation n'aboutit pas, les places sont libérées.
create or replace function abandonner_reservation_wave(p_reference text)
returns void
language sql security definer set search_path = public
as $$
  update commandes set statut = 'échouée'
  where reference = p_reference and moyen_paiement = 'wave' and statut = 'en attente';
$$;
revoke execute on function abandonner_reservation_wave(text) from public, anon, authenticated;
grant execute on function abandonner_reservation_wave(text) to service_role;

-- Paiement confirmé par Wave (webhook ou vérification au retour). Sans effet s'il est déjà enregistré.
-- Un paiement reçu juste après l'expiration est quand même accepté : l'argent est encaissé.
create or replace function confirmer_paiement_wave(p_session text, p_transaction text, p_montant int)
returns text
language plpgsql security definer set search_path = public
as $$
declare c commandes;
begin
  select * into c from commandes co where co.wave_session_id = p_session for update;
  if not found then raise exception 'Session Wave inconnue : %', p_session; end if;
  if c.statut = 'payée' then return c.reference; end if;
  if p_montant is distinct from c.total_fcfa then
    raise exception 'Montant Wave (%) différent du total de la réservation % (%).', p_montant, c.reference, c.total_fcfa;
  end if;
  update commandes co set statut = 'payée', paye_le = now(), transaction_id = coalesce(p_transaction, co.transaction_id)
  where co.id = c.id;
  update billets b set paye_le = coalesce(b.paye_le, now()) where b.commande_id = c.id;
  return c.reference;
end;
$$;
revoke execute on function confirmer_paiement_wave(text, text, int) from public, anon, authenticated;
grant execute on function confirmer_paiement_wave(text, text, int) to service_role;

-- Réservation Wave encore à vérifier auprès de Wave (page du billet, au retour du supporter).
create or replace function session_wave_par_jeton(p_jeton text)
returns text
language sql stable security definer set search_path = public
as $$
  select co.wave_session_id from commandes co
  left join billets b on b.commande_id = co.id and b.jeton = p_jeton
  where (co.jeton = p_jeton or b.jeton = p_jeton)
    and co.moyen_paiement = 'wave' and co.statut in ('en attente', 'échouée') and co.wave_session_id is not null
  limit 1;
$$;
revoke execute on function session_wave_par_jeton(text) from public, anon, authenticated;
grant execute on function session_wave_par_jeton(text) to service_role;

-- ---------------------------------------------------------------------------
-- Statut d'un billet : « paiement en attente » tant que Wave n'a pas confirmé
-- ---------------------------------------------------------------------------
create or replace function prive.statut_billet(c commandes, b billets)
returns text
language sql stable set search_path = public
as $$
  select case
    when c.statut in ('annulée', 'échouée') then 'annulé'
    when b.utilise_le is not null then 'utilisé'
    when b.paye_le is not null then 'payé'
    when c.moyen_paiement = 'wave' then
      case when coalesce(c.wave_expire_le, now()) > now() then 'paiement en attente' else 'annulé' end
    else 'à payer' end;
$$;

drop function if exists billets_par_jeton(text);
create function billets_par_jeton(p_jeton text)
returns table (groupe boolean, reference text, numero int, quantite int, jeton text, statut text,
  prix_unitaire_fcfa int, nom_acheteur text, categorie text, date_heure timestamptz, terrain text, phase text,
  domicile text, exterieur text, utilise_le timestamptz, moyen_paiement text, wave_lien text)
language sql stable security definer set search_path = public
as $$
  select co.jeton = p_jeton, co.reference, b.numero, co.quantite, b.jeton, prive.statut_billet(co, b),
    co.prix_unitaire_fcfa, co.nom_acheteur, cb.nom, m.date_heure, m.terrain, m.phase, cd.nom, ce.nom, b.utilise_le,
    co.moyen_paiement,
    case when co.statut = 'en attente' and co.wave_expire_le > now() then co.wave_lien end
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
    select b.jeton, co.reference, b.numero, co.quantite, prive.statut_billet(co, b),
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

-- Entrée : un billet Wave non payé ne fait pas entrer (on n'encaisse pas à la place de Wave).
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
  if c.moyen_paiement = 'wave' and b.paye_le is null then
    raise exception 'Paiement Wave non confirmé : refuser l''entrée.';
  end if;
  update billets bi set paye_le = coalesce(b.paye_le, now()), encaisse_par = coalesce(b.encaisse_par, auth.uid()), utilise_le = now()
  where bi.id = b.id;
  update commandes co set
    entrees_validees = (select count(*) from billets x where x.commande_id = c.id and x.utilise_le is not null),
    derniere_entree = now(),
    paye_le = coalesce(c.paye_le, now()),
    encaisse_par = case when c.moyen_paiement = 'wave' then c.encaisse_par else coalesce(c.encaisse_par, auth.uid()) end,
    statut = case when not exists (select 1 from billets x where x.commande_id = c.id and x.paye_le is null) then 'payée'::statut_commande else c.statut end
  where co.id = c.id;
end;
$$;

-- Une réservation payée par Wave ne s'annule pas depuis le scanner (il faudrait rembourser).
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
