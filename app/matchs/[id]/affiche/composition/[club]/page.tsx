import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { joueursComposition } from "@/components/Compositions";
import { EnteteAffiche, LogoAffiche, PartenairesAffiche } from "@/components/affiches/elements";
import { ExportAffiche } from "@/components/affiches/ExportAffiche";
import { libellePhase } from "@/lib/carteMatch";
import { getClubs, getCompositions, getEffectif, getMatchs, getPartenaires, getTournoi, parId } from "@/lib/data";
import { heure, jourCourt } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { JoueurPublic } from "@/lib/types";

export const revalidate = 15;
export const metadata: Metadata = { title: "Affiche de la composition", robots: { index: false } };

const estGardien = (j: JoueurPublic) => /gard|goal|^g$/i.test(j.poste ?? "");

/** Place les titulaires sur le terrain : le gardien en bas, les autres par lignes de trois au plus. */
function lignesTerrain(titulaires: JoueurPublic[]) {
  const gardien = titulaires.find(estGardien);
  const autres = titulaires.filter((j) => j !== gardien);
  const lignes: JoueurPublic[][] = [];
  const nbLignes = Math.max(1, Math.ceil(autres.length / 3));
  for (let i = 0; i < nbLignes; i++) lignes.push(autres.slice(Math.round((i * autres.length) / nbLignes), Math.round(((i + 1) * autres.length) / nbLignes)));
  // De l'attaque (haut) à la défense (bas).
  return { lignes: lignes.filter((l) => l.length).reverse(), gardien };
}

/** Affiche de la composition d'une équipe pour un match, à partager. */
export default async function AfficheComposition({ params }: { params: Promise<{ id: string; club: string }> }) {
  const { id, club } = await params;
  const [matchs, clubs, compositions, tournoi, partenaires] = await Promise.all([getMatchs(), getClubs(), getCompositions(id), getTournoi(), getPartenaires()]);
  const match = matchs.find((m) => m.id === id);
  const compo = compositions.find((c) => c.club_id === club);
  if (!match || !compo) notFound();
  const index = parId(clubs);
  const equipe = index.get(club);
  const adversaire = index.get(club === match.club_domicile ? match.club_exterieur : match.club_domicile);
  const { titulaires, remplacants } = joueursComposition(compo, await getEffectif(club));
  const { lignes, gardien } = lignesTerrain(titulaires);
  const couleur = equipe?.couleur ?? "#11802c";
  const joueur = (j: JoueurPublic) => (
    <div key={j.id} className="aff-joueur">
      <span className="aff-maillot" style={{ background: couleur }}>{j.numero_maillot ?? ""}</span>
      <b>{j.prenoms.split(" ")[0]} {j.nom}{compo.capitaine === j.id ? " (C)" : ""}</b>
    </div>
  );
  const message = `Composition de ${equipe?.nom} contre ${adversaire?.nom} · ${libellePhase(match)} · ${jourCourt(match.date_heure)} à ${heure(match.date_heure)} · Bêgnanan Daloa Cup\n${SITE}/matchs/${id}`;

  return (
    <section className="band">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <Link className="small" href={`/matchs/${id}#compositions`}>← Retour au match</Link>
        <h1 className="h2" style={{ margin: "8px 0 12px", fontSize: "1.8rem" }}>Composition à partager</h1>
        <ExportAffiche fichier={`composition-${equipe?.sigle ?? "club"}.png`.toLowerCase()} message={message}>
          <div className="aff">
            <EnteteAffiche titre="Composition" sousTitre={`${libellePhase(match)} · ${jourCourt(match.date_heure)} · ${heure(match.date_heure)}`} />
            <div className="aff-compo-equipes">
              <LogoAffiche club={equipe} taille={130} />
              <div>
                <b>{equipe?.nom}</b>
                <span>contre {adversaire?.nom}</span>
              </div>
              <LogoAffiche club={adversaire} taille={90} />
            </div>
            <div className="aff-terrain">
              <div className="aff-terrain-lignes" />
              {lignes.map((l, i) => <div key={i} className="aff-ligne">{l.map(joueur)}</div>)}
              {gardien && <div className="aff-ligne">{joueur(gardien)}</div>}
            </div>
            <div className="aff-banc">
              {remplacants.length > 0 && <div><span>Remplaçants</span> {remplacants.map((j) => `${j.numero_maillot ? `${j.numero_maillot}. ` : ""}${j.prenoms.split(" ")[0]} ${j.nom}`).join(" · ")}</div>}
              {compo.coach && <div><span>Coach</span> {compo.coach}</div>}
            </div>
            <div className="aff-lieu">📍 {match.terrain} · {tournoi.lieu}</div>
            <PartenairesAffiche partenaires={partenaires} />
          </div>
        </ExportAffiche>
      </div>
    </section>
  );
}
