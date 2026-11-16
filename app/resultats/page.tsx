import type { Metadata } from "next";
import Link from "next/link";
import { CarteMatch } from "@/components/CarteMatch";
import { TableauxPoules } from "@/components/TableauxPoules";
import { getClassement, getClubs, getCompositions, getMatchs, getTournoi, getTousEvenements, parId } from "@/lib/data";

export const revalidate = 30;
export const metadata: Metadata = {
  title: "Résultats",
  description: "Scores, buteurs, Homme du match et classements des poules du Bêgnanan Daloa Cup, mis à jour pendant les matchs.",
};

/** Résultats : matchs en cours, derniers résultats, prochains matchs et classements des poules. */
export default async function Resultats() {
  const [matchs, clubs, evenements, tournoi, compositions, lignes] = await Promise.all([
    getMatchs(), getClubs(), getTousEvenements(), getTournoi(), getCompositions(), getClassement(),
  ]);
  const index = parId(clubs);
  const miTemps = tournoi.duree_mi_temps ?? null;
  const compos = (id: string) => compositions.filter((c) => c.match_id === id).map((c) => c.club_id);
  const enCours = matchs.filter((m) => m.statut === "en cours");
  const termines = matchs.filter((m) => m.statut === "terminé").reverse();
  const aVenir = matchs.filter((m) => m.statut === "programmé").slice(0, 6);
  const carte = (m: (typeof matchs)[number]) => (
    <CarteMatch key={m.id} match={m} clubs={index} evenements={evenements} miTemps={miTemps} lieu={tournoi.lieu} compositions={compos(m.id)} />
  );

  return (
    <>
      <section className="band">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Résultats</div>
              <h1 className="h2">Les scores du tournoi</h1>
              <p>Score par mi-temps, buteurs et Homme du match. Chaque match a son affiche à partager sur WhatsApp. Un score reste provisoire tant que le comité ne l&apos;a pas validé.</p>
            </div>
          </div>

          {enCours.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.4rem", margin: "4px 0 12px" }}><span className="pill bad"><i className="live-dot" /> En direct</span></h2>
              <div className="grid g2" style={{ marginBottom: 28 }}>{enCours.map(carte)}</div>
            </>
          )}

          <h2 style={{ fontSize: "1.4rem", margin: "4px 0 12px" }}>Derniers résultats</h2>
          {termines.length ? (
            <div className="grid g2">{termines.map(carte)}</div>
          ) : (
            <div className="card vide"><h3>Pas encore de résultat</h3><p className="small">Les scores apparaîtront ici dès le premier match.</p></div>
          )}

          {aVenir.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.4rem", margin: "28px 0 12px" }}>Prochains matchs</h2>
              <div className="grid g2">{aVenir.map(carte)}</div>
              <p style={{ marginTop: 12 }}><Link className="btn line sm" href="/matchs">Tout le calendrier</Link></p>
            </>
          )}
        </div>
      </section>
      <section className="band alt">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Phase de poules</div>
              <h2>Classements</h2>
              <p>Mis à jour automatiquement à chaque résultat validé. Les deux premiers de chaque poule vont en huitièmes de finale.</p>
            </div>
          </div>
          <TableauxPoules lignes={lignes} clubs={index} />
          <p style={{ marginTop: 12 }}><Link className="btn line sm" href="/classements">Buteurs, cartons et tableau final</Link></p>
        </div>
      </section>
    </>
  );
}
