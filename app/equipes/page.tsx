import type { Metadata } from "next";
import Link from "next/link";
import { CarteActualite } from "@/components/CarteActualite";
import { Crest } from "@/components/Crest";
import { getActualitesClubs, getClubs, getTournoi, parId } from "@/lib/data";

export const revalidate = 30;
export const metadata: Metadata = {
  title: "Clubs",
  description: "Les clubs du BÊGNANAN DALOA CUP : leurs actualités, leurs joueurs et leurs matchs.",
};

export default async function Equipes() {
  const [clubs, tournoi, actualites] = await Promise.all([getClubs(), getTournoi(), getActualitesClubs(6)]);
  const index = parId(clubs);
  return (
    <section className="band">
      <div className="wrap">
        <div className="head">
          <div>
            <div className="eyebrow">Espace des clubs</div>
            <h1 className="h2">Les clubs engagés</h1>
            <p>Choisissez un club pour voir ses actualités, ses joueurs et ses matchs. {clubs.length} club{clubs.length > 1 ? "s" : ""} inscrit{clubs.length > 1 ? "s" : ""} sur {tournoi.capacite_clubs} places.</p>
          </div>
          <Link className="btn gold sm" href="/inscription-club">Inscrire mon club</Link>
        </div>
        {clubs.length ? (
          <div className="grid g4">
            {clubs.map((c) => (
              <Link key={c.id} href={`/equipes/${c.id}`} className="card team reveal">
                <Crest club={c} size="crest" />
                <b>{c.nom}</b>
                <span className="small">{c.poule ? `Poule ${c.poule}` : "Poule à tirer"}{c.quartier ? ` · ${c.quartier}` : ""}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card vide"><h3>Inscriptions en cours</h3><p className="small">Les clubs apparaîtront ici dès leur validation par le comité.</p></div>
        )}
        {actualites.length > 0 && (
          <>
            <h2 className="club-titre">Dernières actualités des clubs</h2>
            <div className="grid g3">{actualites.map((a) => <CarteActualite key={a.id} actu={a} club={index.get(a.club_id)} />)}</div>
          </>
        )}
      </div>
    </section>
  );
}
