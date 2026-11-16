import type { Club, Partenaire } from "@/lib/types";

/**
 * Adresse d'image utilisable sur une affiche : les logos hébergés par le site sont lus depuis la même
 * adresse que la page (sinon le navigateur refuse de les copier dans l'image).
 */
export function imageAffiche(url: string | null | undefined) {
  if (!url) return null;
  const local = url.match(/^https:\/\/(?:begnanan-daloa-cup\.vercel\.app|(?:www\.)?begnanandaloacup\.com)(\/.*)$/);
  return local ? local[1] : url;
}

/** Logo d'un club en grand, sur pastille blanche (ou sigle aux couleurs du club). */
export function LogoAffiche({ club, taille }: { club?: Club; taille: number }) {
  const src = imageAffiche(club?.logo_url);
  return (
    <div className="aff-logo" style={{ width: taille, height: taille, background: src ? "#fff" : club?.couleur ?? "#333", fontSize: taille / 3 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" crossOrigin={src.startsWith("http") ? "anonymous" : undefined} /> : club?.sigle ?? "?"}
    </div>
  );
}

/** En-tête commun : logo du tournoi, nom et titre de l'affiche. */
export function EnteteAffiche({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <div className="aff-entete">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.webp" alt="" />
      <div>
        <div className="aff-tournoi">BÊGNANAN DALOA CUP</div>
        <div className="aff-titre">{titre}</div>
        <div className="aff-sous">{sousTitre}</div>
      </div>
    </div>
  );
}

/** Bandeau des partenaires en bas de l'affiche. */
export function PartenairesAffiche({ partenaires }: { partenaires: Partenaire[] }) {
  if (!partenaires.length) return null;
  return (
    <div className="aff-partenaires">
      <div className="aff-partenaires-titre">Nos partenaires</div>
      <div className="aff-partenaires-logos">
        {partenaires.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={imageAffiche(p.logo_url) ?? ""} alt="" />
        ))}
      </div>
    </div>
  );
}
