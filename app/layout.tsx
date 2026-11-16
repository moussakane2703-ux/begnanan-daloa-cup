import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Apparitions } from "@/components/Apparitions";
import { Analytics } from "@vercel/analytics/next";
import { Header, TabBar } from "@/components/Navigation";
import { EnregistrementHorsLigne } from "@/components/HorsLigne";
import { PiedPartenaires } from "@/components/Partenaires";
import { SITE } from "@/lib/site";
import { DESCRIPTION, OPEN_GRAPH } from "@/lib/metadata";
import "./globals.css";


export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "BÊGNANAN DALOA CUP", template: "%s · BÊGNANAN DALOA CUP" },
  description: DESCRIPTION,
  // Adresse de référence de chaque page (www.begnanandaloacup.com) : Google ne garde qu'un exemplaire
  // même quand la page est aussi ouverte depuis begnanan-daloa-cup.vercel.app.
  alternates: { canonical: "./" },
  icons: { icon: "/logo-small.webp" },
  applicationName: "Bêgnanan Cup",
  appleWebApp: { capable: true, title: "Bêgnanan Cup", statusBarStyle: "default" },
  // Image de partage : app/opengraph-image.jpg (1200 × 630, moins de 300 Ko pour WhatsApp).
  openGraph: { ...OPEN_GRAPH, url: "./" },
  twitter: { card: "summary_large_image" },
  // Codes de vérification Google Search Console, un par adresse (begnanandaloacup.com, puis l'ancienne
  // adresse vercel.app). Publics, à ne pas retirer : Google les revérifie.
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION ?? ["8YiLuLa71a5C6ZirV9Dsa5wJbtUEWfaHEntjL9-96WQ", "WPV55VXL2QSAfQ4TGUC1bOl19LIQDppuM7XDr_F0zjE"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e6a26" };

// Applique le thème choisi avant l'affichage pour éviter un flash.
const THEME = `try{var t=localStorage.getItem("bdc-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* crossOrigin : la page peut lire les polices pour les intégrer au PDF des cartes. */}
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body data-space="public">
        <Header />
        <main>{children}</main>
        <footer>
          <PiedPartenaires />
          <div className="wrap">
            <div>
              <b style={{ fontFamily: "var(--f-display)", fontSize: "1.3rem", letterSpacing: ".03em" }}>BÊGNANAN DALOA CUP</b>
              <br />
              Comité d&apos;organisation · Espace CP1–Orly, Daloa
            </div>
            <div>Tournoi de maracana · Daloa, Côte d&apos;Ivoire</div>
          </div>
        </footer>
        <TabBar />
        <Apparitions />
        <SpeedInsights />
        <EnregistrementHorsLigne />
        <Analytics />
      </body>
    </html>
  );
}
