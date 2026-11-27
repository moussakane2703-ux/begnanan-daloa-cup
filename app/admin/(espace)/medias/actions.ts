"use server";

import { coche, ecrire, entier, texte, texteOuNull, type Etat } from "@/lib/admin";
import { exigerAcces } from "@/lib/auth";
import { deposerPhoto, fichierPhoto, photoInvalide, retirerPhotos } from "@/lib/photos";
import { createServiceClient } from "@/lib/supabase/server";

/** Dépose l'image jointe dans le stockage (dossier « medias ») ; url null si aucun fichier. */
async function imageJointe(f: FormData, champ: string, dossier: string): Promise<{ url: string | null } | { erreur: string }> {
  await exigerAcces("medias");
  const fichier = fichierPhoto(f, champ);
  const invalide = photoInvalide(fichier);
  if (invalide) return { erreur: invalide.replace("Photo", "Image") };
  try {
    return { url: await deposerPhoto(createServiceClient(), dossier, fichier) };
  } catch (e) {
    return { erreur: (e as Error).message };
  }
}

function publication(f: FormData) {
  const publiee = coche(f, "publiee");
  return {
    type: texte(f, "type") as "debrief" | "annonce" | "hdm",
    titre: texte(f, "titre") || (texte(f, "type") === "hdm" ? "Homme du match" : ""),
    texte: texte(f, "texte"),
    match_id: texteOuNull(f, "match_id"),
    joueur: texteOuNull(f, "joueur"),
    club_id: texteOuNull(f, "club_id"),
    video_url: texteOuNull(f, "video_url"),
    lien_url: texteOuNull(f, "lien_url"),
    publiee,
  };
}

const verifier = (p: ReturnType<typeof publication>) => {
  if (!p.titre) return "Le titre est obligatoire.";
  if (p.type === "hdm" && (!p.joueur || !p.club_id)) return "Pour un homme du match, indiquez le joueur et son club.";
  if (p.video_url && !p.video_url.startsWith("https://")) return "Le lien vidéo doit commencer par https://";
  if (p.lien_url && !p.lien_url.startsWith("https://")) return "Le lien de la publication doit commencer par https://";
  return null;
};

/**
 * Homme du match publié dans les médias et lié à un match : il est aussi inscrit sur la carte
 * du match (page Résultats), sauf si le comité en a déjà désigné un depuis « Match en direct ».
 */
async function reporterHommeDuMatch(p: ReturnType<typeof publication>) {
  if (p.type !== "hdm" || !p.publiee || !p.match_id || !p.joueur || !p.club_id) return;
  await exigerAcces("medias");
  const db = createServiceClient();
  await db
    .from("matchs")
    .update({ hdm_nom: p.joueur.slice(0, 150), hdm_club_id: p.club_id, hdm_joueur_id: null })
    .eq("id", p.match_id)
    .is("hdm_nom", null)
    .or(`club_domicile.eq.${p.club_id},club_exterieur.eq.${p.club_id}`);
}

export async function ajouterPublication(_: Etat, f: FormData): Promise<Etat> {
  const p = publication(f);
  const erreur = verifier(p);
  if (erreur) return { erreur };
  const image = await imageJointe(f, "image", "medias");
  if ("erreur" in image) return image;
  const r = await ecrire(
    "medias",
    (db) => db.from("publications").insert({ ...p, image_url: image.url, publiee_le: p.publiee ? new Date().toISOString() : null }),
    p.publiee ? "Publié." : "Brouillon enregistré.",
  );
  if (r.erreur) await retirerPhotos([image.url]);
  else await reporterHommeDuMatch(p);
  return r;
}

export async function modifierPublication(_: Etat, f: FormData): Promise<Etat> {
  const p = publication(f);
  const erreur = verifier(p);
  if (erreur) return { erreur };
  // La date de publication est fixée au premier passage en ligne.
  const dejaPubliee = texte(f, "publiee_le");
  const publiee_le = p.publiee ? dejaPubliee || new Date().toISOString() : null;
  // Nouvelle image : elle remplace l'ancienne, retirée du stockage une fois l'enregistrement fait.
  const image = await imageJointe(f, "image", "medias");
  if ("erreur" in image) return image;
  const ancienne = texte(f, "image_actuelle") || null;
  const retirer = coche(f, "sans_image");
  const image_url = image.url ?? (retirer ? null : ancienne);
  const r = await ecrire("medias", (db) => db.from("publications").update({ ...p, image_url, publiee_le }).eq("id", texte(f, "id")));
  await retirerPhotos(r.erreur ? [image.url] : image_url !== ancienne ? [ancienne] : []);
  if (!r.erreur) await reporterHommeDuMatch(p);
  return r;
}

export async function supprimerPublication(_: Etat, f: FormData): Promise<Etat> {
  const r = await ecrire("medias", (db) => db.from("publications").delete().eq("id", texte(f, "id")), "Supprimé.");
  if (r.ok) await retirerPhotos([texte(f, "image_actuelle")]);
  return r;
}

/** Photo de la galerie : envoyée depuis le téléphone (ou, à défaut, un lien vers une image en ligne). */
export async function ajouterPhoto(_: Etat, f: FormData): Promise<Etat> {
  const image = await imageJointe(f, "photo", "galerie");
  if ("erreur" in image) return image;
  const image_url = image.url ?? texte(f, "image_url");
  if (!image_url) return { erreur: "Choisissez une photo." };
  if (!image_url.startsWith("https://")) return { erreur: "Le lien de l'image doit commencer par https://" };
  const r = await ecrire("medias", (db) => db.from("galerie").insert({ image_url, legende: texte(f, "legende"), ordre: entier(f, "ordre") ?? 0 }), "Photo ajoutée.");
  if (r.erreur) await retirerPhotos([image.url]);
  return r;
}

export async function supprimerPhoto(_: Etat, f: FormData): Promise<Etat> {
  const r = await ecrire("medias", (db) => db.from("galerie").delete().eq("id", texte(f, "id")), "Photo retirée.");
  if (r.ok) await retirerPhotos([texte(f, "image_actuelle")]);
  return r;
}
