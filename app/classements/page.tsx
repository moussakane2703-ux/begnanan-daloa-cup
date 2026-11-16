import type { Metadata } from "next";
import { TableauxPoules } from "@/components/TableauxPoules";
import { getButeurs, getClassement, getClubs, parId } from "@/lib/data";

export const revalidate = 30;
export const metadata: Metadata = { title: "Classements" };

const POULES = ["A", "B", "C", "D", "E", "F", "G", "H"];

function Tableau() {
  const huitiemes: [string, string][] = [];
  for (let i = 0; i < 8; i += 2) {
    huitiemes.push([`1er ${POULES[i]}`, `2e ${POULES[i + 1]}`], [`1er ${POULES[i + 1]}`, `2e ${POULES[i]}`]);
  }
  const tours: { titre: string; rencontres: [string, string][]; finale?: boolean }[] = [
    { titre: "Huitièmes", rencontres: huitiemes },
    { titre: "Quarts", rencontres: [0, 1, 2, 3].map((i) => [`Vainq. H${i * 2 + 1}`, `Vainq. H${i * 2 + 2}`]) },
    { titre: "Demi-finales", rencontres: [["Vainq. Q1", "Vainq. Q2"], ["Vainq. Q3", "Vainq. Q4"]] },
    { titre: "Finale", rencontres: [["Vainq. D1", "Vainq. D2"]], finale: true },
  ];
  return (
    <div className="bracket">
      {tours.map((t) => (
        <div key={t.titre} className={`round ${t.finale ? "final" : ""}`}>
          <h4>{t.titre}</h4>
          {t.rencontres.map(([a, b]) => (
            <div key={a + b} className="slot">
              <div className="ph"><span>{a}</span><span>–</span></div>
              <div className="ph"><span>{b}</span><span>–</span></div>
            </div>
          ))}
          {t.finale && <div className="trophy">🏆 Vainqueur</div>}
        </div>
      ))}
    </div>
  );
}

export default async function Classements() {
  const [lignes, buteurs, clubs] = await Promise.all([getClassement(), getButeurs(), getClubs()]);
  const index = parId(clubs);
  const meilleurs = buteurs.filter((b) => b.buts > 0).sort((a, b) => b.buts - a.buts || a.joueur_nom.localeCompare(b.joueur_nom, "fr")).slice(0, 10);
  const sanctions = buteurs.filter((b) => b.jaunes + b.rouges > 0).sort((a, b) => b.rouges - a.rouges || b.jaunes - a.jaunes).slice(0, 10);

  return (
    <>
      <section className="band">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Classements</div>
              <h1 className="h2">Phase de poules</h1>
              <p>
                Calculés automatiquement à partir des seuls résultats validés par le comité. Barème affiché : 3 points la
                victoire, 1 le nul (à confirmer dans le règlement).
              </p>
            </div>
          </div>
          <TableauxPoules lignes={lignes} clubs={index} />
          <p className="small" style={{ marginTop: 12 }}>Liseré vert : places qualificatives (format à confirmer).</p>
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Joueurs</div>
              <h2>Buteurs et cartons</h2>
              <p>Mis à jour pendant les matchs par le comité. Les buts contre son camp ne comptent pas pour les buteurs.</p>
            </div>
          </div>
          {meilleurs.length + sanctions.length ? (
            <div className="grid g2">
              <div>
                <h3 style={{ marginBottom: 10 }}>Meilleurs buteurs</h3>
                {meilleurs.length ? (
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Joueur</th><th className="n">Buts</th></tr></thead>
                      <tbody>
                        {meilleurs.map((b, i) => (
                          <tr key={b.joueur_nom + b.club_id}>
                            <td className="rank">{i + 1}</td>
                            <td><b>{b.joueur_nom}</b> <span className="small">{index.get(b.club_id)?.nom}</span></td>
                            <td className="n pts">{b.buts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="small">Aucun but pour l&apos;instant.</p>}
              </div>
              <div>
                <h3 style={{ marginBottom: 10 }}>Cartons</h3>
                {sanctions.length ? (
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr><th>Joueur</th><th className="n">2 min</th><th className="n">5 min</th></tr></thead>
                      <tbody>
                        {sanctions.map((b) => (
                          <tr key={b.joueur_nom + b.club_id}>
                            <td><b>{b.joueur_nom}</b> <span className="small">{index.get(b.club_id)?.nom}</span></td>
                            <td className="n">{b.jaunes}</td>
                            <td className="n">{b.rouges}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="small">Aucun carton pour l&apos;instant.</p>}
              </div>
            </div>
          ) : (
            <div className="card vide"><h3>Pas encore de buteur</h3><p className="small">Le classement des buteurs commencera avec le premier match.</p></div>
          )}
        </div>
      </section>
      <section className="band alt">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="eyebrow">Tableau final</div>
              <h2>Route vers le trophée</h2>
              <p>Schéma indicatif, il se remplira une fois le format de la phase finale validé.</p>
            </div>
          </div>
          <div className="tbl-wrap" style={{ padding: 16, border: 0, background: "transparent" }}>
            <Tableau />
          </div>
        </div>
      </section>
    </>
  );
}
