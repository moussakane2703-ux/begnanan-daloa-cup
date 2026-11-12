import type { Metadata } from "next";
import { getCategories, getClubs, getMatchs, getPlacesMatchs, parId } from "@/lib/data";
import { fcfa, heure, jourCourt } from "@/lib/format";
import { FormulaireReservation } from "./FormulaireReservation";
import { MesBillets } from "./MesBillets";
import { RetrouverBillet } from "./RetrouverBillet";

export const revalidate = 30;
export const metadata: Metadata = {
  title: "Billetterie",
  description: "Réservez votre place pour le Bêgnanan Daloa Cup : billet avec QR code, paiement sur place à l'entrée du terrain.",
};

const TEINTES = ["var(--pitch)", "var(--info)", "var(--gold)", "#8e3b8e", "var(--earth)"];
// Un match reste réservable jusqu'à 2 heures après son coup d'envoi (retardataires).
const APRES_COUP_ENVOI = 2 * 3600 * 1000;

export default async function Billetterie() {
  const [categories, matchs, clubs, places] = await Promise.all([getCategories(), getMatchs(), getClubs(), getPlacesMatchs()]);
  const index = parId(clubs);
  const maintenant = Date.now();
  const aVenir = matchs.filter(
    (m) => (m.statut === "programmé" || m.statut === "en cours") && new Date(m.date_heure).getTime() + APRES_COUP_ENVOI > maintenant,
  );
  const restantes: Record<string, number> = {};
  for (const p of places) restantes[`${p.match_id}:${p.categorie_id}`] = p.restantes;
  const nomClub = (id: string) => index.get(id)?.nom ?? "À désigner";

  return (
    <section className="band">
      <div className="wrap">
        <div className="head">
          <div>
            <div className="eyebrow">Billetterie</div>
            <h1 className="h2">Réservez votre place</h1>
            <p>Réservez en ligne, gratuitement. Vous recevez un billet avec QR code : montrez-le à l&apos;entrée du terrain, l&apos;équipe le scanne et vous payez sur place.</p>
          </div>
        </div>

        <MesBillets />

        {categories.length && aVenir.length ? (
          <div className="resa-layout">
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Réserver</h3>
              <FormulaireReservation
                matchs={aVenir.map((m) => ({
                  id: m.id,
                  jour: jourCourt(m.date_heure),
                  libelle: `${heure(m.date_heure)} · ${nomClub(m.club_domicile)} – ${nomClub(m.club_exterieur)}${m.terrain ? ` · ${m.terrain}` : ""}`,
                }))}
                categories={categories.map((c) => ({ id: c.id, nom: c.nom, prix: c.prix_fcfa, description: c.description }))}
                places={restantes}
              />
            </div>
            <div className="tk-grid">
              {categories.map((c, i) => (
                <article key={c.id} className="card tk reveal" style={{ "--tier": TEINTES[i % TEINTES.length] } as React.CSSProperties}>
                  <div><span className="eyebrow" style={{ color: "inherit" }}>Catégorie</span><h3>{c.nom}</h3></div>
                  <div className="tk-price num">{c.prix_fcfa.toLocaleString("fr-FR")}<small> FCFA</small></div>
                  {c.description && <p className="small">{c.description}</p>}
                  <p className="small">{c.places_par_match} places par match · à payer sur place</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="card vide">
            <h3>Réservations bientôt ouvertes</h3>
            <p className="small">
              {categories.length ? "Aucun match à venir n'est ouvert à la réservation pour le moment." : "Les catégories de places et les prix seront annoncés très vite."}
              {categories.length ? ` Tarif le plus bas : ${fcfa(Math.min(...categories.map((c) => c.prix_fcfa)))}.` : ""}
            </p>
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Billet perdu ?</h3>
          <p className="small" style={{ marginBottom: 12 }}>Entrez la référence (BDC-…) et le numéro de téléphone donnés à la réservation.</p>
          <RetrouverBillet />
        </div>
      </div>
    </section>
  );
}
