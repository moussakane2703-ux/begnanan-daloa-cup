-- Cartes de match : score par mi-temps, Homme du match et compositions d'équipe.
-- À exécuter après 0015 ; peut être rejoué sans risque.

-- Période où un but ou un carton a été saisi (1re ou 2e mi-temps, prolongations) :
-- donne le détail « 1re MT / 2e MT » sur les cartes de match.
alter table evenements_match add column if not exists periode text check (periode in ('mt1', 'mt2', 'prol1', 'prol2'));

-- Score à la mi-temps saisi à la main, pour un match dont les buts n'ont pas été saisis en direct.
alter table matchs add column if not exists mt_buts_domicile int check (mt_buts_domicile >= 0);
alter table matchs add column if not exists mt_buts_exterieur int check (mt_buts_exterieur >= 0);

-- Homme du match : nom affiché (copié, les fiches joueurs ne sont pas publiques) et son équipe.
alter table matchs add column if not exists hdm_joueur_id uuid references joueurs(id) on delete set null;
alter table matchs add column if not exists hdm_nom text check (char_length(hdm_nom) <= 150);
alter table matchs add column if not exists hdm_club_id uuid references clubs(id) on delete set null;
create index if not exists matchs_hdm_joueur_idx on matchs (hdm_joueur_id);
create index if not exists matchs_hdm_club_idx on matchs (hdm_club_id);

-- ---------------------------------------------------------------------------
-- Compositions : chaque club annonce ses titulaires et remplaçants pour un match.
-- Le président la prépare depuis l'espace club tant que le match n'a pas commencé ;
-- le comité peut la corriger à tout moment. Visible sur le site une fois publiée.
-- ---------------------------------------------------------------------------
create table if not exists compositions (
  match_id uuid not null references matchs(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  titulaires uuid[] not null default '{}',
  remplacants uuid[] not null default '{}',
  capitaine uuid,
  coach text check (char_length(coach) <= 150),
  publiee boolean not null default false,
  modifie_le timestamptz not null default now(),
  primary key (match_id, club_id)
);
create index if not exists compositions_club_idx on compositions (club_id);

alter table compositions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'compositions' and policyname = 'compositions lues') then
    create policy "compositions lues" on compositions for select
      using (publiee or club_id = prive.club_du_president() or prive.a_le_role('{comite}'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'compositions' and policyname = 'compositions ajoutées') then
    create policy "compositions ajoutées" on compositions for insert
      with check (club_id = prive.club_du_president() or prive.a_le_role('{comite}'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'compositions' and policyname = 'compositions modifiées') then
    create policy "compositions modifiées" on compositions for update
      using (club_id = prive.club_du_president() or prive.a_le_role('{comite}'))
      with check (club_id = prive.club_du_president() or prive.a_le_role('{comite}'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'compositions' and policyname = 'compositions retirées') then
    create policy "compositions retirées" on compositions for delete
      using (club_id = prive.club_du_president() or prive.a_le_role('{comite}'));
  end if;
end $$;

-- Contrôles : le club joue ce match, les joueurs sont ceux du club avec une licence active,
-- personne n'est à la fois titulaire et remplaçant, le capitaine est sur la feuille.
-- Un président ne modifie plus sa composition une fois le match commencé.
create or replace function prive.regles_composition()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  m matchs;
  ligne compositions := coalesce(new, old);
begin
  select * into m from matchs where id = ligne.match_id;
  if not prive.a_le_role('{comite}') and m.statut <> 'programmé' then
    raise exception 'Le match a commencé : seul le comité peut encore modifier la composition.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.club_id not in (m.club_domicile, m.club_exterieur) then
    raise exception 'Ce club ne joue pas ce match.';
  end if;
  -- Doublons retirés en gardant l'ordre choisi par le club.
  new.titulaires := array(select x from unnest(new.titulaires) with ordinality t(x, i) group by x order by min(i));
  new.remplacants := array(select x from unnest(new.remplacants) with ordinality t(x, i) group by x order by min(i));
  if new.titulaires && new.remplacants then
    raise exception 'Un joueur ne peut pas être à la fois titulaire et remplaçant.';
  end if;
  if exists (
    select 1 from unnest(new.titulaires || new.remplacants) as x(id)
    where not exists (select 1 from joueurs j where j.id = x.id and j.club_id = new.club_id and j.etat = 'active')
  ) then
    raise exception 'Seuls les joueurs du club avec une licence active peuvent être sur la feuille de match.';
  end if;
  if new.capitaine is not null and not (new.capitaine = any (new.titulaires || new.remplacants)) then
    raise exception 'Le capitaine doit être sur la feuille de match.';
  end if;
  new.modifie_le := now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'composition_regles') then
    create trigger composition_regles before insert or update or delete on compositions
      for each row execute function prive.regles_composition();
  end if;
end $$;
