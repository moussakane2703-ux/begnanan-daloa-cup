import type { Metadata } from "next";
import { REGLEMENT, REGLEMENT_PDF } from "@/lib/reglement";

export const metadata: Metadata = {
  title: "Règlement intérieur",
  description: "Le règlement intérieur du Bêgnanan Daloa Cup, édition 2026 : affiliation, qualification, arbitrage, discipline et sanctions.",
};

const CHIFFRES = [
  ["Droit de participation", "70 000 F", "À solder avant le 1er match (art. 2)"],
  ["Licences incluses", "10", "2 000 F la licence en plus (art. 9)"],
  ["Retard toléré", "20 min", "Au-delà, forfait (art. 12)"],
  ["Carton rouge", "1 match", "Suspension, levée possible à 5 000 F (art. 11)"],
] as const;

const enPhrase = (t: string) => {
  const s = t.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function Reglement() {
  let n = 0;
  return (
    <section className="band">
      <div className="wrap">
        <div className="head">
          <div>
            <div className="eyebrow">Règlement intérieur</div>
            <h1 className="h2">Les règles du tournoi</h1>
            <p>
              Le règlement intérieur du Bêgnanan Daloa Cup, édition 2026. Le président ou le capitaine de chaque équipe signe une copie de ce
              document avec le consentement de toute l&apos;équipe.
            </p>
          </div>
          <a className="btn gold" href={REGLEMENT_PDF} download="Reglement-interieur-BEGNANAN-2026.pdf">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16" />
            </svg>
            Télécharger le PDF
          </a>
        </div>

        <div className="grid g4 reg-kpi">
          {CHIFFRES.map(([k, v, note]) => (
            <div className="card" key={k}>
              <div className="kpi">
                <span className="k">{k}</span>
                <span className="v num">{v}</span>
              </div>
              <p className="small">{note}</p>
            </div>
          ))}
        </div>

        <div className="reg-list">
          {REGLEMENT.map(({ titre, articles }, i) => {
            const [num, ...reste] = titre.replace(/^CHAPITRE\s+/, "").split(" - ");
            const premier = n + 1;
            const items = articles.map((texte) => {
              n++;
              return (
                <li key={n}>
                  <span className="art-n">Art. {n}</span>
                  <p>{texte}</p>
                </li>
              );
            });
            return (
              <details className="card chap" key={titre} open={i === 0}>
                <summary>
                  <span className="chap-n">Chapitre {num}</span>
                  <b>{enPhrase(reste.join(" - "))}</b>
                  <span className="small">
                    Art. {premier}
                    {n > premier ? `–${n}` : ""}
                  </span>
                </summary>
                <ol className="arts">{items}</ol>
              </details>
            );
          })}
        </div>

        <p className="small reg-nb">
          <b>NB :</b> tous les cas non prévus sont tranchés par le C.O. conformément au règlement ivoirien de petit poteau (FIPP).
        </p>
      </div>
    </section>
  );
}
