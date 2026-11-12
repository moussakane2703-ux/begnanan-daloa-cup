"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { lireMesBillets, type BilletGarde } from "@/lib/mesBillets";

/** Billets réservés depuis ce téléphone (gardés dans le navigateur), pour les rouvrir vite au terrain. */
export function MesBillets() {
  const [billets, setBillets] = useState<BilletGarde[]>([]);
  useEffect(() => setBillets(lireMesBillets()), []);
  if (!billets.length) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 10 }}>Mes billets</h3>
      <ul className="mes-billets">
        {billets.map((b) => (
          <li key={b.jeton}>
            <Link href={`/billet/${b.jeton}`}><b className="mono">{b.reference}</b> <span className="small">{b.match}</span></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
