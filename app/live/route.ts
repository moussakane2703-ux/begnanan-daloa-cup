// Tableau d'affichage des lives (Facebook, TikTok, YouTube) : page à ajouter comme « source
// navigateur » dans OBS, ou comme « widget web » dans Prism Live Studio sur téléphone.
// Fond transparent, sans menu ni pied de page du site : elle échappe donc au gabarit commun
// (app/layout.tsx) et renvoie sa propre page HTML. Le score, le chrono, les buts et les cartons
// viennent de la saisie du comité dans Espace pro → Match en direct ; rien d'autre à faire.
//
// Réglages dans l'adresse :
//   ?match=<id>      un match précis (sinon : le match en cours, ou le prochain)
//   ?format=bandeau  score en haut à gauche, pour un live horizontal (par défaut)
//   ?format=vertical score en haut au centre, pour TikTok et les stories (9:16)
//   ?format=plein    écran plein (avant-match, mi-temps, fin de match), sur fond vert du tournoi
//   ?fond=vert       fond vert vif à détourer (applis de live sans transparence) ; ?fond=noir
//   ?sponsors=0      sans la ronde des logos partenaires
//   ?demo=1          match fictif qui se joue tout seul, pour régler la scène avant le tournoi

export const dynamic = "force-dynamic";

const echapper = (s: string) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const format = ["vertical", "plein"].includes(p.get("format") ?? "") ? p.get("format")! : "bandeau";
  const fond = ["vert", "noir"].includes(p.get("fond") ?? "") ? p.get("fond")! : "transparent";
  const config = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    cle: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    match: /^[0-9a-f-]{36}$/i.test(p.get("match") ?? "") ? p.get("match") : null,
    format,
    sponsors: p.get("sponsors") !== "0",
    demo: p.get("demo") === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL,
  };
  // « </ » ne doit pas fermer la balise script.
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Tableau d'affichage · BÊGNANAN DALOA CUP</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Figtree:wght@600;700;800&family=JetBrains+Mono:wght@700&display=swap">
<link rel="stylesheet" href="/tableau-live/tableau.css?v=1">
</head>
<body class="format-${echapper(format)} fond-${echapper(fond)}">
<div id="scene" class="scene"></div>
<script id="config" type="application/json">${json}</script>
<script src="/tableau-live/tableau.js?v=1"></script>
</body>
</html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

/** OBS et Prism n'envoient que des GET ; HEAD sert à caler l'heure du PC sur celle du serveur. */
export function HEAD() {
  return new Response(null, { headers: { "cache-control": "no-store" } });
}
