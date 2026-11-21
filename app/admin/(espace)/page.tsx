import Link from "next/link";
import { Formulaire } from "@/components/admin/Formulaire";
import { exigerAcces, peutVoir } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { changerMotDePasse } from "./actions";

function MotDePasse() {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3 style={{ marginBottom: 12 }}>Mon mot de passe</h3>
      <Formulaire action={changerMotDePasse} bouton="Changer le mot de passe">
        <label className="field">Nouveau mot de passe<input name="motdepasse" type="password" minLength={10} required autoComplete="new-password" /></label>
        <label className="field">Confirmation<input name="confirmation" type="password" minLength={10} required autoComplete="new-password" /></label>
      </Formulaire>
    </div>
  );
}

export default async function TableauDeBord() {
  const orga = await exigerAcces();
  const db = await createClient();
  const [clubs, matchs, commandes] = await Promise.all([
    db.from("clubs").select("id", { count: "exact", head: true }),
    db.from("matchs").select("statut, resultat_valide"),
    peutVoir(orga.role, "billets") ? db.from("commandes").select("quantite, total_fcfa").eq("statut", "payée") : Promise.resolve({ data: [] }),
  ]);
  const reserves = peutVoir(orga.role, "billets")
    ? await db.from("billets").select("id, commandes!inner(statut)", { count: "exact", head: true }).in("commandes.statut", ["en attente", "payée"])
    : { count: 0 };
  const liste = matchs.data ?? [];
  const aValider = liste.filter((m) => m.statut === "terminé" && !m.resultat_valide).length;
  const ventes = commandes.data ?? [];

  const kpis: [string, string | number, string?][] = [
    ["Clubs inscrits", clubs.count ?? 0],
    ["Matchs joués", liste.filter((m) => m.statut === "terminé").length],
    ["Résultats à valider", aValider, peutVoir(orga.role, "matchs") ? "/admin/matchs" : undefined],
  ];
  if (peutVoir(orga.role, "licences")) {
    const [demandes, licences, encadrement, transferts, modifications, messages] = await Promise.all([
      db.from("demandes_club").select("id", { count: "exact", head: true }).eq("statut", "en attente"),
      db.from("joueurs").select("id", { count: "exact", head: true }).eq("etat", "soumise"),
      db.from("encadrants").select("id", { count: "exact", head: true }).eq("valide", false),
      db.from("transferts").select("id", { count: "exact", head: true }).in("statut", ["demandé", "accepté par le club"]),
      db.from("modifications_club").select("id", { count: "exact", head: true }).eq("statut", "en attente"),
      db.from("messages_club").select("id", { count: "exact", head: true }).eq("de_comite", false).eq("lu", false),
    ]);
    kpis.push(
      ["Demandes d'inscription", demandes.count ?? 0, "/admin/licences"],
      ["Licences à contrôler", licences.count ?? 0, "/admin/licences"],
      ["Cartes d'encadrement à valider", encadrement.count ?? 0, "/admin/licences"],
      ["Transferts en cours", transferts.count ?? 0, "/admin/mercato"],
      ["Modifications demandées par les clubs", modifications.count ?? 0, "/admin/licences"],
      ["Messages des clubs non lus", messages.count ?? 0, "/admin/messages"],
    );
  }
  if (peutVoir(orga.role, "billets")) {
    kpis.push(["Tickets réservés", reserves.count ?? 0, "/admin/billets"], ["Billets vendus", ventes.reduce((s, c) => s + c.quantite, 0)], ["Recettes", fcfa(ventes.reduce((s, c) => s + c.total_fcfa, 0))]);
  }

  return (
    <>
      <div className="grid g4">
        {kpis.map(([k, v, lien]) => (
          <div key={k} className="card">
            <div className="kpi"><span className="k">{k}</span><span className="v num">{v}</span></div>
            {lien && <Link className="small" href={lien}>Ouvrir</Link>}
          </div>
        ))}
      </div>
      <MotDePasse />
    </>
  );
}
