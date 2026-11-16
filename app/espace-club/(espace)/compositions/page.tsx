import Link from "next/link";
import { Formulaire } from "@/components/admin/Formulaire";
import { exigerClub } from "@/lib/auth";
import { libellePhase } from "@/lib/carteMatch";
import { heure, jourCourt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Composition, Match } from "@/lib/types";
import { enregistrerComposition, retirerComposition } from "./actions";

/** Compositions : titulaires, remplaçants et capitaine du club pour chacun de ses matchs à venir. */
export default async function Compositions() {
  const orga = await exigerClub();
  const db = await createClient();
  const club = orga.club_id;
  const [{ data: m }, { data: c }, { data: j }, { data: cl }, { data: coach }] = await Promise.all([
    db.from("matchs").select("*").or(`club_domicile.eq.${club},club_exterieur.eq.${club}`).in("statut", ["programmé", "en cours", "reporté"]).order("date_heure"),
    db.from("compositions").select("*").eq("club_id", club),
    db.from("joueurs").select("id, nom, prenoms, numero_maillot, poste").eq("club_id", club).eq("etat", "active").order("numero_maillot", { nullsFirst: false }).order("nom"),
    db.from("clubs").select("id, nom"),
    db.from("encadrants").select("nom, prenoms").eq("club_id", club).eq("fonction", "coach").maybeSingle(),
  ]);
  const matchs = (m ?? []) as Match[];
  const compositions = new Map(((c ?? []) as Composition[]).map((x) => [x.match_id, x]));
  const joueurs = (j ?? []) as { id: string; nom: string; prenoms: string; numero_maillot: number | null; poste: string | null }[];
  const nom = new Map(((cl ?? []) as { id: string; nom: string }[]).map((x) => [x.id, x.nom]));
  const coachParDefaut = coach ? `${coach.prenoms} ${coach.nom}` : "";

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Compositions d&apos;équipe</h3>
        <p className="small">
          Pour chaque match, choisissez les titulaires, les remplaçants et le capitaine. Une fois publiée, la composition apparaît sur la page du match
          avec une affiche à partager sur WhatsApp. Seuls les joueurs avec une licence active peuvent être alignés. Vous pouvez la modifier jusqu&apos;au coup d&apos;envoi ; ensuite, seul le comité peut la corriger.
        </p>
      </div>
      {!matchs.length && <div className="card"><p className="small">Aucun match à venir pour votre club.</p></div>}
      {matchs.length > 0 && !joueurs.length && (
        <div className="card"><p className="small">Aucun joueur n&apos;a encore de licence active : la composition se fera une fois les licences validées par le comité.</p></div>
      )}
      {joueurs.length > 0 && matchs.map((x) => {
        const compo = compositions.get(x.id);
        const role = (id: string) => (compo?.titulaires.includes(id) ? "t" : compo?.remplacants.includes(id) ? "r" : "");
        const adversaire = nom.get(x.club_domicile === club ? x.club_exterieur : x.club_domicile);
        const verrouille = x.statut !== "programmé" && !orga.consultation;
        return (
          <details key={x.id} className="card" open={!compo}>
            <summary>
              <b>Contre {adversaire}</b>{" "}
              <span className="small">{libellePhase(x)} · {jourCourt(x.date_heure)} à {heure(x.date_heure)}</span>{" "}
              {compo ? <span className={`pill ${compo.publiee ? "ok" : "warn"}`}>{compo.publiee ? "Publiée" : "Brouillon"}</span> : <span className="pill neutral">À faire</span>}
            </summary>
            {verrouille ? (
              <p className="small" style={{ marginTop: 10 }}>Le match a commencé : la composition ne se modifie plus ici.</p>
            ) : (
              <Formulaire action={enregistrerComposition} className="compo-form">
                <input type="hidden" name="match_id" value={x.id} />
                <div className="tbl-wrap">
                  <table>
                    <thead><tr><th>Joueur</th><th>Rôle</th><th className="n">Capitaine</th></tr></thead>
                    <tbody>
                      {joueurs.map((p) => (
                        <tr key={p.id}>
                          <td><b>{p.numero_maillot ? `${p.numero_maillot}. ` : ""}{p.prenoms} {p.nom}</b>{p.poste && <span className="small"> · {p.poste}</span>}</td>
                          <td>
                            <select name={`r_${p.id}`} defaultValue={role(p.id)} aria-label={`Rôle de ${p.prenoms} ${p.nom}`}>
                              <option value="">Absent</option>
                              <option value="t">Titulaire</option>
                              <option value="r">Remplaçant</option>
                            </select>
                          </td>
                          <td className="n"><input type="radio" name="capitaine" value={p.id} defaultChecked={compo?.capitaine === p.id} aria-label="Capitaine" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="form-row">
                  <label className="field" style={{ flex: "1 1 220px" }}>Coach<input name="coach" maxLength={150} defaultValue={compo?.coach ?? coachParDefaut} /></label>
                  <label className="chk"><input name="publiee" type="checkbox" defaultChecked={compo?.publiee ?? true} /> Publier sur le site</label>
                </div>
              </Formulaire>
            )}
            {compo && (
              <div className="form-row" style={{ marginTop: 8 }}>
                {compo.publiee && <Link className="btn line sm" href={`/matchs/${x.id}/affiche/composition/${club}`} target="_blank">Voir l&apos;affiche</Link>}
                {!verrouille && (
                  <Formulaire action={retirerComposition} bouton="Retirer la composition" className="form-del" confirmer="Retirer cette composition ?">
                    <input type="hidden" name="match_id" value={x.id} />
                  </Formulaire>
                )}
              </div>
            )}
          </details>
        );
      })}
    </>
  );
}
