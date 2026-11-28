import Link from "next/link";
import type { Club, Match } from "@/lib/types";
import { heure, lienWhatsApp } from "@/lib/format";
import { Crest } from "./Crest";
import { StatutPill } from "./StatutMatch";

const TZ = "Africa/Abidjan";

export function MatchCard({ match, clubs }: { match: Match; clubs: Map<string, Club> }) {
  const dom = clubs.get(match.club_domicile);
  const ext = clubs.get(match.club_exterieur);
  const score = match.statut === "terminé" || match.statut === "en cours";
  const d = new Date(match.date_heure);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("fr-FR", { ...o, timeZone: TZ });
  const titre = `${dom?.nom ?? "?"} – ${ext?.nom ?? "?"}`;
  // Égalité départagée aux tirs au but : le vainqueur de la séance est mis en avant.
  const tab = match.tab_domicile != null && match.tab_exterieur != null ? [match.tab_domicile, match.tab_exterieur] : null;
  const gagne = (a: number | null, b: number | null, ta = 0, tb = 0) => score && ((a ?? 0) > (b ?? 0) || ((a ?? 0) === (b ?? 0) && ta > tb));
  return (
    <article className="card match" id={`match-${match.id}`}>
      <div className="when">
        <small>{part({ weekday: "short" })}</small>
        <b>{part({ day: "numeric" })}</b>
        <small>{part({ month: "short" })}</small>
      </div>
      <div className="teams">
        <div className={`trow ${gagne(match.buts_domicile, match.buts_exterieur, tab?.[0], tab?.[1]) ? "win" : ""}`}>
          <Crest club={dom} />
          <span className="nm">{dom?.nom}</span>
          <span className="sc num">{score ? match.buts_domicile : ""}{score && tab && <small> ({tab[0]})</small>}</span>
        </div>
        <div className={`trow ${gagne(match.buts_exterieur, match.buts_domicile, tab?.[1], tab?.[0]) ? "win" : ""}`}>
          <Crest club={ext} />
          <span className="nm">{ext?.nom}</span>
          <span className="sc num">{score ? match.buts_exterieur : ""}{score && tab && <small> ({tab[1]})</small>}</span>
        </div>
      </div>
      <div className="mside">
        <StatutPill statut={match.statut} />
        <span className="small">
          {heure(match.date_heure)} · {match.terrain}
          {match.poule ? ` · Poule ${match.poule}` : ` · ${match.phase}`}
        </span>
        {tab && <span className="small">Tirs au but entre parenthèses</span>}
        <Link className="small" href={`/matchs/${match.id}`}>{match.statut === "en cours" ? "Suivre en direct" : "Détails du match"}</Link>
        <a className="small" href={lienWhatsApp(`${titre} · BÊGNANAN DALOA CUP`)} target="_blank" rel="noopener">
          Partager
        </a>
      </div>
    </article>
  );
}
