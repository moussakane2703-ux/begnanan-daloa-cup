import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarteActualite } from "@/components/CarteActualite";
import { Crest } from "@/components/Crest";
import { MatchCard } from "@/components/MatchCard";
import { getActualitesClubs, getClubs, getEffectif, getMatchs, parId } from "@/lib/data";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const club = (await getClubs()).find((c) => c.id === id);
  return club ? { title: club.nom, description: club.presentation ?? `Actualités, effectif et matchs de ${club.nom} au BÊGNANAN DALOA CUP.` } : {};
}

export default async function FicheClub({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clubs, matchs] = await Promise.all([getClubs(), getMatchs()]);
  const club = clubs.find((c) => c.id === id);
  if (!club) notFound();
  const [actualites, effectif] = await Promise.all([getActualitesClubs(30, id), getEffectif(id)]);
  const index = parId(clubs);
  const siens = matchs.filter((m) => m.club_domicile === id || m.club_exterieur === id);

  return (
    <section className="band">
      <div className="wrap">
        <Link href="/equipes" className="small">← Tous les clubs</Link>
        <div className="head" style={{ alignItems: "center", marginTop: 12 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Crest club={club} size="crest" />
            <div>
              <div className="eyebrow">{club.poule ? `Poule ${club.poule}` : "Poule à tirer"}{club.quartier ? ` · ${club.quartier}` : ""}</div>
              <h1 className="h2">{club.nom}</h1>
            </div>
          </div>
        </div>
        {club.presentation && <p style={{ maxWidth: "65ch", marginBottom: 24, whiteSpace: "pre-line" }}>{club.presentation}</p>}
        <nav className="club-sommaire">
          <a className="btn line sm" href="#actualites">Actualités</a>
          <a className="btn line sm" href="#effectif">Effectif</a>
          <a className="btn line sm" href="#matchs">Matchs</a>
        </nav>

        <h3 id="actualites" className="club-titre">Actualités du club</h3>
        {actualites.length ? (
          <div className="grid g3">{actualites.map((a) => <CarteActualite key={a.id} actu={a} club={club} />)}</div>
        ) : (
          <p className="small">Le club n&apos;a encore rien publié. Revenez bientôt : entraînements, joueurs, coulisses…</p>
        )}

        <h3 id="effectif" className="club-titre">Effectif</h3>
        {effectif.length ? (
          <div className="grid g4 effectif">
            {effectif.map((j) => (
              <div key={j.id} className="card joueur-public">
                {j.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={j.photo_url} alt="" loading="lazy" />
                ) : (
                  <div className="joueur-sans-photo" style={{ background: club.couleur }}>{j.numero_maillot ?? club.sigle}</div>
                )}
                <b>{j.prenoms} {j.nom}</b>
                <span className="small">{[j.numero_maillot ? `N° ${j.numero_maillot}` : null, j.poste].filter(Boolean).join(" · ") || " "}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="small">L&apos;effectif s&apos;affiche dès que les licences des joueurs sont validées par le comité.</p>
        )}

        <h3 id="matchs" className="club-titre">Matchs</h3>
        {siens.length ? (
          <div className="grid g2">{siens.map((m) => <MatchCard key={m.id} match={m} clubs={index} />)}</div>
        ) : (
          <p className="small">Aucun match programmé pour le moment.</p>
        )}
      </div>
    </section>
  );
}
