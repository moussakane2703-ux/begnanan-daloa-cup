"use client";

import { useEffect, useState } from "react";
import { garderBillet, type BilletGarde } from "@/lib/mesBillets";

/** Garde la réservation dans « Mes billets » sur ce téléphone. */
export function GarderBillet({ billet }: { billet: BilletGarde }) {
  useEffect(() => garderBillet(billet), [billet]);
  return null;
}

/** Enregistrer UN billet en image, ou l'envoyer sur WhatsApp à la personne qui l'utilisera. */
export function ActionsBillet({ lien, cible, reference, partage }: { lien: string; cible: string; reference: string; partage: string }) {
  const [etat, setEtat] = useState<"" | "image" | "erreur">("");
  const message = `Ton billet Bêgnanan Daloa Cup (${reference}) : ${lien}\nMontre le QR code à l'entrée du terrain.`;
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
            const el = document.getElementById(cible);
            if (!el) throw new Error("billet absent");
            const image = await toPng(el, { pixelRatio: 3, backgroundColor: "#ffffff", cacheBust: true });
            const a = document.createElement("a");
            a.href = image;
            a.download = `billet-${reference}.png`;
            a.click();
            setEtat("");
          } catch (e) {
            console.error(e);
            setEtat("erreur");
          }
        }}
      >
        {etat === "image" ? "Préparation…" : "Enregistrer ce billet (image)"}
      </button>
      <a className="btn wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        {partage}
      </a>
      {etat === "erreur" && <p className="small">L&apos;image n&apos;a pas pu être créée : faites une capture d&apos;écran du billet.</p>}
    </div>
  );
}
