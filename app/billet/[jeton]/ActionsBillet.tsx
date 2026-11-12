"use client";

import { useEffect, useState } from "react";
import { garderBillet, type BilletGarde } from "@/lib/mesBillets";

/** Enregistrer le billet en image, se l'envoyer sur WhatsApp, et le garder dans « Mes billets ». */
export function ActionsBillet({ lien, billet }: { lien: string; billet: BilletGarde }) {
  const [etat, setEtat] = useState<"" | "image" | "erreur">("");
  useEffect(() => garderBillet(billet), [billet]);

  const message = `Mon billet Bêgnanan Daloa Cup (${billet.reference}) : ${lien}`;
  return (
    <div className="billet-actions">
      <button
        type="button"
        className="btn primary"
        disabled={etat === "image"}
        onClick={async () => {
          setEtat("image");
          try {
            const { toPng } = await import("html-to-image");
            const el = document.getElementById("billet");
            if (!el) throw new Error("billet absent");
            const image = await toPng(el, { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true });
            const a = document.createElement("a");
            a.href = image;
            a.download = `billet-${billet.reference}.png`;
            a.click();
            setEtat("");
          } catch (e) {
            console.error(e);
            setEtat("erreur");
          }
        }}
      >
        {etat === "image" ? "Préparation…" : "Enregistrer le billet (image)"}
      </button>
      <a className="btn wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        M&apos;envoyer le lien sur WhatsApp
      </a>
      {etat === "erreur" && <p className="small">L&apos;image n&apos;a pas pu être créée : faites une capture d&apos;écran du billet.</p>}
    </div>
  );
}
