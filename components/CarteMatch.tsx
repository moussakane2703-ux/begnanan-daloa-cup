import Link from "next/link";
import { buteursEquipe, detailScore, libellePhase, texteScore } from "@/lib/carteMatch";
import { heure, jourCourt } from "@/lib/format";
import type { Club, EvenementMatch, Match } from "@/lib/types";
import { Crest } from "./Crest";
import { StatutPill } from "./StatutMatch";

/**
 * Carte d'un match : date et heure, logos, score avec le détail par mi-temps, buteurs,
 * Homme du match, lieu et phase, avec les liens vers la composition et les affiches à partager.
 */
export function CarteMatch({
  match,
  clubs,
  evenements,
  miTemps,
  lieu,
  compositions = [],
  lienDetail = true,
}: {
  match: Match;
  clubs: Map<string, Club>;
  evenements: EvenementMatch[];
  miTemps: number | null;
  lieu: string;
  /** Clubs dont la composition est publiée pour ce match. */
  compositions?: string[];
  lienDetail?: boolean;
}) {
  const dom = clubs.get(match.club_domicile);
  const ext = clubs.get(match.club_exterieur);
  const joue = match.statut === "terminé" || match.statut === "en cours";
  const detail = joue ? detailScore(match, evenements, miTemps) : null;
  const tab = match.tab_domicile != null && match.tab_exterieur != null;
  const buteurs = [buteursEquipe(evenements, match.id, match.club_domicile), buteursEquipe(evenements, match.id, match.club_exterieur)];
  const vainqueur =
    match.statut !== "terminé" || match.buts_domicile === null || match.buts_exterieur === null
      ? null
      : match.buts_domicile !== match.buts_exterieur
        ? match.buts_domicile > match.buts_exterieur ? "dom" : "ext"
        : tab && match.tab_domicile !== match.tab_exterieur
          ? match.tab_domicile! > match.tab_exterieur! ? "dom" : "ext"
          : null;

  return (
    <article className="cm" id={`match-${match.id}`}>
      <div className="cm-haut">
        <span className="cm-phase">{libellePhase(match)}</span>
        <span>{jourCourt(match.date_heure)} · {heure(match.date_heure)}</span>
      </div>

      <div className="cm-main">
        <div className={`cm-eq${vainqueur === "dom" ? " gagne" : ""}`}>
          <Crest club={dom} size="crest" />
          <b>{dom?.nom ?? "?"}</b>
        </div>
        <div className="cm-score">
          {joue ? (
            <span className="num cm-chiffres">{match.buts_domicile ?? 0}<i>-</i>{match.buts_exterieur ?? 0}</span>
          ) : (
            <span className="num cm-heure">{heure(match.date_heure)}</span>
          )}
          {tab && <span className="cm-tab">TAB {match.tab_domicile}-{match.tab_exterieur}</span>}
          <StatutPill statut={match.statut} />
        </div>
        <div className={`cm-eq${vainqueur === "ext" ? " gagne" : ""}`}>
          <Crest club={ext} size="crest" />
          <b>{ext?.nom ?? "?"}</b>
        </div>
      </div>

      {detail && (
        <div className="cm-mt">
          {detail.mt1 && <span>1re MT <b className="num">{texteScore(detail.mt1)}</b></span>}
          {detail.mt2 && <span>2e MT <b className="num">{texteScore(detail.mt2)}</b></span>}
          {detail.prol && <span>Prol. <b className="num">{texteScore(detail.prol)}</b></span>}
        </div>
      )}

      {(buteurs[0].length > 0 || buteurs[1].length > 0) && (
        <div className="cm-buts">
          {buteurs.map((liste, i) => (
            <ul key={i} className={i ? "ext" : "dom"}>
              {liste.map((b) => (
                <li key={b.nom + b.csc}>⚽ {b.nom}{b.csc ? " (csc)" : ""} <span className="num">{b.minutes.join(", ")}</span></li>
              ))}
            </ul>
          ))}
        </div>
      )}

      {match.hdm_nom && (
        <div className="cm-hdm">
          <span>⭐ Homme du match</span>
          <b>{match.hdm_nom}</b>
          {match.hdm_club_id && <span className="small">{clubs.get(match.hdm_club_id)?.nom}</span>}
        </div>
      )}

      <div className="cm-pied">
        <span className="small">📍 {match.terrain} · {lieu}</span>
        {match.statut === "terminé" && !match.resultat_valide && <span className="small">Résultat provisoire</span>}
        <div className="cm-actions">
          {lienDetail && <Link className="btn line sm" href={`/matchs/${match.id}`}>{match.statut === "en cours" ? "Suivre en direct" : "Détails"}</Link>}
          {compositions.length > 0 && <Link className="btn line sm" href={`/matchs/${match.id}#compositions`}>Compositions</Link>}
          {compositions.map((c) => (
            <Link key={c} className="btn line sm" href={`/matchs/${match.id}/affiche/composition/${c}`}>Affiche compo {clubs.get(c)?.sigle}</Link>
          ))}
          {match.statut === "terminé" && <Link className="btn gold sm" href={`/matchs/${match.id}/affiche/resultat`}>Affiche résultat</Link>}
        </div>
      </div>
    </article>
  );
}
