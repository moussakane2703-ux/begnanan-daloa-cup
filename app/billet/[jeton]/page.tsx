import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { contenuQr, estJeton, libelleStatut, type StatutCommande } from "@/lib/billet";
import { fcfa, heure, jourCourt } from "@/lib/format";
import { adresseDuSite } from "@/lib/site";
import { createPublicClient, supabaseConfigured } from "@/lib/supabase/server";
import { ActionsBillet } from "./ActionsBillet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon billet", robots: { index: false, follow: false } };

interface Billet {
  reference: string;
  statut: StatutCommande;
  quantite: number;
  entrees_validees: number;
  prix_unitaire_fcfa: number;
  total_fcfa: number;
  nom_acheteur: string;
  categorie: string;
  date_heure: string;
  terrain: string;
  phase: string;
  domicile: string | null;
  exterieur: string | null;
}

/** Billet du supporter : le lien contient un jeton secret, impossible à deviner ; le QR code porte ce jeton. */
export default async function PageBillet({ params, searchParams }: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const { jeton } = await params;
  const { nouveau } = await searchParams;
  if (!supabaseConfigured || !estJeton(jeton)) notFound();
  const { data } = await createPublicClient().rpc("billet_par_jeton", { p_jeton: jeton.toLowerCase() });
  const b = (data as Billet[] | null)?.[0];
  if (!b) notFound();

  const lien = `${await adresseDuSite()}/billet/${jeton.toLowerCase()}`;
  // Le QR code ne contient pas le lien : seul le scanner de l'appareil autorisé sait le lire.
  const qr = await QRCode.toString(contenuQr(jeton), { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  const match = `${b.domicile ?? "À désigner"} – ${b.exterieur ?? "À désigner"}`;
  const quand = `${jourCourt(b.date_heure)} à ${heure(b.date_heure)}`;
  const annule = b.statut === "annulée" || b.statut === "échouée";
  const utilise = b.entrees_validees >= b.quantite;

  return (
    <section className="band">
      <div className="wrap billet-page">
        {nouveau && !annule && (
          <div className="billet-ok" role="status">
            <b>Réservation confirmée.</b> Gardez ce billet : enregistrez l&apos;image ou envoyez-vous le lien sur WhatsApp.
          </div>
        )}

        <article className={`billet${annule ? " annule" : ""}`} id="billet">
          <header className="billet-tete">
            <img src="/logo-small.webp" alt="" width={44} height={44} />
            <div>
              <b>Bêgnanan Daloa Cup</b>
              <span>Billet d&apos;entrée · {b.phase}</span>
            </div>
          </header>
          <div className="billet-match">
            <h1>{match}</h1>
            <p>{quand}{b.terrain ? ` · ${b.terrain}` : ""}</p>
          </div>
          <div className="billet-qr" aria-label="QR code du billet" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="billet-ref mono">{b.reference}</div>
          <dl className="billet-infos">
            <div><dt>Nom</dt><dd>{b.nom_acheteur}</dd></div>
            <div><dt>Catégorie</dt><dd>{b.categorie}</dd></div>
            <div><dt>Billets</dt><dd className="num">{b.quantite} × {fcfa(b.prix_unitaire_fcfa)}</dd></div>
            <div><dt>{b.statut === "payée" ? "Payé" : "À payer sur place"}</dt><dd className="num"><b>{fcfa(b.total_fcfa)}</b></dd></div>
          </dl>
          <div className={`billet-statut s-${annule ? "annule" : utilise ? "utilise" : b.statut === "payée" ? "paye" : "attente"}`}>
            {annule ? "Billet annulé" : utilise ? `Utilisé · ${b.entrees_validees}/${b.quantite} entrée${b.quantite > 1 ? "s" : ""}` : b.statut === "payée" ? `Payé · ${b.entrees_validees}/${b.quantite} entrée${b.quantite > 1 ? "s" : ""}` : libelleStatut(b.statut)}
          </div>
        </article>

        {!annule && (
          <ActionsBillet
            lien={lien}
            billet={{ jeton: jeton.toLowerCase(), reference: b.reference, match: `${quand} · ${match}`, date: b.date_heure }}
          />
        )}

        <div className="card billet-aide">
          <h3 style={{ marginBottom: 8 }}>Le jour du match</h3>
          <ol className="small">
            <li>Présentez ce QR code à l&apos;entrée du terrain (sur le téléphone ou imprimé).</li>
            <li>L&apos;équipe le scanne et vous payez {fcfa(b.total_fcfa)} sur place.</li>
            <li>Chaque billet ne sert qu&apos;une fois{b.quantite > 1 ? ` (${b.quantite} personnes)` : ""}.</li>
          </ol>
          <p className="small" style={{ marginTop: 8 }}>Ne partagez pas ce billet : la première personne qui le présente entre.</p>
        </div>
      </div>
    </section>
  );
}
