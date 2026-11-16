"use client";

import { useEffect, useRef, useState } from "react";

export const LARGEUR = 1080;
export const HAUTEUR = 1350;

/**
 * Aperçu d'une affiche (1080 × 1350, format WhatsApp et réseaux sociaux) réduit à la largeur de
 * l'écran, avec l'enregistrement en image et le partage direct depuis le téléphone.
 */
export function ExportAffiche({ fichier, message, children }: { fichier: string; message: string; children: React.ReactNode }) {
  const cadre = useRef<HTMLDivElement>(null);
  const affiche = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(0.33);
  const [etat, setEtat] = useState<"" | "image" | "erreur">("");

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const ajuster = () => setEchelle(Math.min(1, el.clientWidth / LARGEUR));
    ajuster();
    const obs = new ResizeObserver(ajuster);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  async function image() {
    const { toBlob } = await import("html-to-image");
    if (!affiche.current) throw new Error("affiche absente");
    // Les images de l'affiche doivent être chargées avant la photo.
    await Promise.all([...affiche.current.querySelectorAll("img")].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    const blob = await toBlob(affiche.current, { width: LARGEUR, height: HAUTEUR, pixelRatio: 1, cacheBust: true, backgroundColor: "#062e11" });
    if (!blob) throw new Error("image vide");
    return new File([blob], fichier, { type: "image/png" });
  }

  async function agir(partager: boolean) {
    setEtat("image");
    try {
      const f = await image();
      if (partager && navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], text: message }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = fichier;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
      setEtat("");
    } catch (e) {
      console.error(e);
      setEtat("erreur");
    }
  }

  return (
    <div className="aff-export">
      <div className="aff-actions">
        <button type="button" className="btn wa" disabled={etat === "image"} onClick={() => agir(true)}>
          {etat === "image" ? "Préparation…" : "Partager (WhatsApp…)"}
        </button>
        <button type="button" className="btn line" disabled={etat === "image"} onClick={() => agir(false)}>Enregistrer l&apos;image</button>
      </div>
      {etat === "erreur" && <p className="small">L&apos;image n&apos;a pas pu être créée : faites une capture d&apos;écran de l&apos;affiche.</p>}
      <div ref={cadre} className="aff-cadre" style={{ height: HAUTEUR * echelle }}>
        <div style={{ transform: `scale(${echelle})`, transformOrigin: "top left", width: LARGEUR, height: HAUTEUR }}>
          <div ref={affiche} style={{ width: LARGEUR, height: HAUTEUR }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
