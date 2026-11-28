import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigerAcces, peutVoir } from "@/lib/auth";
import { verifierBadge } from "../actions";
import { CarteBadge } from "../CarteBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vérification de badge", robots: { index: false } };

/**
 * Page ouverte en scannant le QR code d'un badge « Président d'équipe » avec l'appareil photo.
 * Elle est dans l'espace pro : sans compte de l'organisation connecté, le scan mène à la page
 * de connexion et ne montre rien. Le jeton du QR code est secret (table badges_presidents).
 */
export default async function VerifierBadge({ params }: { params: Promise<{ jeton: string }> }) {
  const orga = await exigerAcces();
  if (orga.role === "president") redirect("/espace-club");
  const { jeton } = await params;
  const resultat = await verifierBadge(decodeURIComponent(jeton));
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", display: "grid", gap: 12 }}>
      <CarteBadge resultat={resultat} gerer={peutVoir(orga.role, "cartes")} />
      {peutVoir(orga.role, "billets") && <Link className="btn line sm" href="/admin/billets/scan">Scanner un autre badge ou billet</Link>}
    </div>
  );
}
