"use client";

import { useActionState, useRef, useState } from "react";
import type { Etat } from "@/lib/admin";

/**
 * Formulaire d'administration : affiche l'erreur ou la confirmation renvoyée par l'action serveur.
 * `confirmer` demande une confirmation dans la page elle-même : window.confirm est bloqué
 * sans message par certains navigateurs intégrés (applis mobiles), et le bouton semblait ne rien faire.
 */
export function Formulaire({
  action,
  children,
  bouton = "Enregistrer",
  className = "form-grid",
  confirmer,
}: {
  action: (etat: Etat, form: FormData) => Promise<Etat>;
  children: React.ReactNode;
  bouton?: string;
  className?: string;
  confirmer?: string;
}) {
  const [etat, envoyer, envoi] = useActionState(action, {});
  const [question, setQuestion] = useState(false);
  const confirme = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={envoyer}
      className={className}
      onSubmit={(e) => {
        if (!confirmer || confirme.current) {
          confirme.current = false;
          setQuestion(false);
          return;
        }
        e.preventDefault();
        setQuestion(true);
      }}
    >
      {children}
      <div className="form-actions">
        {question ? (
          <>
            <span className="form-err">{confirmer}</span>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => {
                confirme.current = true;
                form.current?.requestSubmit();
              }}
            >
              Oui, confirmer
            </button>
            <button type="button" className="btn sm" onClick={() => setQuestion(false)}>Annuler</button>
          </>
        ) : (
          <button className="btn primary sm" disabled={envoi}>{envoi ? "Enregistrement…" : bouton}</button>
        )}
        {etat.erreur && <span className="form-err">{etat.erreur}</span>}
        {etat.ok && <span className="form-ok">{etat.ok}</span>}
      </div>
    </form>
  );
}
