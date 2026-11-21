import { bilanReservations, type BilletReserve, type Compteurs } from "@/lib/billet";
import { heure, jourCourt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { CategorieBillet } from "@/lib/types";

type Db = Awaited<ReturnType<typeof createClient>>;
type LigneBillet = { paye_le: string | null; utilise_le: string | null; commandes: { match_id: string; categorie_id: string } | { match_id: string; categorie_id: string }[] };

/** Tous les billets des réservations en cours ou payées (par paquets de 1 000, la limite de Supabase). */
async function billetsReserves(db: Db): Promise<BilletReserve[]> {
  const tous: BilletReserve[] = [];
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await db
      .from("billets")
      .select("paye_le, utilise_le, commandes!inner(match_id, categorie_id, statut)")
      .in("commandes.statut", ["en attente", "payée"])
      .order("id")
      .range(debut, debut + 999);
    if (error || !data) break;
    for (const l of data as unknown as LigneBillet[]) {
      const co = Array.isArray(l.commandes) ? l.commandes[0] : l.commandes;
      if (co) tous.push({ match_id: co.match_id, categorie_id: co.categorie_id, paye: l.paye_le !== null, entre: l.utilise_le !== null });
    }
    if (data.length < 1000) break;
  }
  return tous;
}

function Detail({ c }: { c: Compteurs }) {
  return (
    <span className="small">
      {c.payes} payé{c.payes > 1 ? "s" : ""} · {c.aPayer} à payer sur place · {c.entres} entré{c.entres > 1 ? "s" : ""}
    </span>
  );
}

/** Section « Tickets réservés » de l'espace pro : combien de places sont prises, payées et utilisées. */
export async function BilanTickets({ categories }: { categories: CategorieBillet[] }) {
  const db = await createClient();
  const billets = await billetsReserves(db);
  const bilan = bilanReservations(billets);
  const idsMatchs = [...bilan.parMatch.keys()];
  const [{ data: matchs }, { data: clubs }] = await Promise.all([
    idsMatchs.length
      ? db.from("matchs").select("id, date_heure, club_domicile, club_exterieur, statut").in("id", idsMatchs).order("date_heure")
      : Promise.resolve({ data: [] as { id: string; date_heure: string; club_domicile: string | null; club_exterieur: string | null; statut: string }[] }),
    db.from("clubs").select("id, nom"),
  ]);
  const nomClub = new Map((clubs ?? []).map((c) => [c.id as string, c.nom as string]));
  // Catégories connues d'abord (dans leur ordre), puis celles qui auraient été supprimées depuis.
  const cats = [...categories];
  for (const id of bilan.parCategorie.keys()) if (!cats.some((c) => c.id === id)) cats.push({ id, nom: "Autre", description: "", prix_fcfa: 0, places_par_match: 0, en_vente: false, ordre: 999 });
  const catsVues = cats.filter((c) => bilan.parCategorie.has(c.id) || c.en_vente);
  const t = bilan.total;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Tickets réservés</h3>
      <p className="small" style={{ marginBottom: 12 }}>
        Toutes les places réservées sur le site pour le Bêgnanan Daloa Cup (réservations annulées non comptées).
      </p>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {([
          ["Tickets réservés", t.reserves],
          ["Déjà payés", t.payes],
          ["À payer sur place", t.aPayer],
          ["Entrées validées", t.entres],
        ] as const).map(([k, v]) => (
          <div key={k} className="kpi"><span className="k">{k}</span><span className="v num">{v}</span></div>
        ))}
      </div>

      {catsVues.length > 0 && (
        <div className="grid g4" style={{ marginBottom: 16 }}>
          {catsVues.map((c) => {
            const n = bilan.parCategorie.get(c.id);
            return (
              <div key={c.id} className="kpi">
                <span className="k">{c.nom}</span>
                <span className="v num" style={{ fontSize: "1.8rem" }}>{n?.reserves ?? 0}</span>
                {n && <Detail c={n} />}
              </div>
            );
          })}
        </div>
      )}

      {matchs?.length ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Match</th>
                {catsVues.map((c) => <th key={c.id} className="n">{c.nom}</th>)}
                <th className="n">Total</th><th className="n">Payés</th><th className="n">À payer</th><th className="n">Entrées</th>
              </tr>
            </thead>
            <tbody>
              {matchs.map((m) => {
                const b = bilan.parMatch.get(m.id)!;
                return (
                  <tr key={m.id}>
                    <td>
                      <b>{nomClub.get(m.club_domicile ?? "") ?? "?"} – {nomClub.get(m.club_exterieur ?? "") ?? "?"}</b>
                      <div className="small">{jourCourt(m.date_heure)} · {heure(m.date_heure)}{m.statut === "terminé" ? " · terminé" : ""}</div>
                    </td>
                    {catsVues.map((c) => {
                      const n = b.parCategorie.get(c.id)?.reserves ?? 0;
                      return <td key={c.id} className="n">{n}{c.places_par_match > 0 && <span className="small"> / {c.places_par_match}</span>}</td>;
                    })}
                    <td className="n"><b>{b.total.reserves}</b></td>
                    <td className="n">{b.total.payes}</td>
                    <td className="n">{b.total.aPayer}</td>
                    <td className="n">{b.total.entres}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small">Aucun ticket réservé pour le moment.</p>
      )}
    </div>
  );
}
