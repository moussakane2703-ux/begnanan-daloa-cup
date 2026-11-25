import { trierClassement } from "@/lib/classement";
import type { Club, LigneClassement } from "@/lib/types";
import { Crest } from "./Crest";

const POULES = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Classement de chaque poule, calculé à partir des résultats validés (les 2 premiers en vert). */
export function TableauxPoules({ lignes, clubs }: { lignes: (LigneClassement & { poule: string })[]; clubs?: Map<string, Club> }) {
  const poules = POULES.map((p) => ({ poule: p, ...trierClassement(lignes.filter((l) => l.poule === p)) })).filter((p) => p.triees.length);
  return (
    <>
      {poules.length ? (
        <div className="grid g2">
          {poules.map(({ poule, triees, egalites }) => (
            <div key={poule}>
              <h3 style={{ marginBottom: 10 }}>Poule {poule}</h3>
              <div className="tbl-wrap">
                <table className="tbl-poule">
                  <thead>
                    <tr>
                      <th>#</th><th>Équipe</th>
                      <th className="n">J</th><th className="n">G</th><th className="n">N</th><th className="n">P</th>
                      <th className="n">Diff</th><th className="n th-pts" title="Points">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {triees.map((l, i) => (
                      <tr key={l.club_id} className={i < 2 ? "q" : ""}>
                        <td className="rank">{i + 1}{egalites.has(l.club_id) ? "*" : ""}</td>
                        <td>
                          <div className="trow">
                            <Crest club={clubs?.get(l.club_id) ?? { id: l.club_id, nom: l.nom, sigle: l.sigle, couleur: l.couleur } as Club} />
                            <span className="nm">{l.nom}</span>
                          </div>
                        </td>
                        <td className="n">{l.joues}</td><td className="n">{l.gagnes}</td>
                        <td className="n">{l.nuls}</td><td className="n">{l.perdus}</td>
                        <td className="n">{l.difference > 0 ? "+" : ""}{l.difference}</td>
                        <td className="n"><span className="cage-pts">{l.points}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {egalites.size > 0 && <p className="small" style={{ marginTop: 6 }}>* Égalité parfaite : décision du comité attendue.</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card vide"><h3>Classements à venir</h3><p className="small">Les poules seront affichées après le tirage au sort.</p></div>
      )}
    </>
  );
}
