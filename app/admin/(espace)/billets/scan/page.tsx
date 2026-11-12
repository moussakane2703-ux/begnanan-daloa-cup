import Link from "next/link";
import { exigerAcces } from "@/lib/auth";
import { Scanner } from "./Scanner";

export const metadata = { title: "Scanner les billets" };

/** Contrôle à l'entrée du terrain, pensé pour le téléphone : scanner, encaisser, faire entrer. */
export default async function ScanBillets() {
  await exigerAcces("billets");
  return (
    <div className="scan-page">
      <div className="scan-tete">
        <h3>Contrôle à l&apos;entrée</h3>
        <Link className="btn line sm" href="/admin/billets">Réservations</Link>
      </div>
      <Scanner />
    </div>
  );
}
