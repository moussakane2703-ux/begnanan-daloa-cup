"use client";

import { useActionState } from "react";
import { retrouver, type EtatRetrouver } from "./actions";

export function RetrouverBillet() {
  const [etat, action, envoi] = useActionState<EtatRetrouver, FormData>(retrouver, {});
  return (
    <form action={action} className="form-grid">
      <label className="field">Référence du billet<input name="reference" required autoComplete="off" autoCapitalize="characters" placeholder="BDC-XXXXXX" /></label>
      <label className="field">Téléphone de la réservation<input name="telephone" type="tel" inputMode="tel" required autoComplete="tel" /></label>
      <div className="form-actions">
        <button className="btn line sm" disabled={envoi}>{envoi ? "Recherche…" : "Retrouver mon billet"}</button>
        {etat.erreur && <span className="form-err">{etat.erreur}</span>}
      </div>
    </form>
  );
}
