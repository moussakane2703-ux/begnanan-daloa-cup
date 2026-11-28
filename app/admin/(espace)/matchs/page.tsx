import { Formulaire } from "@/components/admin/Formulaire";
import { exigerAcces } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Club, Match } from "@/lib/types";
import { ajouterClub, ajouterMatch, modifierClub, modifierMatch, supprimerClub, supprimerMatch, supprimerTousLesClubs } from "./actions";

const POULES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const STATUTS = ["programmé", "en cours", "terminé", "reporté", "interrompu", "annulé"];
const PHASES = ["Poules", "Huitièmes", "Quarts", "Demi-finales", "Match pour la 3e place", "Finale"];
const local = (iso: string) => iso.slice(0, 16);

function ChoixPoule({ valeur }: { valeur?: string | null }) {
  return (
    <label className="field">Poule
      <select name="poule" defaultValue={valeur ?? ""}>
        <option value="">—</option>
        {POULES.map((p) => <option key={p}>{p}</option>)}
      </select>
    </label>
  );
}

function ChampsClub({ c }: { c?: Club }) {
  return (
    <>
      <label className="field">Nom<input name="nom" defaultValue={c?.nom} required /></label>
      <label className="field">Sigle (2 à 4 lettres)<input name="sigle" defaultValue={c?.sigle} minLength={2} maxLength={4} required /></label>
      <label className="field">Couleur<input name="couleur" type="color" defaultValue={c?.couleur ?? "#11802c"} /></label>
      <ChoixPoule valeur={c?.poule} />
      <label className="field">Quartier<input name="quartier" defaultValue={c?.quartier ?? ""} /></label>
      <label className="field">Lien du logo (https)<input name="logo_url" type="url" defaultValue={c?.logo_url ?? ""} /></label>
      <label className="field full">Présentation<textarea name="presentation" rows={2} defaultValue={c?.presentation ?? ""} /></label>
    </>
  );
}

export default async function AdminMatchs() {
  await exigerAcces("matchs");
  const db = await createClient();
  const [{ data: clubs }, { data: matchs }] = await Promise.all([
    db.from("clubs").select("*").order("poule").order("nom"),
    db.from("matchs").select("*").order("date_heure"),
  ]);
  const listeClubs = (clubs ?? []) as Club[];
  const nom = new Map(listeClubs.map((c) => [c.id, c.nom]));

  return (
    <>
      <div className="card">
        <p className="small">Le classement des poules se met à jour tout seul dès qu&apos;un match passe « terminé » avec son score. La case « Résultat verrouillé » est facultative : elle empêche seulement de modifier ensuite les buts et les tirs au but du match.</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Matchs</h3>
        <details style={{ marginBottom: 16 }}>
          <summary className="btn line sm">Ajouter un match</summary>
          <div style={{ marginTop: 12 }}>
            <Formulaire action={ajouterMatch} bouton="Ajouter le match">
              <label className="field">Phase<select name="phase">{PHASES.map((p) => <option key={p}>{p}</option>)}</select></label>
              <ChoixPoule />
              <label className="field">Domicile
                <select name="club_domicile" required defaultValue="">
                  <option value="" disabled>Choisir</option>
                  {listeClubs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </label>
              <label className="field">Extérieur
                <select name="club_exterieur" required defaultValue="">
                  <option value="" disabled>Choisir</option>
                  {listeClubs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </label>
              <label className="field">Date et heure (Daloa)<input name="date_heure" type="datetime-local" required /></label>
              <label className="field">Terrain<input name="terrain" defaultValue="Terrain A" /></label>
            </Formulaire>
          </div>
        </details>
        {(matchs ?? []).length === 0 && <p className="small">Aucun match. Ajoutez d&apos;abord les clubs, puis le calendrier.</p>}
        <div className="adm-list">
          {((matchs ?? []) as Match[]).map((m) => (
            <div key={m.id} className="adm-item">
              <b>{nom.get(m.club_domicile)} – {nom.get(m.club_exterieur)}</b>
              <span className="small">
                {m.phase}{m.poule ? ` · Poule ${m.poule}` : ""}
                {m.hdm_nom ? ` · Homme du match : ${m.hdm_nom}` : ""}
                {" · "}<a href={`/admin/direct?match=${m.id}`}>Buts, cartons et Homme du match</a>
                {" · "}<a href={`/matchs/${m.id}`} target="_blank">Carte et affiches</a>
              </span>
              <Formulaire action={modifierMatch} className="form-row">
                <input type="hidden" name="id" value={m.id} />
                <label className="field">Statut<select name="statut" defaultValue={m.statut}>{STATUTS.map((s) => <option key={s}>{s}</option>)}</select></label>
                <label className="field">Buts dom.<input name="buts_domicile" type="number" min={0} defaultValue={m.buts_domicile ?? ""} /></label>
                <label className="field">Buts ext.<input name="buts_exterieur" type="number" min={0} defaultValue={m.buts_exterieur ?? ""} /></label>
                {"hdm_nom" in m && (
                  <>
                    <label className="field">Mi-temps dom.<input name="mt_buts_domicile" type="number" min={0} defaultValue={m.mt_buts_domicile ?? ""} title="Facultatif : utile si les buts n'ont pas été saisis en direct" /></label>
                    <label className="field">Mi-temps ext.<input name="mt_buts_exterieur" type="number" min={0} defaultValue={m.mt_buts_exterieur ?? ""} /></label>
                  </>
                )}
                <label className="field">Date et heure<input name="date_heure" type="datetime-local" defaultValue={local(m.date_heure)} required /></label>
                <label className="field">Terrain<input name="terrain" defaultValue={m.terrain} /></label>
                <label className="chk"><input name="resultat_valide" type="checkbox" defaultChecked={m.resultat_valide} /> Résultat verrouillé</label>
              </Formulaire>
              <Formulaire action={supprimerMatch} className="form-del" bouton="Supprimer" confirmer="Supprimer ce match ?">
                <input type="hidden" name="id" value={m.id} />
              </Formulaire>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Clubs ({listeClubs.length})</h3>
        <details style={{ marginBottom: 16 }}>
          <summary className="btn line sm">Ajouter un club</summary>
          <div style={{ marginTop: 12 }}>
            <Formulaire action={ajouterClub} bouton="Ajouter le club"><ChampsClub /></Formulaire>
          </div>
        </details>
        <div className="adm-list">
          {listeClubs.map((c) => (
            <details key={c.id} className="adm-item">
              <summary><b>{c.nom}</b> <span className="small">{c.sigle}{c.poule ? ` · Poule ${c.poule}` : ""}</span></summary>
              <Formulaire action={modifierClub}>
                <input type="hidden" name="id" value={c.id} />
                <ChampsClub c={c} />
              </Formulaire>
              <Formulaire action={supprimerClub} className="form-del" bouton="Supprimer le club" confirmer={`Supprimer ${c.nom} ?`}>
                <input type="hidden" name="id" value={c.id} />
              </Formulaire>
            </details>
          ))}
        </div>
        {listeClubs.length > 1 && (
          <Formulaire action={supprimerTousLesClubs} className="form-del" bouton="Supprimer tous les clubs" confirmer="Supprimer tous les clubs du site ? Ceux qui ont déjà des matchs ou un président sont gardés.">
            <span className="small">Retire d&apos;un coup les clubs qui n&apos;ont encore ni match ni président.</span>
          </Formulaire>
        )}
      </div>
    </>
  );
}
