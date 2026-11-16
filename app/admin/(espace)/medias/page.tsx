import { Formulaire } from "@/components/admin/Formulaire";
import { LiensLive } from "@/components/admin/LiensLive";
import { ChampPhoto } from "@/components/ChampPhoto";
import { exigerAcces } from "@/lib/auth";
import { adresseDuSite } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Club, Match, Photo, Publication } from "@/lib/types";
import { TYPES_PUBLICATION } from "@/app/medias/CartePublication";
import { ajouterPhoto, ajouterPublication, modifierPublication, supprimerPhoto, supprimerPublication } from "./actions";

function ChampsPublication({ p, clubs, matchs }: { p?: Publication; clubs: Club[]; matchs: { id: string; libelle: string }[] }) {
  return (
    <>
      <label className="field">Type
        <select name="type" defaultValue={p?.type ?? "debrief"}>
          {Object.entries(TYPES_PUBLICATION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="field">Titre<input name="titre" defaultValue={p?.titre} /></label>
      <label className="field">Match lié
        <select name="match_id" defaultValue={p?.match_id ?? ""}>
          <option value="">Aucun</option>
          {matchs.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
        </select>
      </label>
      <ChampPhoto name="image" label="Image d'aperçu (affichée sur le site)" actuelle={p?.image_url} cote={1200} />
      {p?.image_url && (
        <>
          <input type="hidden" name="image_actuelle" value={p.image_url} />
          <label className="chk"><input name="sans_image" type="checkbox" /> Retirer l&apos;image</label>
        </>
      )}
      <label className="field">Lien de la publication complète (Facebook, Instagram, TikTok…)<input name="lien_url" type="url" defaultValue={p?.lien_url ?? ""} placeholder="https://" /></label>
      <label className="field">Lien vidéo (YouTube, Facebook…)<input name="video_url" type="url" defaultValue={p?.video_url ?? ""} placeholder="https://" /></label>
      <label className="field">Joueur (homme du match)<input name="joueur" defaultValue={p?.joueur ?? ""} /></label>
      <label className="field">Club du joueur
        <select name="club_id" defaultValue={p?.club_id ?? ""}>
          <option value="">—</option>
          {clubs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </label>
      <label className="field full">Texte<textarea name="texte" rows={4} defaultValue={p?.texte} /></label>
      <label className="chk"><input name="publiee" type="checkbox" defaultChecked={p?.publiee} /> Publier sur le site</label>
    </>
  );
}

export default async function AdminMedias() {
  await exigerAcces("medias");
  const db = await createClient();
  const [{ data: pubs }, { data: clubs }, { data: matchs }, { data: photos }, abonnes] = await Promise.all([
    db.from("publications").select("*").order("cree_le", { ascending: false }),
    db.from("clubs").select("*").order("nom"),
    db.from("matchs").select("*").order("date_heure"),
    db.from("galerie").select("*").order("ordre"),
    db.from("abonnes_alertes").select("id", { count: "exact", head: true }),
  ]);
  const listeClubs = (clubs ?? []) as Club[];
  const nom = new Map(listeClubs.map((c) => [c.id, c.sigle]));
  const choixMatchs = ((matchs ?? []) as Match[]).map((m) => ({
    id: m.id,
    libelle: `${nom.get(m.club_domicile)} – ${nom.get(m.club_exterieur)} · ${new Date(m.date_heure).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Abidjan" })}`,
  }));

  const site = await adresseDuSite();
  return (
    <>
      <LiensLive site={site} />
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Nouvelle publication</h3>
        <Formulaire action={ajouterPublication} bouton="Enregistrer">
          <ChampsPublication clubs={listeClubs} matchs={choixMatchs} />
        </Formulaire>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Publications</h3>
        {!pubs?.length && <p className="small">Aucune publication.</p>}
        <div className="adm-list">
          {((pubs ?? []) as Publication[]).map((p) => (
            <details key={p.id} className="adm-item">
              <summary>
                <b>{p.type === "hdm" ? `${p.titre} : ${p.joueur}` : p.titre}</b>{" "}
                <span className="small">{TYPES_PUBLICATION[p.type]} · {p.publiee ? "en ligne" : "brouillon"}</span>
              </summary>
              <Formulaire action={modifierPublication}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="publiee_le" value={p.publiee_le ?? ""} />
                <ChampsPublication p={p} clubs={listeClubs} matchs={choixMatchs} />
              </Formulaire>
              <Formulaire action={supprimerPublication} className="form-del" bouton="Supprimer" confirmer="Supprimer cette publication ?">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="image_actuelle" value={p.image_url ?? ""} />
              </Formulaire>
            </details>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Galerie</h3>
        <Formulaire action={ajouterPhoto} bouton="Ajouter la photo">
          <ChampPhoto name="photo" label="Photo" cote={1600} />
          <label className="field">Légende<input name="legende" /></label>
          <label className="field">Ou lien d&apos;une image en ligne (https)<input name="image_url" type="url" placeholder="https://" /></label>
        </Formulaire>
        <div className="gal-adm" style={{ marginTop: 16 }}>
          {((photos ?? []) as Photo[]).map((g) => (
            <div key={g.id} className="ga">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="ga-img">{g.image_url ? <img src={g.image_url} alt="" /> : "Photo à venir"}</div>
              <span className="small">{g.legende}</span>
              <Formulaire action={supprimerPhoto} className="form-del" bouton="Retirer" confirmer="Retirer cette photo ?">
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="image_actuelle" value={g.image_url ?? ""} />
              </Formulaire>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Alertes WhatsApp</h3>
        <p className="small">{abonnes.count ?? 0} supporter{(abonnes.count ?? 0) > 1 ? "s" : ""} inscrit{(abonnes.count ?? 0) > 1 ? "s" : ""}. L&apos;envoi automatique sera branché avec WhatsApp Business dans une prochaine version.</p>
      </div>
    </>
  );
}
