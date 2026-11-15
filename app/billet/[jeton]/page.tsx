import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { contenuQr, estJeton, referenceBillet, type StatutBillet } from "@/lib/billet";
import { fcfa, heure, jourCourt } from "@/lib/format";
import { adresseDuSite } from "@/lib/site";
import { createPublicClient, supabaseConfigured } from "@/lib/supabase/server";
import { ActionsBillet, GarderBillet } from "./ActionsBillet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon billet", robots: { index: false, follow: false } };

interface Billet {
  groupe: boolean;
  reference: string;
  numero: number;
  quantite: number;
  jeton: string;
  statut: StatutBillet;
  prix_unitaire_fcfa: number;
  nom_acheteur: string;
  categorie: string;
  date_heure: string;
  terrain: string;
  phase: string;
  domicile: string | null;
  exterieur: string | null;
}

const LIBELLE: Record<StatutBillet, string> = {
  "à payer": "Réservé · à payer sur place",
  payé: "Payé · pas encore entré",
  utilisé: "Utilisé",
  annulé: "Billet annulé",
};
const CLASSE: Record<StatutBillet, string> = { "à payer": "attente", payé: "paye", utilisé: "utilise", annulé: "annule" };

/**
 * Billets du supporter. Le lien de la réservation montre tous ses billets ; chaque billet a son
 * propre lien et son propre QR code, à donner à la personne qui l'utilisera. Un billet = une entrée.
 */
export default async function PageBillet({ params, searchParams }: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const { jeton } = await params;
  const { nouveau } = await searchParams;
  if (!supabaseConfigured || !estJeton(jeton)) notFound();
  const { data } = await createPublicClient().rpc("billets_par_jeton", { p_jeton: jeton.toLowerCase() });
  const billets = (data as Billet[] | null) ?? [];
  const b = billets[0];
  if (!b) notFound();

  const base = await adresseDuSite();
  const match = `${b.domicile ?? "À désigner"} – ${b.exterieur ?? "À désigner"}`;
  const quand = `${jourCourt(b.date_heure)} à ${heure(b.date_heure)}`;
  const groupe = b.groupe && b.quantite > 1;
  // Le QR code ne contient pas de lien : seul le scanner de l'espace pro sait le lire.
  const qrs = await Promise.all(
    billets.map((x) => QRCode.toString(contenuQr(x.jeton), { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })),
  );

  return (
    <section className="band">
      <div className="wrap billet-page">
        {b.groupe && <GarderBillet billet={{ jeton: jeton.toLowerCase(), reference: b.reference, match: `${quand} · ${match}`, date: b.date_heure }} />}
        {nouveau && b.statut !== "annulé" && (
          <div className="billet-ok" role="status">
            <b>Réservation confirmée.</b> {groupe ? `Vous avez ${b.quantite} billets, chacun avec son propre QR code.` : "Gardez ce billet : enregistrez l'image ou envoyez-vous le lien."}
          </div>
        )}
        {groupe && (
          <div className="card billet-aide">
            <h3 style={{ marginBottom: 8 }}>{b.quantite} billets · {fcfa(b.prix_unitaire_fcfa * b.quantite)} à payer sur place</h3>
            <p className="small">
              Chaque billet fait entrer <b>une seule personne</b> et se scanne séparément à l&apos;entrée. Pour les personnes qui viennent sans vous,
              envoyez-leur leur billet avec le bouton WhatsApp sous chaque billet : chacune paie {fcfa(b.prix_unitaire_fcfa)} à l&apos;entrée.
            </p>
          </div>
        )}

        {billets.map((x, i) => {
          const ref = referenceBillet(x.reference, x.numero, x.quantite);
          return (
            <div key={x.jeton} className="billet-bloc">
              <article className={`billet${x.statut === "annulé" ? " annule" : ""}`} id={`billet-${x.numero}`}>
                <header className="billet-tete">
                  <img src="/logo-small.webp" alt="" width={44} height={44} />
                  <div>
                    <b>Bêgnanan Daloa Cup</b>
                    <span>Billet d&apos;entrée · {x.phase}{x.quantite > 1 ? ` · ${x.numero}/${x.quantite}` : ""}</span>
                  </div>
                </header>
                <div className="billet-match">
                  <h1>{match}</h1>
                  <p>{quand}{x.terrain ? ` · ${x.terrain}` : ""}</p>
                </div>
                <div className="billet-qr" aria-label={`QR code du billet ${ref}`} dangerouslySetInnerHTML={{ __html: qrs[i] }} />
                <div className="billet-ref mono">{ref}</div>
                <dl className="billet-infos">
                  <div><dt>Réservé par</dt><dd>{x.nom_acheteur}</dd></div>
                  <div><dt>Catégorie</dt><dd>{x.categorie}</dd></div>
                  <div><dt>Entrée</dt><dd>1 personne</dd></div>
                  <div><dt>{x.statut === "à payer" ? "À payer sur place" : "Prix"}</dt><dd className="num"><b>{fcfa(x.prix_unitaire_fcfa)}</b></dd></div>
                </dl>
                <div className={`billet-statut s-${CLASSE[x.statut]}`}>{LIBELLE[x.statut]}</div>
              </article>
              {x.statut !== "annulé" && x.statut !== "utilisé" && (
                <ActionsBillet
                  lien={`${base}/billet/${x.jeton}`}
                  cible={`billet-${x.numero}`}
                  reference={ref}
                  partage={groupe ? "Envoyer ce billet sur WhatsApp" : "M'envoyer le billet sur WhatsApp"}
                />
              )}
            </div>
          );
        })}

        <div className="card billet-aide">
          <h3 style={{ marginBottom: 8 }}>Le jour du match</h3>
          <ol className="small">
            <li>Présentez le QR code à l&apos;entrée du terrain (sur le téléphone ou imprimé).</li>
            <li>L&apos;équipe le scanne et vous payez {fcfa(b.prix_unitaire_fcfa)} par billet sur place.</li>
            <li>Un billet = une personne, une seule fois.</li>
          </ol>
          <p className="small" style={{ marginTop: 8 }}>Ne publiez pas votre billet : la première personne qui le présente entre.</p>
        </div>
      </div>
    </section>
  );
}
