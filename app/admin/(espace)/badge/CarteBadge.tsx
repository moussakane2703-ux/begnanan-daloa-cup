"use client";

import { useState, useTransition } from "react";
import { changerBadge, type ResultatBadge } from "./actions";

/**
 * Résultat du scan d'un badge « Président d'équipe » : entrée gratuite si le badge est valide.
 * `gerer` (administrateur, comité) : bouton pour désactiver un badge perdu, ou le réactiver.
 */
export function CarteBadge({ resultat, gerer = false, suivant }: { resultat: ResultatBadge; gerer?: boolean; suivant?: () => void }) {
  const [r, setR] = useState(resultat);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, demarrer] = useTransition();
  const b = r.badge;
  const changer = (actif: boolean) =>
    demarrer(async () => {
      setR(await changerBadge(b!.jeton, actif));
      setConfirmer(false);
    });
  return (
    <div className={`scan-res ${b && r.valide ? "s-ok" : "s-refus"}`} role="status">
      <div className="scan-verdict">{!b ? "Badge refusé" : r.valide ? "Entrée gratuite ✓" : "Badge non valide"}</div>
      {b ? (
        <>
          <p className="scan-msg"><b style={{ fontSize: "1.3rem" }}>Président d&apos;équipe</b></p>
          {b.logo_url && <img src={b.logo_url} alt="" style={{ width: 110, height: 110, objectFit: "contain", borderRadius: 12, background: "#fff" }} />}
          <dl className="scan-infos">
            <div><dt>Équipe</dt><dd>{b.club}</dd></div>
            {b.poule && <div><dt>Poule</dt><dd>{b.poule}</dd></div>}
          </dl>
          {r.valide ? (
            <p className="scan-msg">Le président de cette équipe entre gratuitement : faire entrer 1 personne.</p>
          ) : (
            <p className="scan-msg err">{b.disqualifie ? "Ce club a été disqualifié : pas d'entrée gratuite." : "Ce badge a été désactivé (perdu ou volé) : pas d'entrée gratuite."}</p>
          )}
        </>
      ) : (
        <p className="scan-msg err">{r.erreur}</p>
      )}
      {b && r.erreur && <p className="scan-msg err">{r.erreur}</p>}
      {suivant && <button type="button" className="btn primary scan-gros" onClick={suivant}>Scanner le suivant</button>}
      {gerer && b && (
        b.actif ? (
          confirmer ? (
            <div className="scan-annuler">
              <p>Désactiver ce badge ? Il ne donnera plus l&apos;entrée gratuite (badge perdu ou volé).</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <button type="button" className="btn sm form-del-btn" disabled={envoi} onClick={() => changer(false)}>Oui, désactiver</button>
                <button type="button" className="btn line sm" onClick={() => setConfirmer(false)}>Non</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn line sm scan-lien" onClick={() => setConfirmer(true)}>Badge perdu : le désactiver</button>
          )
        ) : (
          <button type="button" className="btn line sm" disabled={envoi} onClick={() => changer(true)}>Réactiver ce badge</button>
        )
      )}
    </div>
  );
}
