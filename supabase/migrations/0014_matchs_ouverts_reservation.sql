-- Billetterie : le comité choisit les matchs ouverts à la réservation (par exemple la 1re journée).
-- Par défaut un match est fermé ; on l'ouvre depuis l'admin (Billetterie → Matchs ouverts).

alter table matchs add column if not exists reservation_ouverte boolean not null default false;

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
  where cb.en_vente and m.reservation_ouverte and m.statut in ('programmé', 'en cours');
$$;

-- La réservation vérifie aussi que le match est ouvert.
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

-- Enregistre la liste des matchs ouverts (billetterie et administrateurs).
create or replace function definir_matchs_reservables(p_ids uuid[])
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not prive.a_le_role('{billetterie}') then raise exception 'accès refusé'; end if;
  update matchs set reservation_ouverte = (id = any(coalesce(p_ids, '{}')))
  where reservation_ouverte is distinct from (id = any(coalesce(p_ids, '{}')));
  select count(*) into n from matchs where reservation_ouverte;
  return n;
end;
$$;
revoke execute on function definir_matchs_reservables(uuid[]) from public, anon;
grant execute on function definir_matchs_reservables(uuid[]) to authenticated;
