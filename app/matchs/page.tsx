import type { Metadata } from "next";
import { getClubs, getMatchs } from "@/lib/data";
import { ListeMatchs } from "./ListeMatchs";
import { TableauFinal } from "@/components/TableauFinal";

export const revalidate = 30;
export const metadata: Metadata = { title: "Calendrier et résultats" };

export default async function Matchs() {
  const [matchs, clubs] = await Promise.all([getMatchs(), getClubs()]);
  return (
    <section className="band">
      <div className="wrap">
        <div className="head">
          <div>
            <div className="eyebrow">Calendrier et résultats</div>
            <h1 className="h2">Les rencontres</h1>
            <p>Filtrez par poule, équipe ou statut.</p>
          </div>
        </div>
        {matchs.length ? (
          <ListeMatchs matchs={matchs} clubs={clubs} />
        ) : (
          <div className="card vide"><h3>Calendrier à venir</h3><p className="small">Les matchs seront publiés après le tirage au sort.</p></div>
        )}
      </div>
      <div className="wrap" id="phases-finales" style={{ marginTop: 56, scrollMarginTop: 80 }}>
        <div className="head">
          <div>
            <div className="eyebrow">Du 17 décembre au 1er janvier</div>
            <h2 className="h2">Tableau des phases finales</h2>
            <p>Les 2 premiers de chaque poule sont qualifiés pour les 8es de finale. Un 1er et un 2e de la même poule ne peuvent se retrouver qu&apos;en finale.</p>
          </div>
        </div>
        <TableauFinal />
        <p className="small" style={{ marginTop: 12 }}>
          <a href="/calendrier/tableau-phases-finales.jpg" download>Télécharger l&apos;affiche du tableau (JPG)</a>
        </p>
      </div>
    </section>
  );
}
