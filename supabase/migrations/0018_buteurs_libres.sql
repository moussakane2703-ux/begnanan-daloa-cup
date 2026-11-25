-- Buteurs saisis librement : un nom écrit à la main quand le joueur n'est pas inscrit,
-- et des buteurs ajoutés après le match (même validé) sans toucher au score.
-- À exécuter après 0016 ; peut être rejoué sans risque.
--
-- Règles :
--  * match programmé ou en cours : chaque but ajouté ou retiré recalcule le score (comme avant) ;
--  * match terminé (validé ou non) : le score ne bouge plus. On complète seulement les noms,
--    sans dépasser le score de l'équipe (pas de but compté deux fois). Le score se corrige dans « Clubs et matchs » ;
--  * le nom d'un but déjà saisi (« joueur non précisé ») peut être complété ou corrigé.

create or replace function prive.evenement_match()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  m matchs;
  id_match uuid := coalesce(new.match_id, old.match_id);
  termine boolean;
  score int;
begin
  select * into m from matchs where id = id_match for update;
  termine := m.statut = 'terminé' or m.resultat_valide;
  if tg_op = 'INSERT' then
    if m.statut in ('annulé', 'reporté') then
      raise exception 'Ce match n''a pas été joué.';
    end if;
    if new.club_id not in (m.club_domicile, m.club_exterieur) then
      raise exception 'Cette équipe ne joue pas ce match.';
    end if;
    if new.joueur_id is not null and not exists (select 1 from joueurs where id = new.joueur_id and club_id = case when new.type = 'csc' then (case when new.club_id = m.club_domicile then m.club_exterieur else m.club_domicile end) else new.club_id end) then
      raise exception 'Ce joueur n''appartient pas à l''équipe indiquée.';
    end if;
    if termine and new.type in ('but', 'csc') then
      score := coalesce(case when new.club_id = m.club_domicile then m.buts_domicile else m.buts_exterieur end, 0);
      if (select count(*) from evenements_match where match_id = id_match and club_id = new.club_id and type in ('but', 'csc')) > score then
        raise exception 'Cette équipe a marqué % but(s) et ils sont tous déjà dans le déroulé. Pour nommer un but, utilisez « Ajouter le nom » sur sa ligne ; pour changer le score, passez par « Clubs et matchs ».', score;
      end if;
    end if;
  end if;
  if termine then
    return coalesce(new, old);
  end if;
  update matchs set
    buts_domicile = (select count(*) from evenements_match where match_id = id_match and club_id = m.club_domicile and type in ('but', 'csc')),
    buts_exterieur = (select count(*) from evenements_match where match_id = id_match and club_id = m.club_exterieur and type in ('but', 'csc')),
    statut = case when m.statut = 'programmé' then 'en cours' else m.statut end,
    modifie_le = now()
  where id = id_match;
  return coalesce(new, old);
end;
$$;

-- Modifier le nom d'un but ou d'un carton : seuls le joueur, le nom et la minute changent.
create or replace function prive.evenement_match_modifie()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.match_id <> old.match_id or new.club_id <> old.club_id or new.type <> old.type then
    raise exception 'Seuls le nom du joueur et la minute se modifient : annulez la saisie et refaites-la.';
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'evenement_match_modifie') then
    create trigger evenement_match_modifie before update on evenements_match
      for each row execute function prive.evenement_match_modifie();
  end if;
  if not exists (select 1 from pg_policies where tablename = 'evenements_match' and policyname = 'événements modifiés par comité') then
    create policy "événements modifiés par comité" on evenements_match for update
      using (prive.a_le_role('{comite}')) with check (prive.a_le_role('{comite}'));
  end if;
end $$;

-- Classement des buteurs : un même nom écrit à la main (majuscules et espaces près) compte pour un seul joueur.
create or replace view buteurs with (security_invoker = true) as
select max(e.joueur_nom) as joueur_nom, e.club_id,
  count(*) filter (where e.type = 'but') as buts,
  count(*) filter (where e.type = 'jaune') as jaunes,
  count(*) filter (where e.type = 'rouge') as rouges
from evenements_match e
join matchs m on m.id = e.match_id and m.statut <> 'annulé'
where e.joueur_nom is not null and e.type <> 'csc'
group by coalesce(e.joueur_id::text, lower(regexp_replace(btrim(e.joueur_nom), '\s+', ' ', 'g'))), e.club_id;
grant select on buteurs to anon, authenticated;
