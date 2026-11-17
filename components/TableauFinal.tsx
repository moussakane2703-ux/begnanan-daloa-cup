import { COTE_DROIT, COTE_GAUCHE, FINALE, type RencontreFinale } from "@/lib/phasesFinales";

function Rencontre({ r, finale }: { r: RencontreFinale; finale?: boolean }) {
  return (
    <div className={`tf-match${finale ? " tf-finale" : ""}`}>
      <div className="tf-tete"><b>{r.code}</b><span>{r.date}</span></div>
      <div className="tf-eq">{r.equipes[0]}</div>
      <div className="tf-eq">{r.equipes[1]}</div>
    </div>
  );
}

function Tour({ titre, rencontres }: { titre: string; rencontres: RencontreFinale[] }) {
  return (
    <div className="tf-tour">
      <div className="tf-titre">{titre}</div>
      <div className="tf-col">{rencontres.map((r) => <Rencontre key={r.code} r={r} />)}</div>
    </div>
  );
}

/** Tableau des phases finales : moitié gauche, finale au centre, moitié droite. */
export function TableauFinal() {
  return (
    <div className="tf-scroll" role="region" aria-label="Tableau des phases finales" tabIndex={0}>
      <div className="tf">
        <Tour titre="8es de finale" rencontres={COTE_GAUCHE.huitiemes} />
        <Tour titre="Quarts" rencontres={COTE_GAUCHE.quarts} />
        <Tour titre="Demi-finale" rencontres={[COTE_GAUCHE.demie]} />
        <div className="tf-tour">
          <div className="tf-titre">Finale</div>
          <div className="tf-col"><Rencontre r={FINALE} finale /></div>
        </div>
        <Tour titre="Demi-finale" rencontres={[COTE_DROIT.demie]} />
        <Tour titre="Quarts" rencontres={COTE_DROIT.quarts} />
        <Tour titre="8es de finale" rencontres={COTE_DROIT.huitiemes} />
      </div>
    </div>
  );
}
