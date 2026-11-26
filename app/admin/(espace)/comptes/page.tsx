import { Formulaire } from "@/components/admin/Formulaire";
import { exigerAcces } from "@/lib/auth";
import { identifiantAffiche } from "@/lib/identifiant";
import { createServiceClient } from "@/lib/supabase/server";
import { ROLES, ROLES_ORGANISATEURS, type Role } from "@/lib/types";
import { creerCompte, creerComptePresident, modifierCompte, nouveauMotDePasse } from "./actions";

/** Mot de passe oublié : l'administrateur en fixe un provisoire. */
function MotDePasseProvisoire({ id }: { id: string }) {
  return (
    <details className="small" style={{ marginTop: 8 }}>
      <summary>Mot de passe oublié ?</summary>
      <Formulaire action={nouveauMotDePasse} bouton="Enregistrer le nouveau mot de passe" className="form-row">
        <input type="hidden" name="id" value={id} />
        <label className="field">Mot de passe provisoire<input name="motdepasse" type="text" minLength={10} required autoComplete="off" /></label>
      </Formulaire>
    </details>
  );
}

function ChoixRole({ valeur }: { valeur?: Role }) {
  return (
    <label className="field">Rôle
      <select name="role" defaultValue={valeur ?? "comite"}>
        {ROLES_ORGANISATEURS.map((k) => <option key={k} value={k}>{ROLES[k].label}</option>)}
      </select>
    </label>
  );
}

export default async function AdminComptes() {
  await exigerAcces("comptes");
  let profils: { user_id: string; nom: string; role: Role; actif: boolean }[] = [];
  let presidents: { user_id: string; nom: string; actif: boolean; clubs: { nom: string } | null }[] = [];
  let clubsSansPresident: { id: string; nom: string }[] = [];
  let emails = new Map<string, string>();
  try {
    const admin = createServiceClient();
    const [p, pr, u, c, cp] = await Promise.all([
      admin.from("profils").select("*").order("nom"),
      admin.from("presidents").select("user_id, nom, actif, clubs(nom)").order("nom"),
      admin.auth.admin.listUsers({ perPage: 200 }),
      admin.from("clubs").select("id, nom").order("nom"),
      admin.from("presidents").select("club_id"),
    ]);
    const avecPresident = new Set((cp.data ?? []).map((x) => x.club_id));
    clubsSansPresident = (c.data ?? []).filter((x) => !avecPresident.has(x.id));
    profils = p.data ?? [];
    presidents = (pr.data ?? []) as unknown as typeof presidents;
    emails = new Map((u.data?.users ?? []).map((x) => [x.id, identifiantAffiche(x.email ?? "")]));
  } catch {
    return <div className="card"><p>La clé de service Supabase n&apos;est pas configurée : voir le guide d&apos;installation.</p></div>;
  }

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Rôles</h3>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>Administrateur</b> : tout, y compris les comptes.</li>
          <li><b>Comité</b> : paramètres du tournoi, clubs, matchs, scores et validation, inscriptions et licences.</li>
          <li><b>Billetterie</b> : prix, catégories, commandes, contrôle à l&apos;entrée.</li>
          <li><b>Médias</b> : débriefs, annonces, hommes du match, galerie.</li>
          <li><b>Présidents de club</b> : ils créent leur compte (identifiant et mot de passe) en déposant la demande d&apos;inscription du club ; il s&apos;ouvre quand le comité l&apos;accepte (onglet « Inscriptions et licences ») et donne accès à l&apos;espace club, pas à l&apos;espace pro. Pour un club déjà inscrit sans président, créez son compte plus bas.</li>
        </ul>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Créer un compte</h3>
        <Formulaire action={creerCompte} bouton="Créer le compte">
          <label className="field">Nom<input name="nom" required /></label>
          <label className="field">E-mail ou nom d&apos;utilisateur<input name="email" required autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
          <ChoixRole />
          <label className="field">Mot de passe provisoire<input name="motdepasse" type="text" minLength={10} required autoComplete="off" /></label>
        </Formulaire>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Organisateurs ({profils.length})</h3>
        <div className="adm-list">
          {profils.map((p) => (
            <div key={p.user_id} className="adm-item">
              <b>{p.nom}</b> <span className="small">{emails.get(p.user_id)}</span>
              <Formulaire action={modifierCompte} className="form-row">
                <input type="hidden" name="id" value={p.user_id} />
                <ChoixRole valeur={p.role} />
                <label className="chk"><input name="actif" type="checkbox" defaultChecked={p.actif} /> Actif</label>
              </Formulaire>
              <MotDePasseProvisoire id={p.user_id} />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Présidents de club ({presidents.length})</h3>
        {clubsSansPresident.length > 0 && (
          <details style={{ marginBottom: 14 }}>
            <summary><b>Créer le compte du président</b> d&apos;un club déjà inscrit ({clubsSansPresident.length} clubs sans compte)</summary>
            <Formulaire action={creerComptePresident} bouton="Créer le compte du président">
              <label className="field">Club
                <select name="club_id" required defaultValue="">
                  <option value="" disabled>Choisir le club</option>
                  {clubsSansPresident.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </label>
              <label className="field">Nom<input name="nom" required /></label>
              <label className="field">Prénoms<input name="prenoms" required /></label>
              <label className="field">Téléphone<input name="telephone" type="tel" /></label>
              <label className="field">E-mail ou nom d&apos;utilisateur<input name="email" required autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
              <label className="field">Mot de passe provisoire<input name="motdepasse" type="text" minLength={10} required autoComplete="off" /></label>
            </Formulaire>
          </details>
        )}
        <p className="small" style={{ marginBottom: 12 }}>Un président qui a oublié son mot de passe : fixez-en un provisoire et remettez-le-lui en main propre.</p>
        {!presidents.length && <p className="small">Aucun président pour l&apos;instant.</p>}
        <div className="adm-list">
          {presidents.map((p) => (
            <div key={p.user_id} className="adm-item">
              <b>{p.nom}</b> <span className="small">{p.clubs?.nom} · {emails.get(p.user_id)}{p.actif ? "" : " · désactivé"}</span>
              <MotDePasseProvisoire id={p.user_id} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
