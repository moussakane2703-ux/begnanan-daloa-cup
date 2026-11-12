import { Formulaire } from "@/components/admin/Formulaire";
import { exigerAcces } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CategorieBillet } from "@/lib/types";
import Link from "next/link";
import { libelleStatut, type StatutCommande } from "@/lib/billet";
import { heure, jourCourt } from "@/lib/format";
import { ajouterCategorie, definirMatchsOuverts, modifierCategorie, supprimerCategorie } from "./actions";

function ChampsCategorie({ c }: { c?: CategorieBillet }) {
  return (
    <>
      <label className="field">Nom<input name="nom" defaultValue={c?.nom} required /></label>
      <label className="field">Prix (FCFA)<input name="prix_fcfa" type="number" min={0} step={100} defaultValue={c?.prix_fcfa ?? 1000} required /></label>
      <label className="field">Places par match<input name="places_par_match" type="number" min={0} defaultValue={c?.places_par_match ?? 100} required /></label>
      <label className="field">Ordre d&apos;affichage<input name="ordre" type="number" defaultValue={c?.ordre ?? 0} /></label>
      <label className="field full">Description<input name="description" defaultValue={c?.description} /></label>
      <label className="chk"><input name="en_vente" type="checkbox" defaultChecked={c?.en_vente} /> En vente sur le site</label>
    </>
  );
}

export default async function AdminBillets() {
  await exigerAcces("billets");
  const db = await createClient();
  const [{ data: categories }, { data: commandes }, { data: matchs }, { data: clubs }] = await Promise.all([
    db.from("categories_billet").select("*").order("ordre"),
    db.from("commandes").select("reference, nom_acheteur, telephone, quantite, total_fcfa, statut, entrees_validees, cree_le").order("cree_le", { ascending: false }).limit(100),
    db.from("matchs").select("id, date_heure, club_domicile, club_exterieur, terrain, statut, reservation_ouverte").in("statut", ["programmé", "en cours"]).order("date_heure"),
    db.from("clubs").select("id, nom"),
  ]);
  const nomClub = new Map((clubs ?? []).map((c) => [c.id as string, c.nom as string]));
  const parJour = new Map<string, NonNullable<typeof matchs>>();
  for (const m of matchs ?? []) {
    const j = jourCourt(m.date_heure);
    parJour.set(j, [...(parJour.get(j) ?? []), m]);
  }
  const liste = (commandes ?? []) as { reference: string; nom_acheteur: string; telephone: string; quantite: number; total_fcfa: number; statut: StatutCommande; entrees_validees: number }[];
  const actives = liste.filter((c) => c.statut === "en attente" || c.statut === "payée");
  const encaisse = liste.filter((c) => c.statut === "payée").reduce((t, c) => t + c.total_fcfa, 0);

  return (
    <>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Contrôle à l&apos;entrée</h3>
        <p className="small" style={{ marginBottom: 12 }}>
          Les supporters réservent sur le site et reçoivent un billet avec QR code. À l&apos;entrée, scannez le billet avec le téléphone, encaissez, puis faites entrer.
        </p>
        <Link className="btn gold" href="/admin/billets/scan">Scanner les billets</Link>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Matchs ouverts à la réservation</h3>
        <p className="small" style={{ marginBottom: 12 }}>
          Seuls les matchs cochés apparaissent sur la page Billetterie. Chaque catégorie en vente y propose ses places par match.
        </p>
        {matchs?.length ? (
          <Formulaire action={definirMatchsOuverts} className="matchs-ouverts">
            {[...parJour].map(([jour, liste]) => (
              <fieldset key={jour}>
                <legend>{jour}</legend>
                {liste.map((m) => (
                  <label key={m.id} className="chk">
                    <input type="checkbox" name="match" value={m.id} defaultChecked={m.reservation_ouverte} />{" "}
                    {heure(m.date_heure)} · {nomClub.get(m.club_domicile) ?? "?"} – {nomClub.get(m.club_exterieur) ?? "?"}
                  </label>
                ))}
              </fieldset>
            ))}
          </Formulaire>
        ) : (
          <p className="small">Aucun match à venir.</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Catégories et prix</h3>
        <div className="adm-list">
          {((categories ?? []) as CategorieBillet[]).map((c) => (
            <details key={c.id} className="adm-item">
              <summary><b>{c.nom}</b> <span className="small">{fcfa(c.prix_fcfa)} · {c.places_par_match} places · {c.en_vente ? "en vente" : "hors vente"}</span></summary>
              <Formulaire action={modifierCategorie}>
                <input type="hidden" name="id" value={c.id} />
                <ChampsCategorie c={c} />
              </Formulaire>
              <Formulaire action={supprimerCategorie} className="form-del" bouton="Supprimer">
                <input type="hidden" name="id" value={c.id} />
              </Formulaire>
            </details>
          ))}
        </div>
        <details style={{ marginTop: 16 }}>
          <summary className="btn line sm">Ajouter une catégorie</summary>
          <div style={{ marginTop: 12 }}>
            <Formulaire action={ajouterCategorie} bouton="Ajouter"><ChampsCategorie /></Formulaire>
          </div>
        </details>
        <p className="small" style={{ marginTop: 12 }}>Un changement de prix s&apos;applique aux nouvelles ventes uniquement.</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Dernières réservations</h3>
        {liste.length > 0 && (
          <p className="small" style={{ marginBottom: 10 }}>
            {actives.reduce((t, c) => t + c.quantite, 0)} places réservées ou payées · {liste.reduce((t, c) => t + c.entrees_validees, 0)} entrées · {fcfa(encaisse)} encaissés (100 dernières réservations)
          </p>
        )}
        {liste.length ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Référence</th><th>Nom</th><th>Téléphone</th><th className="n">Billets</th><th className="n">Montant</th><th>Statut</th><th className="n">Entrées</th></tr></thead>
              <tbody>
                {liste.map((c) => (
                  <tr key={c.reference}>
                    <td className="mono">{c.reference}</td><td>{c.nom_acheteur}</td><td className="mono">{c.telephone}</td><td className="n">{c.quantite}</td>
                    <td className="n">{fcfa(c.total_fcfa)}</td><td>{libelleStatut(c.statut)}</td><td className="n">{c.entrees_validees}/{c.quantite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small">Aucune réservation pour le moment.</p>
        )}
      </div>
    </>
  );
}
