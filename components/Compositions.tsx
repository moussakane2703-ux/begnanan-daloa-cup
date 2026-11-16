import type { Club, Composition, JoueurPublic } from "@/lib/types";

/** Joueurs d'une composition, dans l'ordre choisi par le club, avec leurs noms publics. */
export function joueursComposition(c: Composition, effectif: JoueurPublic[]) {
  const parId = new Map(effectif.map((j) => [j.id, j]));
  const liste = (ids: string[]) => ids.map((id) => parId.get(id)).filter((j): j is JoueurPublic => !!j);
  return { titulaires: liste(c.titulaires), remplacants: liste(c.remplacants) };
}

const nomJoueur = (j: JoueurPublic) => `${j.prenoms} ${j.nom}`;

/** Compositions publiées des deux équipes, côte à côte. */
export function Compositions({ compositions, clubs, effectifs, ordre }: { compositions: Composition[]; clubs: Map<string, Club>; effectifs: Record<string, JoueurPublic[]>; ordre: string[] }) {
  const triees = [...compositions].sort((a, b) => ordre.indexOf(a.club_id) - ordre.indexOf(b.club_id));
  return (
    <div className="compos">
      {triees.map((c) => {
        const { titulaires, remplacants } = joueursComposition(c, effectifs[c.club_id] ?? []);
        const ligne = (j: JoueurPublic) => (
          <li key={j.id}>
            <span className="num">{j.numero_maillot ?? ""}</span>
            {nomJoueur(j)}{c.capitaine === j.id && <b className="compo-cap" title="Capitaine">C</b>}
            {j.poste && <span className="small"> · {j.poste}</span>}
          </li>
        );
        return (
          <div key={c.club_id}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>{clubs.get(c.club_id)?.nom}</h3>
            <p className="small">Titulaires</p>
            <ol className="compo-liste">{titulaires.map(ligne)}</ol>
            {remplacants.length > 0 && (<><p className="small" style={{ marginTop: 8 }}>Remplaçants</p><ol className="compo-liste">{remplacants.map(ligne)}</ol></>)}
            {c.coach && <p className="small" style={{ marginTop: 8 }}>Coach : <b>{c.coach}</b></p>}
            <a className="btn line sm" style={{ marginTop: 10 }} href={`/matchs/${c.match_id}/affiche/composition/${c.club_id}`}>Affiche de la composition</a>
          </div>
        );
      })}
    </div>
  );
}
