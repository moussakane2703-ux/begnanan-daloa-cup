-- Classement automatique : un match de poule compte dès qu'il est « terminé » avec son score,
-- sans attendre la case « Résultat validé ». Cette case ne sert plus qu'à verrouiller
-- le déroulé du match (buts, tirs au but). À exécuter après 0019 ; peut être rejoué sans risque.
create or replace view classement
with (security_invoker = true) as
with r as (
  select poule, club_domicile as club, buts_domicile as bp, buts_exterieur as bc from matchs
    where statut = 'terminé' and phase = 'Poules' and buts_domicile is not null and buts_exterieur is not null
  union all
  select poule, club_exterieur, buts_exterieur, buts_domicile from matchs
    where statut = 'terminé' and phase = 'Poules' and buts_domicile is not null and buts_exterieur is not null
)
select c.poule, c.id as club_id, c.nom, c.sigle, c.couleur,
  count(r.club)::int as joues,
  count(*) filter (where r.bp > r.bc)::int as gagnes,
  count(*) filter (where r.bp = r.bc)::int as nuls,
  count(*) filter (where r.bp < r.bc)::int as perdus,
  coalesce(sum(r.bp), 0)::int as buts_pour,
  coalesce(sum(r.bc), 0)::int as buts_contre,
  (coalesce(sum(r.bp), 0) - coalesce(sum(r.bc), 0))::int as difference,
  (3 * count(*) filter (where r.bp > r.bc) + count(*) filter (where r.bp = r.bc))::int as points
from clubs c left join r on r.club = c.id
where c.poule is not null
group by c.poule, c.id;

grant select on classement to anon, authenticated;
