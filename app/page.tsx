import Image from "next/image";
import Link from "next/link";
import { Annonces } from "@/components/Annonces";
import { Countdown } from "@/components/Countdown";
import { CarteActualite } from "@/components/CarteActualite";
import { Crest } from "@/components/Crest";
import { MatchCard } from "@/components/MatchCard";
import { SectionPartenaires } from "@/components/Partenaires";
import { Hero3D } from "@/components/logo3d/Hero3D";
import { getActualitesClubs, getAlertes, getClubs, getMatchs, getPublications, getTournoi, parId } from "@/lib/data";
import { SITE } from "@/lib/site";
import { dateCourte, dateLongue, heure, jourCourt } from "@/lib/format";
import { CartePublication } from "./medias/CartePublication";

export const revalidate = 30;

// Accès directs vers chaque rubrique, pour qu'aucune ne soit cachée sur téléphone.
const RUBRIQUES = [
  ["/matchs", "Matchs", "Calendrier, scores en direct et résultats"],
  ["/medias", "Médias", "Débriefs vidéo, annonces, hommes du match, photos"],
  ["/classements", "Classements", "Les poules mises à jour après chaque match"],
  ["/equipes", "Clubs", "Actualités, joueurs et matchs de chaque club"],
  ["/billetterie", "Billetterie", "Catégories, prix et réservation"],
  ["/infos", "Infos pratiques", "Lieu, itinéraire, horaires et alertes WhatsApp"],
  ["/reglement", "Règlement intérieur", "Les 28 articles du tournoi et le PDF à télécharger"],
  ["/inscription-club", "Présidents de club", "Inscrire son club, ses joueurs et leurs licences"],
  ["/espace-club", "Espace club", "Le président gère son club, ses joueurs et écrit au comité"],
  ["/admin", "Espace pro", "Réservé à l'organisation : comité, billetterie et médias"],
] as const;

export default async function Accueil() {
  const [tournoi, clubsListe, matchs, publications, alertes, actualitesClubs] = await Promise.all([getTournoi(), getClubs(), getMatchs(), getPublications(), getAlertes(3), getActualitesClubs(6)]);
  // Bandeau d'annonces : seulement celles des 4 derniers jours.
  const recentes = alertes.filter((a) => Date.now() - new Date(a.publiee_le).getTime() < 4 * 86_400_000);
  const clubs = parId(clubsListe);
  const prochain = matchs.find((m) => m.statut === "programmé");
  const enDirect = matchs.filter((m) => m.statut === "en cours");
  const recents = matchs.filter((m) => m.statut === "terminé").slice(-3).reverse();
  const carte = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tournoi.lieu}, Côte d'Ivoire`)}`;

  // Fiche de l'événement pour Google (nom, dates, lieu, organisateur).
  const evenement = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: tournoi.nom,
    description: tournoi.accroche,
    sport: "Maracana",
    startDate: tournoi.date_debut,
    endDate: tournoi.date_fin,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: tournoi.lieu, address: { "@type": "PostalAddress", addressLocality: "Daloa", addressCountry: "CI" } },
    image: [`${SITE}/opengraph-image.jpg`, `${SITE}/logo.webp`],
    organizer: { "@type": "Organization", name: "Comité d'organisation de la BÊGNANAN DALOA CUP", url: SITE },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(evenement).replace(/</g, "\\u003c") }} />
      <Hero3D>
        <div className="wrap">
          <div>
            <div className="eyebrow" style={{ color: "var(--gold)" }}>Tournoi de maracana · Daloa</div>
            <h1 className="sr">{tournoi.nom}</h1>
            <div className="hero-logo" data-logo-3d>
              <Image src="/logo.webp" alt="Logo officiel BÊGNANAN DALOA CUP" width={600} height={587} priority />
            </div>
            <p className="lead">{tournoi.accroche}</p>
            <div className="meta">
              <span className="chip">📍 {tournoi.lieu}</span>
              <span className="chip">
                {dateCourte(tournoi.date_debut)} → {dateCourte(tournoi.date_fin)}
                {!tournoi.dates_confirmees && <span className="tbc">à confirmer</span>}
              </span>
              <span className="chip">{tournoi.capacite_clubs} équipes</span>
            </div>
            <div className="cta">
              <Link className="btn gold" href="/billetterie">Acheter un billet</Link>
              <Link className="btn ghost" href="/matchs">Voir le calendrier</Link>
            </div>
          </div>
          <div className="board">
            <div className="lbl">Coup d&apos;envoi dans</div>
            <Countdown cible={`${tournoi.date_debut}T16:00:00Z`} />
            <hr />
            {prochain ? (
              <>
                <div className="lbl" style={{ textAlign: "center", marginBottom: 12 }}>
                  Prochain match{prochain.poule ? ` · Poule ${prochain.poule}` : ""}
                </div>
                <div className="fixture">
                  <div>
                    <Crest club={clubs.get(prochain.club_domicile)} size="crest" />
                    <div className="tn">{clubs.get(prochain.club_domicile)?.nom}</div>
                  </div>
                  <div className="vs">VS</div>
                  <div>
                    <Crest club={clubs.get(prochain.club_exterieur)} size="crest" />
                    <div className="tn">{clubs.get(prochain.club_exterieur)?.nom}</div>
                  </div>
                </div>
                <div className="where">
                  {jourCourt(prochain.date_heure)} · {heure(prochain.date_heure)} · {prochain.terrain}
                </div>
              </>
            ) : (
              <p className="where">Le calendrier sera publié après le tirage au sort.</p>
            )}
          </div>
        </div>
      </Hero3D>

      {recentes.length > 0 && (
        <section className="band annonces-band">
          <div className="wrap">
            <div className="head">
              <div>
                <div className="eyebrow">Annonces du comité</div>
                <h2>Dernières infos</h2>
              </div>
              <Link className="btn line sm" href="/infos#annonces">Toutes les annonces</Link>
            </div>
            <Annonces alertes={recentes} />
          </div>
        </section>
      )}

      {(enDirect.length > 0 || recents.length > 0) && (
        <section className="live">
          <div className="wrap">
            <div className="live-head">
              <div>
                <span className="live-tag">
                  <i className="live-dot" />
                  {enDirect.length ? "En direct" : "Derniers résultats"}
                </span>
                <h3>{enDirect.length ? `${enDirect.length} match${enDirect.length > 1 ? "s" : ""} en cours` : "Pas de match en cours"}</h3>
              </div>
            </div>
            <div className="grid g2">
              {[...enDirect, ...recents].map((m) => (
                <MatchCard key={m.id} match={m} clubs={clubs} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="band">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Le tournoi</div>
              <h2>Tout en un clic</h2>
            </div>
          </div>
          <div className="grid g3 rubriques-grille">
            {RUBRIQUES.map(([href, titre, texte]) => (
              <Link key={href} href={href} className="card rubrique">
                <b>{titre}</b>
                <span>{texte}</span>
                <i aria-hidden="true">→</i>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="band alt">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Médias</div>
              <h2>Les actus du tournoi</h2>
            </div>
            <Link className="btn line sm" href="/medias">Tout voir</Link>
          </div>
          {publications.length > 0 ? (
            <div className="grid g3">
              {publications.slice(0, 3).map((p) => (
                <CartePublication key={p.id} pub={p} clubs={clubs} matchs={parId(matchs)} />
              ))}
            </div>
          ) : (
            <div className="card vide-medias">
              <p>Les premiers débriefs, annonces et hommes du match seront publiés ici dès le début du tournoi.</p>
              <Link className="btn line sm" href="/medias">Aller à l&apos;espace médias</Link>
            </div>
          )}
        </div>
      </section>

      {actualitesClubs.length > 0 && (
        <section className="band">
          <div className="wrap">
            <div className="head">
              <div>
                <div className="eyebrow">Espace des clubs</div>
                <h2>Ça se passe dans les clubs</h2>
              </div>
              <Link className="btn line sm" href="/equipes">Tous les clubs</Link>
            </div>
            <div className="grid g3">
              {actualitesClubs.map((a) => (
                <CarteActualite key={a.id} actu={a} club={clubs.get(a.club_id)} />
              ))}
            </div>
          </div>
        </section>
      )}

      <SectionPartenaires />

      <section className="band">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Infos pratiques</div>
              <h2>Venir au stade</h2>
            </div>
          </div>
          <div className="card venir">
            <dl className="info-list">
              <div><dt>Lieu</dt><dd>{tournoi.lieu}</dd></div>
              <div>
                <dt>Dates</dt>
                <dd>
                  Du {dateLongue(tournoi.date_debut)} au {dateLongue(tournoi.date_fin)}{" "}
                  {!tournoi.dates_confirmees && <span className="tbc">à confirmer</span>}
                </dd>
              </div>
            </dl>
            <div className="cta">
              <a className="btn gold" href={carte} target="_blank" rel="noopener">Ouvrir l&apos;itinéraire</a>
              <Link className="btn line" href="/infos">Toutes les infos</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
