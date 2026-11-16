import Link from "next/link";
import { Formulaire } from "@/components/admin/Formulaire";
import { LiensLive } from "@/components/admin/LiensLive";
import { ChronoComite } from "@/components/ChronoMatch";
import { StatutPill } from "@/components/StatutMatch";
import { TirsAuBut } from "@/components/TirsAuBut";
import { exigerAcces } from "@/lib/auth";
import { bilanTirs, type Durees } from "@/lib/chrono";
import { heure, jourCourt } from "@/lib/format";
import { adresseDuSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { EVENEMENTS, type Club, type EvenementMatch, type Match, type TirAuBut, type Tournoi } from "@/lib/types";
import { changerStatut, choisirHommeDuMatch, reglerTemps, retirerEvenement, retirerTir } from "./actions";
import { CommandesChrono, SaisieEquipe, SaisieTir } from "./Saisie";

/** Match en direct : chrono, buts, cartons et tirs au but saisis depuis le téléphone, score mis à jour sur le site. */
export default async function Direct({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  await exigerAcces("direct");
  const db = await createClient();
  const [{ data: m }, { data: c }, { data: t }] = await Promise.all([
    db.from("matchs").select("*").in("statut", ["programmé", "en cours", "terminé"]).order("date_heure"),
    db.from("clubs").select("id, nom"),
    db.from("tournoi").select("*").eq("id", 1).single<Tournoi>(),
  ]);
  const durees: Durees = { mi_temps: t?.duree_mi_temps ?? null, prolongation: t?.duree_prolongation ?? null };
  const tireurs = t?.tab_tireurs ?? 3;
  const demande = (await searchParams).match;
  // Les matchs validés restent accessibles depuis « Clubs et matchs » (Homme du match), sans figurer dans la liste.
  const matchs = ((m ?? []) as Match[]).filter((x) => !x.resultat_valide || x.id === demande);
  const clubs = new Map(((c ?? []) as Pick<Club, "id" | "nom">[]).map((x) => [x.id, x]));
  const nom = (id: string) => clubs.get(id)?.nom ?? "?";
  const match = matchs.find((x) => x.id === demande) ?? matchs.find((x) => x.statut === "en cours") ?? matchs.find((x) => x.statut === "programmé");
  const site = await adresseDuSite();

  if (!match) {
    return (
      <>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Match en direct</h3>
        <p className="small">Aucun match à suivre : ajoutez les matchs dans « Clubs et matchs ». Les matchs dont le résultat est validé n&apos;apparaissent plus ici.</p>
      </div>
      <LiensLive site={site} />
      </>
    );
  }

  const [{ data: e }, { data: j }, { data: tab }] = await Promise.all([
    db.from("evenements_match").select("*").eq("match_id", match.id).order("minute", { nullsFirst: false }).order("cree_le"),
    db.from("joueurs").select("id, nom, prenoms, numero_maillot, club_id").in("club_id", [match.club_domicile, match.club_exterieur]).eq("etat", "active").order("nom"),
    db.from("tirs_au_but").select("*").eq("match_id", match.id).order("ordre"),
  ]);
  const tirs = (tab ?? []) as TirAuBut[];
  const seance = match.periode === "tab" && match.statut === "en cours";
  const bilan = bilanTirs(tirs, match.club_domicile, match.club_exterieur, tireurs);
  const aSonTour = (club: string) => !bilan.vainqueur && (bilan.prochain === null || bilan.prochain === club);
  const equipes = [match.club_domicile, match.club_exterieur].map((id) => ({ id, nom: nom(id) }));
  const evenements = (e ?? []) as EvenementMatch[];
  const joueurs = (j ?? []) as { id: string; nom: string; prenoms: string; numero_maillot: number | null; club_id: string }[];
  const liste = (club: string) =>
    joueurs.filter((x) => x.club_id === club).map((x) => ({ id: x.id, nom: `${x.numero_maillot ? `${x.numero_maillot}. ` : ""}${x.prenoms} ${x.nom}` }));

  return (
    <>
      <div className="card">
        <form method="get" className="form-row" style={{ marginTop: 0 }}>
          <label className="field">Match
            <select name="match" defaultValue={match.id}>
              {matchs.map((x) => (
                <option key={x.id} value={x.id}>{jourCourt(x.date_heure)} {heure(x.date_heure)} · {nom(x.club_domicile)} – {nom(x.club_exterieur)} ({x.resultat_valide ? "validé" : x.statut})</option>
              ))}
            </select>
          </label>
          <button className="btn line sm">Afficher</button>
        </form>
      </div>

      <div className="card direct-score">
        <StatutPill statut={match.statut} />
        <div className="direct-tableau">
          <span>{nom(match.club_domicile)}</span>
          <b className="num">{match.buts_domicile ?? 0} – {match.buts_exterieur ?? 0}</b>
          <span>{nom(match.club_exterieur)}</span>
        </div>
        {match.tab_domicile != null && <span className="small">Tirs au but : <b className="num">{match.tab_domicile} – {match.tab_exterieur}</b></span>}
        {match.statut === "en cours" && <ChronoComite chrono={match} durees={durees} />}
        {match.statut === "en cours" && match.periode && <CommandesChrono key={`${match.periode}-${match.periode_terminee}-${match.chrono_lance}`} matchId={match.id} chrono={match} />}
        <div className="form-row" style={{ justifyContent: "center" }}>
          {match.statut === "programmé" && (
            <Formulaire action={changerStatut} bouton="Coup d'envoi" className="form-row">
              <input type="hidden" name="match_id" value={match.id} />
              <input type="hidden" name="statut" value="en cours" />
            </Formulaire>
          )}
          {match.statut === "en cours" && (
            <Formulaire action={changerStatut} bouton="Fin du match" className="form-row" confirmer={seance && !bilan.vainqueur ? "La séance de tirs au but n'a pas de vainqueur. Terminer quand même le match ?" : "Terminer le match ?"}>
              <input type="hidden" name="match_id" value={match.id} />
              <input type="hidden" name="statut" value="terminé" />
            </Formulaire>
          )}
          <Link className="btn line sm" href={`/matchs/${match.id}`} target="_blank">Voir la page publique</Link>
        </div>
        <p className="small" style={{ marginTop: 8 }}>
          Le score se calcule à partir des buts saisis ici. Le résultat devient officiel quand vous le validez dans « Clubs et matchs ».
        </p>
      </div>

      <LiensLive site={site} matchId={match.id} matchNom={`${nom(match.club_domicile)} – ${nom(match.club_exterieur)}`} />

      {(seance || tirs.length > 0) && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Tirs au but</h3>
          <TirsAuBut tirs={tirs} equipes={equipes} tireurs={tireurs} />
          {tirs.length > 0 && (
            <div className="adm-list" style={{ marginTop: 10 }}>
              {[...tirs].reverse().map((x, i) => (
                <div key={x.id} className="adm-item direct-ligne">
                  <span className="num">{x.ordre}</span>
                  <span>{x.reussi ? "✅ Marqué" : "❌ Manqué"} · <b>{x.joueur_nom ?? "tireur non précisé"}</b> <span className="small">({nom(x.club_id)})</span></span>
                  {i === 0 && (
                    <Formulaire action={retirerTir} bouton="Annuler" className="form-row" confirmer="Annuler ce tir ?">
                      <input type="hidden" name="id" value={x.id} />
                    </Formulaire>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {match.resultat_valide && (
        <div className="card"><p className="small">Résultat validé : les buts et cartons ne se modifient plus (retirez la validation dans « Clubs et matchs » pour corriger).</p></div>
      )}

      {!match.resultat_valide && <div className="direct-equipes">
        {seance
          ? equipes.map((e) => <SaisieTir key={e.id} matchId={match.id} club={e} joueurs={liste(e.id)} aSonTour={aSonTour(e.id)} />)
          : equipes.map((e) => <SaisieEquipe key={e.id} matchId={match.id} club={e} joueurs={liste(e.id)} />)}
      </div>}

      {"hdm_nom" in match && (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>⭐ Homme du match</h3>
          <p className="small" style={{ marginBottom: 10 }}>
            {match.hdm_nom ? <>Actuellement : <b>{match.hdm_nom}</b> ({nom(match.hdm_club_id ?? "")}). </> : "Pas encore désigné. "}
            Il apparaît sur la carte du match et sur l&apos;affiche du résultat.
          </p>
          <Formulaire action={choisirHommeDuMatch} bouton="Enregistrer" className="form-row">
            <input type="hidden" name="match_id" value={match.id} />
            <label className="field" style={{ flex: "2 1 220px" }}>Joueur
              <select name="hdm" defaultValue={match.hdm_joueur_id ?? (match.hdm_nom ? `libre:${match.hdm_club_id}` : "")}>
                <option value="">Aucun</option>
                {equipes.map((e) => (
                  <optgroup key={e.id} label={e.nom}>
                    {liste(e.id).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
                    <option value={`libre:${e.id}`}>Autre joueur de {e.nom} (nom ci-contre)</option>
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: "1 1 160px" }}>Nom (si « autre joueur »)<input name="hdm_libre" maxLength={150} defaultValue={match.hdm_joueur_id ? "" : match.hdm_nom ?? ""} /></label>
          </Formulaire>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Déroulé ({evenements.length})</h3>
        {!evenements.length && <p className="small">Rien pour l&apos;instant.</p>}
        <div className="adm-list">
          {evenements.map((x) => (
            <div key={x.id} className="adm-item direct-ligne">
              <span className="num">{x.minute !== null ? `${x.minute}'` : "–"}</span>
              <span>{EVENEMENTS[x.type].icone} {EVENEMENTS[x.type].libelle} · <b>{x.joueur_nom ?? "joueur non précisé"}</b> <span className="small">({x.type === "csc" ? `compté pour ${nom(x.club_id)}` : nom(x.club_id)})</span></span>
              <Formulaire action={retirerEvenement} bouton="Annuler" className="form-row" confirmer="Annuler cette saisie ?">
                <input type="hidden" name="id" value={x.id} />
              </Formulaire>
            </div>
          ))}
        </div>
      </div>

      <details className="card">
        <summary><b>Temps de jeu</b> <span className="small">{durees.mi_temps ? `mi-temps de ${durees.mi_temps} min` : "durée des mi-temps à confirmer"}{durees.prolongation ? `, prolongations de ${durees.prolongation} min` : ""} · {tireurs} tireurs aux tirs au but</span></summary>
        <Formulaire action={reglerTemps}>
          <label className="field">Durée d&apos;une mi-temps (minutes)<input name="duree_mi_temps" type="number" min={1} max={60} defaultValue={durees.mi_temps ?? ""} /></label>
          <label className="field">Durée d&apos;une prolongation (minutes)<input name="duree_prolongation" type="number" min={1} max={30} defaultValue={durees.prolongation ?? ""} /></label>
          <label className="field">Tireurs par équipe aux tirs au but<input name="tab_tireurs" type="number" min={1} max={11} defaultValue={tireurs} /></label>
        </Formulaire>
        <p className="small" style={{ marginTop: 8 }}>Après ces tirs, en cas d&apos;égalité : un tireur par équipe jusqu&apos;à ce qu&apos;une équipe prenne l&apos;avantage.</p>
      </details>
    </>
  );
}
