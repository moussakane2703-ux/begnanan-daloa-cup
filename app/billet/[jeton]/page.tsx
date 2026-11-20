import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { contenuQr, estJeton, referenceBillet, type StatutBillet } from "@/lib/billet";
import { fcfa, heure, jourCourt } from "@/lib/format";
import { adresseDuSite } from "@/lib/site";
import { createPublicClient, createServiceClient, supabaseConfigured } from "@/lib/supabase/server";
import { enregistrerSiPayee, lireSessionWave, waveConfigure } from "@/lib/wave";
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
  moyen_paiement: string | null;
  /** Lien de paiement Wave, tant que la session est ouverte et la réservation non payée. */
  wave_lien: string | null;
}

const LIBELLE: Record<StatutBillet, string> = {
  "à payer": "Réservé · à payer sur place",
  "paiement en attente": "En attente du paiement Wave",
  payé: "Payé · pas encore entré",
  utilisé: "Utilisé",
  annulé: "Billet annulé",
};
const CLASSE: Record<StatutBillet, string> = {
  "à payer": "attente", "paiement en attente": "attente", payé: "paye", utilisé: "utilise", annulé: "annule",
};

async function lire(jeton: string): Promise<Billet[]> {
  const db = createPublicClient();
  const [{ data }, { data: p }] = await Promise.all([
    db.rpc("billets_par_jeton", { p_jeton: jeton }),
    db.rpc("paiement_par_jeton", { p_jeton: jeton }),
  ]);
  const paiement = (p as { moyen_paiement: string | null; wave_lien: string | null }[] | null)?.[0];
  return ((data as Omit<Billet, "moyen_paiement" | "wave_lien">[] | null) ?? []).map((b) => ({
    ...b,
    moyen_paiement: paiement?.moyen_paiement ?? null,
    wave_lien: paiement?.wave_lien ?? null,
  }));
}

/**
 * Paiement Wave pas encore enregistré : on demande directement à Wave où en est la session (le webhook
 * peut arriver après le supporter, ou ne pas être encore branché). Renvoie true si le paiement vient d'être enregistré.
 */
async function verifierAupresDeWave(jeton: string) {
  if (!waveConfigure) return false;
  try {
    const { data: session } = await createServiceClient().rpc("session_wave_par_jeton", { p_jeton: jeton });
    if (!session) return false;
    return await enregistrerSiPayee(await lireSessionWave(session as string));
  } catch (e) {
    console.error("Vérification Wave", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Billets du supporter. Le lien de la réservation montre tous ses billets ; chaque billet a son
 * propre lien et son propre QR code, à donner à la personne qui l'utilisera. Un billet = une entrée.
 */
export default async function PageBillet({ params, searchParams }: {
  params: Promise<{ jeton: string }>;
  searchParams: Promise<{ nouveau?: string; paiement?: string }>;
}) {
  const { jeton: brut } = await params;
  const { nouveau, paiement } = await searchParams;
  if (!supabaseConfigured || !estJeton(brut)) notFound();
  const jeton = brut.toLowerCase();
  let billets = await lire(jeton);
  if (!billets[0]) notFound();
  const enAttenteWave = billets.some((x) => x.statut === "paiement en attente");
  if ((enAttenteWave || (paiement === "ok" && billets[0].moyen_paiement === "wave" && billets[0].statut === "annulé")) && (await verifierAupresDeWave(jeton))) {
    billets = await lire(jeton);
  }
  const b = billets[0];
  const wave = b.moyen_paiement === "wave";
  const attente = b.statut === "paiement en attente";

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
        {b.groupe && <GarderBillet billet={{ jeton, reference: b.reference, match: `${quand} · ${match}`, date: b.date_heure }} />}
        {wave && attente && (
          <div className="card billet-aide" role="status">
            <h3 style={{ marginBottom: 8 }}>
              {paiement === "erreur" ? "Le paiement n'a pas abouti" : paiement === "ok" ? "Paiement en cours de confirmation" : "Paiement Wave en attente"}
            </h3>
            <p className="small" style={{ marginBottom: 12 }}>
              {paiement === "ok"
                ? "Wave n'a pas encore confirmé votre paiement. Patientez quelques secondes puis actualisez la page : vos billets avec QR code s'afficheront ici."
                : `Vos places sont gardées le temps du paiement (30 minutes). Payez ${fcfa(b.prix_unitaire_fcfa * b.quantite)} avec Wave pour recevoir vos billets avec QR code.`}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {b.wave_lien && <a className="btn primary" href={b.wave_lien}>Payer {fcfa(b.prix_unitaire_fcfa * b.quantite)} avec Wave</a>}
              <a className="btn line" href={`/billet/${jeton}`}>J&apos;ai payé : actualiser</a>
            </div>
          </div>
        )}
        {wave && b.statut === "annulé" && (
          <div className="card billet-aide" role="status">
            <h3 style={{ marginBottom: 8 }}>Paiement non abouti</h3>
            <p className="small" style={{ marginBottom: 12 }}>
              Wave n&apos;a pas reçu de paiement pour cette réservation dans les 30 minutes : ces billets ne sont pas valables et les places ont été libérées.
              Si vous avez été débité, gardez le reçu Wave et contactez le comité avec la référence {b.reference}.
            </p>
            <a className="btn primary" href="/billetterie">Réserver à nouveau</a>
          </div>
        )}
        {wave && paiement === "ok" && b.statut === "payé" && (
          <div className="billet-ok" role="status">
            <b>Paiement Wave reçu.</b> {groupe ? `Vous avez ${b.quantite} billets, chacun avec son propre QR code.` : "Gardez ce billet : enregistrez l'image ou envoyez-vous le lien."}
          </div>
        )}
        {nouveau && b.statut !== "annulé" && (
          <div className="billet-ok" role="status">
            <b>Réservation confirmée.</b> {groupe ? `Vous avez ${b.quantite} billets, chacun avec son propre QR code.` : "Gardez ce billet : enregistrez l'image ou envoyez-vous le lien."}
          </div>
        )}
        {groupe && (
          <div className="card billet-aide">
            <h3 style={{ marginBottom: 8 }}>
              {b.quantite} billets · {fcfa(b.prix_unitaire_fcfa * b.quantite)} {wave ? (attente ? "à payer avec Wave" : "payés avec Wave") : "à payer sur place"}
            </h3>
            <p className="small">
              Chaque billet fait entrer <b>une seule personne</b> et se scanne séparément à l&apos;entrée. Pour les personnes qui viennent sans vous,
              envoyez-leur leur billet avec le bouton WhatsApp sous chaque billet{wave ? "." : ` : chacune paie ${fcfa(b.prix_unitaire_fcfa)} à l'entrée.`}
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
                {x.statut === "paiement en attente" ? (
                  <div className="billet-qr billet-qr-attente small">Le QR code s&apos;affiche dès que Wave confirme le paiement.</div>
                ) : (
                  <div className="billet-qr" aria-label={`QR code du billet ${ref}`} dangerouslySetInnerHTML={{ __html: qrs[i] }} />
                )}
                <div className="billet-ref mono">{ref}</div>
                <dl className="billet-infos">
                  <div><dt>Réservé par</dt><dd>{x.nom_acheteur}</dd></div>
                  <div><dt>Catégorie</dt><dd>{x.categorie}</dd></div>
                  <div><dt>Entrée</dt><dd>1 personne</dd></div>
                  <div><dt>{x.statut === "à payer" ? "À payer sur place" : x.statut === "paiement en attente" ? "À payer avec Wave" : wave && x.statut !== "annulé" ? "Payé avec Wave" : "Prix"}</dt><dd className="num"><b>{fcfa(x.prix_unitaire_fcfa)}</b></dd></div>
                </dl>
                <div className={`billet-statut s-${CLASSE[x.statut]}`}>{LIBELLE[x.statut]}</div>
              </article>
              {(x.statut === "à payer" || x.statut === "payé") && (
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
            <li>{wave ? "L'équipe le scanne et vous entrez : le billet est déjà payé avec Wave." : `L'équipe le scanne et vous payez ${fcfa(b.prix_unitaire_fcfa)} par billet sur place.`}</li>
            <li>Un billet = une personne, une seule fois.</li>
          </ol>
          <p className="small" style={{ marginTop: 8 }}>Ne publiez pas votre billet : la première personne qui le présente entre.</p>
        </div>
      </div>
    </section>
  );
}
