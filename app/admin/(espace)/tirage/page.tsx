import Link from "next/link";
import { Formulaire } from "@/components/admin/Formulaire";
import { exigerAcces } from "@/lib/auth";
import { LETTRES_POULES } from "@/lib/calendrier";
import { createClient } from "@/lib/supabase/server";
import type { Club } from "@/lib/types";
import { creerCalendrier, enregistrerPoules, tirerAuSort } from "./actions";

const JOURS = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [0, "Dim"]] as const;

export default async function Tirage() {
  await exigerAcces("tirage");
  const db = await createClient();
  const [{ data: clubs }, { data: t }, { count: nbMatchs }] = await Promise.all([
    db.from("clubs").select("id, nom, poule, disqualifie, tete_de_serie, poules_possibles").order("nom"),
    db.from("tournoi").select("date_debut").eq("id", 1).single(),
    db.from("matchs").select("id", { count: "exact", head: true }).eq("phase", "Poules"),
  ]);
  const engages = ((clubs ?? []) as (Pick<Club, "id" | "nom" | "poule" | "disqualifie"> & { tete_de_serie: boolean; poules_possibles: string | null })[]).filter((c) => !c.disqualifie);
  const tetes = engages.filter((c) => c.tete_de_serie);
  const limitees = tetes.filter((c) => c.poules_possibles);
  const nbPoulesConseille = Math.min(8, Math.max(1, Math.round(engages.length / 4)));
  const poules = LETTRES_POULES.map((p) => [p, engages.filter((c) => c.poule === p)] as const).filter(([, l]) => l.length);
  const sansPoule = engages.filter((c) => !c.poule);

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>1. Tirage au sort des poules</h3>
        <p className="small" style={{ marginBottom: 12 }}>
          {engages.length} clubs engagés. Le site répartit les clubs au hasard, en poules de même taille.
          {tetes.length ? (
            <>
              {" "}Décision du comité : <b>{tetes.length} têtes de série</b>, une par poule ({tetes.map((c) => c.nom).join(", ")}).
              {limitees.map((c) => ` ${c.nom} : poule ${[...c.poules_possibles!].join(" ou ")}.`).join("")}
              {" "}Tous les autres clubs sont tirés au hasard.
            </>
          ) : (
            " Aucune tête de série : tirage intégral."
          )}
        </p>
        <Formulaire action={tirerAuSort} bouton="Lancer le tirage" className="form-row" confirmer="Lancer le tirage ? Les poules actuelles seront remplacées.">
          <label className="field">Nombre de poules
            <select name="nb_poules" defaultValue={nbPoulesConseille}>
              {LETTRES_POULES.map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
        </Formulaire>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>2. Poules (modifiables)</h3>
        <p className="small" style={{ marginBottom: 12 }}>Déplacez un club en changeant sa poule, puis enregistrez.</p>
        {!engages.length && <p className="small">Aucun club engagé pour l&apos;instant.</p>}
        {engages.length > 0 && (
          <Formulaire action={enregistrerPoules} bouton="Enregistrer les poules" className="">
            <div className="grid g4 poules-edit">
              {[...poules, ...(sansPoule.length ? [["—", sansPoule] as const] : [])].map(([p, l]) => (
                <div key={p} className="adm-item">
                  <b>{p === "—" ? "Sans poule" : `Poule ${p}`}</b> <span className="small">· {l.length} clubs</span>
                  {l.map((c) => (
                    <label key={c.id} className="poule-ligne">
                      <span>{c.nom}</span>
                      <input type="hidden" name={`avant_${c.id}`} value={c.poule ?? ""} />
                      <select name={`poule_${c.id}`} defaultValue={c.poule ?? ""} aria-label={`Poule de ${c.nom}`}>
                        <option value="">—</option>
                        {LETTRES_POULES.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </Formulaire>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>3. Calendrier automatique</h3>
        <p className="small" style={{ marginBottom: 12 }}>
          Le site crée tous les matchs de poule : chaque club rencontre une fois chacun des autres clubs de sa poule, une journée à la fois,
          jamais deux matchs le même jour. {nbMatchs ? `${nbMatchs} matchs de poule existent déjà.` : ""} Ensuite, chaque match reste
          modifiable (date, heure, terrain, report, annulation) dans <Link href="/admin/matchs">Clubs et matchs</Link>.
        </p>
        <Formulaire action={creerCalendrier} bouton="Générer le calendrier">
          <label className="field">Premier jour<input name="debut" type="date" defaultValue={t?.date_debut} required /></label>
          <fieldset className="field full jours">
            <legend>Jours de match</legend>
            {JOURS.map(([n, l]) => (
              <label key={n} className="chk"><input type="checkbox" name="jours" value={n} defaultChecked={n === 6 || n === 0} /> {l}</label>
            ))}
          </fieldset>
          <label className="field">Heures de coup d&apos;envoi<input name="heures" defaultValue="15:00, 17:00" required /></label>
          <label className="field">Terrains (séparés par des virgules)<input name="terrains" defaultValue="Terrain A" required /></label>
          <label className="chk"><input name="remplacer" type="checkbox" /> Remplacer les matchs de poule programmés</label>
          <label className="chk"><input name="annoncer" type="checkbox" defaultChecked /> Publier une annonce « calendrier publié »</label>
        </Formulaire>
        <p className="small" style={{ marginTop: 8 }}>Jours, heures et terrains réels : <span className="tbc">à confirmer</span> par le comité.</p>
      </div>
    </>
  );
}
