"use client";

import { useState } from "react";

const FORMATS = [
  { format: "", titre: "Live horizontal", detail: "Facebook, YouTube : score en haut à gauche, annonces des buts et cartons, logos des partenaires." },
  { format: "vertical", titre: "Live vertical", detail: "TikTok, stories Facebook et Instagram : score en haut au centre." },
  { format: "plein", titre: "Écran plein", detail: "Avant le match, à la mi-temps et à la fin : affiche du match, buteurs et partenaires." },
];

/**
 * Adresses du tableau d'affichage des lives, à coller dans OBS (source navigateur) ou dans
 * Prism Live Studio (widget web). « Match en cours » suit tout seul les matchs de la journée.
 */
export function LiensLive({ site, matchId, matchNom }: { site: string; matchId?: string; matchNom?: string }) {
  const [cible, setCible] = useState<"auto" | "match">("auto");
  const [vert, setVert] = useState(false);
  const [copie, setCopie] = useState<string | null>(null);

  const adresse = (format: string) => {
    const p = new URLSearchParams();
    if (cible === "match" && matchId) p.set("match", matchId);
    if (format) p.set("format", format);
    if (vert && format !== "plein") p.set("fond", "vert");
    const q = p.toString();
    return `${site}/live${q ? `?${q}` : ""}`;
  };
  const copier = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopie(url);
      setTimeout(() => setCopie(null), 2000);
    }).catch(() => {});
  };

  return (
    <details className="card">
      <summary><b>Tableau d&apos;affichage des lives</b> <span className="small">score, chrono et buts par-dessus la vidéo du live</span></summary>
      <p className="small" style={{ margin: "10px 0" }}>
        Tout ce qui est saisi ici (coup d&apos;envoi, chrono, buts, cartons, tirs au but) s&apos;affiche dans le live en quelques secondes.
        Dans <b>OBS</b> : Sources → + → Navigateur, coller l&apos;adresse, largeur 1920 et hauteur 1080 (1080 × 1920 pour le vertical).
        Sur téléphone, dans <b>Prism Live Studio</b> : Widgets → Web, coller l&apos;adresse.
      </p>
      <div className="form-row" style={{ marginTop: 0, flexWrap: "wrap" }}>
        {matchId && (
          <label className="field" style={{ minWidth: 220 }}>Match affiché
            <select value={cible} onChange={(e) => setCible(e.target.value as "auto" | "match")}>
              <option value="auto">Le match en cours (suit la journée)</option>
              <option value="match">Seulement {matchNom ?? "ce match"}</option>
            </select>
          </label>
        )}
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={vert} onChange={(e) => setVert(e.target.checked)} />
          <span className="small">Fond vert à détourer (appli sans transparence)</span>
        </label>
      </div>
      <div className="adm-list" style={{ marginTop: 10 }}>
        {FORMATS.map((f) => {
          const url = adresse(f.format);
          return (
            <div key={f.titre} className="adm-item" style={{ display: "grid", gap: 6 }}>
              <div><b>{f.titre}</b> <span className="small">· {f.detail}</span></div>
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: "var(--f-mono)", fontSize: ".8rem" }} />
              <div className="form-row" style={{ marginTop: 0 }}>
                <button type="button" className="btn sm" onClick={() => copier(url)}>{copie === url ? "Copié ✓" : "Copier l'adresse"}</button>
                <a className="btn line sm" href={url} target="_blank" rel="noopener">Ouvrir</a>
                <a className="btn line sm" href={`${site}/live?demo=1${f.format ? `&format=${f.format}` : ""}`} target="_blank" rel="noopener">Essai (match fictif)</a>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
