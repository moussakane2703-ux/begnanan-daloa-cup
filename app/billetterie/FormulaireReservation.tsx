"use client";

import { useActionState, useMemo, useState } from "react";
import { reserver, type EtatReservation } from "./actions";

export interface ChoixMatch {
  id: string;
  jour: string;
  libelle: string;
}
export interface ChoixCategorie {
  id: string;
  nom: string;
  prix: number;
  description: string;
}

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Formulaire de réservation : match, catégorie, nombre de places, nom et téléphone. */
export function FormulaireReservation({ matchs, categories, places }: {
  matchs: ChoixMatch[];
  categories: ChoixCategorie[];
  /** Places restantes par « match:catégorie ». */
  places: Record<string, number>;
}) {
  const [etat, action, envoi] = useActionState<EtatReservation, FormData>(reserver, {});
  const [match, setMatch] = useState(matchs[0]?.id ?? "");
  const libresDe = (c: string) => places[`${match}:${c}`] ?? 0;
  const premiere = categories.find((c) => libresDe(c.id) > 0)?.id ?? "";
  const [categorie, setCategorie] = useState(premiere);
  const [quantite, setQuantite] = useState(1);
  const jours = useMemo(() => [...new Set(matchs.map((m) => m.jour))], [matchs]);

  const choisie = categories.find((c) => c.id === categorie);
  const libres = choisie ? libresDe(choisie.id) : 0;
  const max = Math.max(0, Math.min(10, libres));
  const nombre = Math.min(quantite, Math.max(1, max));

  return (
    <form action={action} className="resa">
      <label className="field">Match
        <select
          name="match"
          value={match}
          required
          onChange={(e) => {
            setMatch(e.target.value);
            // Garde la catégorie si elle a encore des places pour ce match, sinon prend la première libre.
            const ok = (c: string) => (places[`${e.target.value}:${c}`] ?? 0) > 0;
            if (!ok(categorie)) setCategorie(categories.find((c) => ok(c.id))?.id ?? "");
          }}
        >
          {jours.map((j) => (
            <optgroup key={j} label={j}>
              {matchs.filter((m) => m.jour === j).map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
            </optgroup>
          ))}
        </select>
      </label>

      <fieldset className="resa-cats">
        <legend>Catégorie</legend>
        {categories.map((c) => {
          const n = libresDe(c.id);
          return (
            <label key={c.id} className={`resa-cat${categorie === c.id ? " on" : ""}${n <= 0 ? " complet" : ""}`}>
              <input type="radio" name="categorie" value={c.id} checked={categorie === c.id} disabled={n <= 0} onChange={() => setCategorie(c.id)} required />
              <b>{c.nom}</b>
              <span className="num">{fcfa(c.prix)}</span>
              <small>{n <= 0 ? "Complet" : `${n} place${n > 1 ? "s" : ""} libre${n > 1 ? "s" : ""}`}</small>
            </label>
          );
        })}
      </fieldset>

      <div className="form-grid">
        <label className="field">Nombre de billets
          <select name="quantite" value={nombre} onChange={(e) => setQuantite(Number(e.target.value))} disabled={!max}>
            {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field">Votre nom<input name="nom" required minLength={2} maxLength={80} autoComplete="name" placeholder="Prénom et nom" /></label>
        <label className="field full">Téléphone (WhatsApp de préférence)<input name="telephone" type="tel" inputMode="tel" required autoComplete="tel" placeholder="07 00 00 00 00" /></label>
      </div>

      <div className="resa-total">
        <span>À payer sur place</span>
        <b className="num">{choisie && max ? fcfa(choisie.prix * nombre) : "—"}</b>
      </div>
      {etat.erreur && <p className="form-err" role="alert">{etat.erreur}</p>}
      <button className="btn primary" disabled={envoi || !choisie || !max}>{envoi ? "Réservation…" : "Réserver mon billet"}</button>
      <p className="small">Aucun paiement en ligne : vous recevez un billet avec QR code. Montrez-le à l&apos;entrée du terrain et payez sur place.</p>
    </form>
  );
}
