"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const LIENS = [
  ["/", "Accueil"],
  ["/matchs", "Matchs"],
  ["/medias", "Médias"],
  ["/classements", "Classements"],
  ["/equipes", "Clubs"],
  ["/billetterie", "Billetterie"],
  ["/infos", "Infos"],
  ["/reglement", "Règlement"],
] as const;

const actif = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function basculerTheme() {
  const d = document.documentElement;
  const cur = d.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  d.dataset.theme = cur === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("bdc-theme", d.dataset.theme);
  } catch {}
}

export function Header() {
  const path = usePathname();
  // Espace pro et espace club : en-tête réduit, sans la navigation du site.
  const admin = path.startsWith("/admin") || path.startsWith("/espace-club");
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/">
          <Image className="logo-slot" src="/logo-small.webp" alt="Logo BÊGNANAN DALOA CUP" width={46} height={45} priority />
          <div className="brand-name">
            Bêgnanan Daloa Cup<small>Tournoi de maracana · 2026</small>
          </div>
        </Link>
        {!admin && (
          <nav className="main-nav" aria-label="Navigation principale">
            {LIENS.map(([href, label]) => (
              <Link key={href} href={href} className={actif(path, href) ? "on" : ""}>
                {label}
              </Link>
            ))}
          </nav>
        )}
        <div className="pro" style={admin ? { marginLeft: "auto" } : undefined}>
          <Link className="pro-btn" href={admin ? "/" : "/admin"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>{admin ? "Site public" : "Espace pro"}</span>
          </Link>
        </div>
        <button className="theme-btn" onClick={basculerTheme} aria-label="Changer de thème">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>
      </div>
      {!admin && <Rubriques path={path} />}
    </header>
  );
}

// Sur téléphone : toutes les rubriques sur une ligne qu'on fait glisser, sous l'en-tête.
function Rubriques({ path }: { path: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("a.on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [path]);
  return (
    <nav className="sub rubriques" ref={ref} aria-label="Rubriques">
      <div className="wrap">
        {LIENS.map(([href, label]) => (
          <Link key={href} href={href} className={actif(path, href) ? "on" : ""}>
            {label}
          </Link>
        ))}
        <Link href="/espace-club">Espace club</Link>
        <Link href="/admin">🔒 Espace pro</Link>
      </div>
    </nav>
  );
}

const ICONES: Record<string, React.ReactNode> = {
  "/": <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  "/billetterie": <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />,
  "/matchs": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 4 3-1.5 4.5h-5L8 10z" />
    </>
  ),
  "/classements": <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  "/medias": (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  "/infos": (
    <>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
};

// Barre du bas sur téléphone : les cinq rubriques les plus utiles, toujours visibles.
const ONGLETS = [
  ["/", "Accueil"],
  ["/matchs", "Matchs"],
  ["/medias", "Médias"],
  ["/billetterie", "Billets"],
  ["/infos", "Infos"],
] as const;

export function TabBar() {
  const path = usePathname();
  if (path.startsWith("/admin") || path.startsWith("/espace-club")) return null;
  return (
    <nav className="tabbar" aria-label="Navigation">
      {ONGLETS.map(([href, label]) => (
        <Link key={href} href={href} className={actif(path, href) ? "on" : ""}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONES[href]}
          </svg>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
