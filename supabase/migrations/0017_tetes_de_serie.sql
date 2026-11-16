-- Têtes de série du tirage au sort : une par poule, le reste est tiré au hasard.
-- poules_possibles : poules autorisées pour ce club (ex. « FG »), décidées par le comité et affichées sur la page du tirage.
alter table clubs add column if not exists tete_de_serie boolean not null default false;
alter table clubs add column if not exists poules_possibles text check (poules_possibles ~ '^[A-H]{1,8}$');

update clubs set tete_de_serie = true
where nom in ('Baraka', 'Soweto MC', 'J.U.D MC', 'Segou', 'Dream Team FC', 'FC Sissoko', 'Super junior D''Huberson', 'TEAM GBOGUHE');
update clubs set poules_possibles = 'FG' where nom = 'TEAM GBOGUHE';
