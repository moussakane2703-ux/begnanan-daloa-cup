"use client";

import { useActionState, useState } from "react";
import type { Etat } from "@/lib/admin";
import { PERIODES, suites, type Chrono } from "@/lib/chrono";
import { ajouterEvenement, ajouterTir, piloterChrono } from "./actions";

const BOUTONS = [
  ["but", "⚽ But", "primary"],
  ["jaune", "⏱️ 2 min", "line"],
  ["rouge", "⛔ 5 min", "line"],
  ["csc", "Contre son camp", "line"],
] as const;

/**
 * Saisie d'un but ou d'un carton pour une équipe : un bouton par type, pensé pour le téléphone.
 * Le joueur se choisit parmi les inscrits, ou son nom s'écrit à la main s'il n'est pas inscrit.
 * Après le match (« apres ») : on complète le déroulé, le score ne change pas.
 */
export function SaisieEquipe({ matchId, club, joueurs, apres = false }: { matchId: string; club: { id: string; nom: string }; joueurs: { id: string; nom: string }[]; apres?: boolean }) {
  const [etat, envoyer, envoi] = useActionState<Etat, FormData>(ajouterEvenement, {});
  const [choix, setChoix] = useState("");
  // Après chaque saisie réussie, le choix du joueur revient à zéro (les champs texte se vident seuls).
  const [vu, setVu] = useState(etat);
  if (etat !== vu) {
    setVu(etat);
    if (etat.ok) setChoix("");
  }
  return (
    <form action={envoyer} className="card direct-equipe">
      <h3 style={{ marginBottom: 10 }}>{club.nom}</h3>
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="club_id" value={club.id} />
      <div className="form-row" style={{ marginTop: 0 }}>
        {joueurs.length > 0 && (
          <label className="field" style={{ flex: "3 1 160px" }}>Joueur inscrit
            <select name="joueur_id" value={choix} onChange={(e) => setChoix(e.target.value)}>
              <option value="">{apres ? "Pas dans la liste" : "Non précisé / pas dans la liste"}</option>
              {joueurs.map((j) => <option key={j.id} value={j.id}>{j.nom}</option>)}
            </select>
          </label>
        )}
        {!choix && (
          <label className="field" style={{ flex: "3 1 160px" }}>{joueurs.length ? "Ou nom du joueur" : "Nom du joueur"}
            <input name="joueur_libre" maxLength={150} autoComplete="off" placeholder={apres ? "ex. Bozer" : "facultatif, ex. Bozer"} />
          </label>
        )}
        <label className="field" style={{ flex: "1 1 70px" }}>Minute<input name="minute" type="number" min={0} max={130} inputMode="numeric" placeholder={apres ? "facultatif" : "chrono"} /></label>
      </div>
      <div className="direct-boutons">
        {BOUTONS.map(([t, libelle, style]) => (
          <button key={t} name="type" value={t} className={`btn ${style}`} disabled={envoi}>{libelle}</button>
        ))}
      </div>
      {etat.erreur && <p className="form-err">{etat.erreur}</p>}
      {etat.ok && <p className="form-ok">{etat.ok}</p>}
    </form>
  );
}

const LANCER: Record<string, string> = { mt2: "Début de la 2e mi-temps", prol1: "Prolongations", prol2: "Début de la 2e prolongation", tab: "Tirs au but" };

/** Commandes du chrono : un bouton par action possible à ce moment du match. */
export function CommandesChrono({ matchId, chrono }: { matchId: string; chrono: Chrono }) {
  const [etat, envoyer, envoi] = useActionState<Etat, FormData>(piloterChrono, {});
  const enJeu = !!chrono.periode && chrono.periode !== "tab" && !chrono.periode_terminee;
  const suivantes = suites(chrono);
  return (
    <form
      action={envoyer}
      className="chrono-commandes"
      onSubmit={(e) => {
        const op = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
        if (op === "fin_periode" && !window.confirm(`Siffler la fin de la ${PERIODES[chrono.periode!].toLowerCase()} ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="match_id" value={matchId} />
      {enJeu && (
        <div className="direct-boutons">
          {chrono.chrono_lance
            ? <button name="op" value="arreter" className="btn line" disabled={envoi}>⏸ Arrêter le chrono</button>
            : <button name="op" value="reprendre" className="btn primary" disabled={envoi}>▶ Reprendre</button>}
          <button name="op" value="fin_periode" className="btn primary" disabled={envoi}>Fin de la {chrono.periode === "mt1" || chrono.periode === "mt2" ? "mi-temps" : "prolongation"}</button>
          <button name="op" value="moins" className="btn line sm" disabled={envoi}>− 1 min</button>
          <button name="op" value="plus" className="btn line sm" disabled={envoi}>+ 1 min</button>
        </div>
      )}
      {suivantes.length > 0 && (
        <div className="direct-boutons">
          {suivantes.map((p) => <button key={p} name="op" value={p} className="btn primary" disabled={envoi}>{LANCER[p]}</button>)}
        </div>
      )}
      {etat.erreur && <p className="form-err">{etat.erreur}</p>}
      {etat.ok && <p className="form-ok">{etat.ok}</p>}
    </form>
  );
}

/** Saisie d'un tir au but pour une équipe : tireur, puis marqué ou manqué. */
export function SaisieTir({ matchId, club, joueurs, aSonTour }: { matchId: string; club: { id: string; nom: string }; joueurs: { id: string; nom: string }[]; aSonTour: boolean }) {
  const [etat, envoyer, envoi] = useActionState<Etat, FormData>(ajouterTir, {});
  return (
    <form action={envoyer} className={`card direct-equipe${aSonTour ? " a-son-tour" : ""}`}>
      <h3 style={{ marginBottom: 10 }}>{club.nom}{aSonTour && <span className="pill ok" style={{ marginLeft: 8 }}>À son tour</span>}</h3>
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="club_id" value={club.id} />
      <label className="field">Tireur
        <select name="joueur_id" defaultValue="">
          <option value="">Non précisé</option>
          {joueurs.map((j) => <option key={j.id} value={j.id}>{j.nom}</option>)}
        </select>
      </label>
      <div className="direct-boutons">
        <button name="reussi" value="oui" className="btn primary" disabled={envoi || !aSonTour}>✅ Marqué</button>
        <button name="reussi" value="non" className="btn line" disabled={envoi || !aSonTour}>❌ Manqué</button>
      </div>
      {etat.erreur && <p className="form-err">{etat.erreur}</p>}
      {etat.ok && <p className="form-ok">{etat.ok}</p>}
    </form>
  );
}
