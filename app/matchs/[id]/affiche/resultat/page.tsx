import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnteteAffiche, LogoAffiche, PartenairesAffiche } from "@/components/affiches/elements";
import { ExportAffiche } from "@/components/affiches/ExportAffiche";
import { buteursEquipe, detailScore, libellePhase, texteScore } from "@/lib/carteMatch";
import { getClubs, getEvenements, getMatchs, getPartenaires, getTournoi, parId } from "@/lib/data";
import { heure, jourCourt } from "@/lib/format";
import { SITE } from "@/lib/site";

export const revalidate = 15;
export const metadata: Metadata = { title: "Affiche du résultat", robots: { index: false } };

/** Affiche du résultat d'un match, à enregistrer ou partager sur WhatsApp. */
export default async function AfficheResultat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [matchs, clubs, evenements, tournoi, partenaires] = await Promise.all([getMatchs(), getClubs(), getEvenements(id), getTournoi(), getPartenaires()]);
  const match = matchs.find((m) => m.id === id);
  if (!match) notFound();
  const index = parId(clubs);
  const dom = index.get(match.club_domicile);
  const ext = index.get(match.club_exterieur);
  const joue = match.statut === "terminé" || match.statut === "en cours";
  const detail = joue ? detailScore(match, evenements, tournoi.duree_mi_temps ?? null) : null;
  const buteurs = [buteursEquipe(evenements, id, match.club_domicile), buteursEquipe(evenements, id, match.club_exterieur)];
  const tab = match.tab_domicile != null && match.tab_exterieur != null;
  const titre = match.statut === "terminé" ? "Résultat" : match.statut === "en cours" ? "Score en direct" : "Affiche du match";
  const score = `${match.buts_domicile ?? 0}-${match.buts_exterieur ?? 0}`;
  const message = `${dom?.nom} ${joue ? score : "–"} ${ext?.nom}${tab ? ` (${match.tab_domicile}-${match.tab_exterieur} aux tirs au but)` : ""} · ${libellePhase(match)} · Bêgnanan Daloa Cup\n${SITE}/matchs/${id}`;

  return (
    <section className="band">
      <div className="wrap" style={{ maxWidth: 720 }}>
        <Link className="small" href={`/matchs/${id}`}>← Retour au match</Link>
        <h1 className="h2" style={{ margin: "8px 0 12px", fontSize: "1.8rem" }}>{titre} à partager</h1>
        <ExportAffiche fichier={`resultat-${dom?.sigle ?? "dom"}-${ext?.sigle ?? "ext"}.png`.toLowerCase()} message={message}>
          <div className="aff">
            <EnteteAffiche titre={titre} sousTitre={`${libellePhase(match)} · ${jourCourt(match.date_heure)} · ${heure(match.date_heure)}`} />
            <div className="aff-match">
              <div className="aff-equipe"><LogoAffiche club={dom} taille={250} /><b>{dom?.nom}</b></div>
              <div className="aff-score">
                {joue ? <span>{match.buts_domicile ?? 0}<i>-</i>{match.buts_exterieur ?? 0}</span> : <span className="aff-vs">VS</span>}
                {tab && <em>TAB {match.tab_domicile}-{match.tab_exterieur}</em>}
              </div>
              <div className="aff-equipe"><LogoAffiche club={ext} taille={250} /><b>{ext?.nom}</b></div>
            </div>
            {detail && (
              <div className="aff-mt">
                {detail.mt1 && <span>1re MT <b>{texteScore(detail.mt1)}</b></span>}
                {detail.mt2 && <span>2e MT <b>{texteScore(detail.mt2)}</b></span>}
                {detail.prol && <span>Prol. <b>{texteScore(detail.prol)}</b></span>}
              </div>
            )}
            {(buteurs[0].length > 0 || buteurs[1].length > 0) && (
              <div className="aff-buteurs">
                {buteurs.map((liste, i) => (
                  <ul key={i}>
                    {liste.slice(0, 5).map((b) => <li key={b.nom + b.csc}>⚽ {b.nom}{b.csc ? " (csc)" : ""} {b.minutes.join(" ")}</li>)}
                  </ul>
                ))}
              </div>
            )}
            {match.hdm_nom && (
              <div className="aff-hdm">
                <span>⭐ Homme du match</span>
                <b>{match.hdm_nom}</b>
                {match.hdm_club_id && <span>{index.get(match.hdm_club_id)?.nom}</span>}
              </div>
            )}
            <div className="aff-lieu">📍 {match.terrain} · {tournoi.lieu}</div>
            <PartenairesAffiche partenaires={partenaires} />
          </div>
        </ExportAffiche>
      </div>
    </section>
  );
}
