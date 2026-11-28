-- Badges « Président d'équipe » : chaque badge imprimé porte un QR code avec un jeton secret.
-- Le QR code ouvre /admin/badge/<jeton>, une page de l'espace pro : seul un compte de
-- l'organisation connecté peut voir si le badge est valide. Sans connexion, la page demande
-- de se connecter et n'affiche rien.
-- À exécuter après 0018 ; peut être rejoué sans risque.
create table if not exists badges_presidents (
  jeton text primary key check (char_length(jeton) between 12 and 64),
  club_id uuid not null references clubs(id) on delete cascade,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
create index if not exists badges_presidents_club_idx on badges_presidents (club_id);

-- Aucune lecture publique : la page de vérification lit la table avec la clé de service,
-- après avoir vérifié que la personne connectée a un compte de l'organisation.
alter table badges_presidents enable row level security;

-- Les jetons ne sont pas dans ce dépôt : ils sont insérés une fois, à partir du fichier privé qui sert
-- à imprimer les badges (le jeton du QR code imprimé doit être celui de la base).
