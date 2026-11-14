# BÊGNANAN DALOA CUP

Site officiel du tournoi de maracana BÊGNANAN DALOA CUP (Daloa).

- **Côté supporters** : accueil avec compte à rebours et résultats en direct, calendrier filtrable, classements par poule calculés automatiquement, fiches des clubs, médias (débriefs vidéo, annonces, hommes du match, galerie), billetterie, infos pratiques et inscription aux alertes WhatsApp.
- **Côté présidents de club** : demande d'inscription complète (`/inscription-club`) : club et logo (facultatif), président avec photo, coach, adjoint, liste des joueurs avec photos, et compte (e-mail ou nom d'utilisateur, mot de passe choisi). Une fois la demande acceptée par le comité, le président se connecte à l'**espace club** (`/espace-club`) : profil du club, joueurs et licences (10 incluses par club, les suivantes au tarif fixé par le comité), encadrement, mercato, cartes à imprimer et messages avec le comité. Ce qui n'est pas encore validé se modifie directement ; toute modification d'un élément validé (profil du club, licence, carte) ou tout retrait est une demande que le comité accepte ou refuse. Joueurs, président, coach et adjoint ont chacun une carte avec photo, logo du club et QR code de vérification.
- **Côté organisateurs** (`/admin`, espace pro réservé à l'organisation) : connexion par e-mail ou nom d'utilisateur, droits selon le rôle (administrateur, comité, billetterie, médias). Paramètres du tournoi, tirage au sort des poules et calendrier automatiques (modifiables ensuite), clubs, matchs et scores avec validation, annonces (incident, report, annulation) affichées sur le site et partagées sur WhatsApp, validation des cartes, mercato, catégories et prix des billets, contrôle des billets à l'entrée, publications et galerie, gestion des comptes.

Technique : Next.js (React) hébergé sur Vercel, base de données et comptes sur Supabase. Les droits sont vérifiés par la base elle-même (sécurité par ligne), pas seulement par le site.

## Mise en ligne, étape par étape

Aucun mot de passe ni clé ne doit être envoyé par message : ils se saisissent uniquement dans Supabase et Vercel.

### 1. Base de données (Supabase, offre gratuite)

1. Créer un compte sur [supabase.com](https://supabase.com) puis un projet (région la plus proche : Europe).
2. Dans **SQL Editor**, coller tout le fichier [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql) et cliquer sur **Run**. Si la base a été créée avec une version précédente de ce fichier, exécuter aussi [`0002_correctif_security_definer.sql`](supabase/migrations/0002_correctif_security_definer.sql). Exécuter ensuite [`0003_clubs_licences.sql`](supabase/migrations/0003_clubs_licences.sql) (inscription des clubs et licences), puis [`0004_encadrement_mercato_alertes.sql`](supabase/migrations/0004_encadrement_mercato_alertes.sql) (coach et adjoint, mercato, annonces), puis [`0005_profil_photos_messages.sql`](supabase/migrations/0005_profil_photos_messages.sql) (espace club, photos, messages ; crée aussi l'espace de stockage « photos », gratuit jusqu'à 1 Go)., puis [`0006_naissance_facultative.sql`](supabase/migrations/0006_naissance_facultative.sql) (date de naissance des joueurs facultative). Les fichiers suivants du dossier `supabase/migrations` s'exécutent ensuite dans l'ordre, jusqu'à [`0013_reservation_billets.sql`](supabase/migrations/0013_reservation_billets.sql) (réservation des billets en ligne, paiement sur place).
3. Dans **Authentication → Users → Add user**, créer le premier compte administrateur (e-mail + mot de passe, cocher « Auto confirm »).
4. Dans **SQL Editor**, donner le rôle administrateur à ce compte :
   ```sql
   insert into profils (user_id, nom, role)
   select id, 'Votre nom', 'admin' from auth.users where email = 'votre@email.com';
   ```
5. Dans **Authentication → Sign In / Providers**, désactiver « Allow new users to sign up » : seuls les comptes créés depuis l'espace admin peuvent se connecter.
6. Dans **Project Settings → API**, noter l'URL du projet, la clé `anon` et la clé `service_role` (cette dernière reste secrète).

### 2. Hébergement (Vercel, offre gratuite)

1. Créer un compte sur [vercel.com](https://vercel.com) avec le compte GitHub, puis **Add New → Project** et importer ce dépôt.
2. Dans **Environment Variables**, ajouter les trois valeurs notées plus haut (voir [`.env.example`](.env.example)) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Cliquer sur **Deploy**. Le site est en ligne à une adresse `….vercel.app` ; un nom de domaine (par exemple `begnanandaloacup.ci`) peut être branché ensuite dans **Settings → Domains**.

### 3. Premiers pas dans l'espace organisateurs

1. Aller sur `/admin`, se connecter avec le compte administrateur.
2. **Tournoi** : vérifier dates, lieu et accroche. Cocher « Dates confirmées » quand elles le sont.
3. **Comptes** : créer les comptes du comité, de la billetterie et des médias. Le mot de passe provisoire se remet en main propre ; chacun le change depuis son tableau de bord.
4. **Tirage et calendrier** : lancer le tirage au sort, corriger les poules si besoin, puis générer le calendrier des poules. **Clubs et matchs** : ajuster un match (date, heure, terrain, report, annulation). Pendant un match, mettre le statut « en cours » et le score ; à la fin, « terminé », puis cocher « Résultat validé » pour que le classement se mette à jour.
5. **Billetterie** : créer les catégories (prix, places par match) et cocher « En vente ». Les supporters réservent alors sur `/billetterie` sans payer et reçoivent un billet avec QR code (`/billet/…`, à enregistrer en image ou à s'envoyer sur WhatsApp). Le QR code du billet ne contient pas de lien : seul le scanner de l'espace pro sait le lire. Le jour du match, l'équipe, connectée à l'espace pro (compte billetterie ou administrateur, sur autant de téléphones que nécessaire), ouvre **Billetterie → Scanner les billets** : la caméra lit le QR code, l'écran indique le montant à encaisser, puis « Encaissé · faire entrer ». Un billet est réservé pour un match précis et ne sert qu'une fois (une entrée par place réservée) ; chaque match a son propre quota de places, remis à neuf pour le match suivant. Une réservation non payée garde ses places jusqu'au match et peut être annulée depuis le scanner.

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev                  # http://localhost:3000
npm test                     # tests unitaires
npm run lint                 # vérification des types
npm run build
```

Sans variables Supabase, le site s'affiche quand même avec des listes vides, ce qui permet de vérifier la mise en page.

## Envoi automatique des annonces sur WhatsApp (facultatif)

Sans réglage, chaque annonce a un bouton « Partager sur WhatsApp » (groupe, chaîne ou liste de diffusion du comité). Pour un envoi direct à chaque abonné, il faut un compte WhatsApp Business Platform de Meta (numéro dédié, modèle de message approuvé avec deux variables : titre et texte ; envoi payant à la conversation), puis ajouter dans Vercel : `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` (nom du modèle) et, si besoin, `WHATSAPP_TEMPLATE_LANG` (par défaut `fr`).

## Prochaines étapes

- Paiement en ligne par mobile money (Orange Money, MTN MoMo, Moov Money, Wave) via CinetPay, en plus du paiement sur place : nécessite un compte marchand CinetPay au nom du comité.
- Envoi automatique des alertes WhatsApp (WhatsApp Business).
- Envoi des photos directement depuis l'espace médias (aujourd'hui : lien vers l'image).

Les informations non encore décidées par le comité (dates définitives, barème, format de la phase finale, contacts) sont affichées « à confirmer » sur le site.
