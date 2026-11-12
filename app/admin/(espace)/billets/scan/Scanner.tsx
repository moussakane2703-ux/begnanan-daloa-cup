"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { annulerReservation, chercherBillet, faireEntrer, type BilletControle, type ResultatControle } from "../actions";

const TZ = "Africa/Abidjan";
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const jour = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR", { timeZone: TZ });
const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

type Camera = "arret" | "demarrage" | "active" | "refusee" | "absente";

/**
 * Scanner de billets : la caméra arrière lit le QR code (jsQR, compatible avec tous les navigateurs,
 * iPhone compris), puis le contrôleur encaisse et fait entrer. Pas de fenêtre de confirmation du
 * navigateur : tout se confirme dans la page.
 */
export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const enPause = useRef(false);
  const [camera, setCamera] = useState<Camera>("arret");
  const [resultat, setResultat] = useState<ResultatControle | null>(null);
  const [saisie, setSaisie] = useState("");
  const [nombre, setNombre] = useState(1);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const [envoi, demarrer] = useTransition();

  const afficher = useCallback((r: ResultatControle) => {
    setResultat(r);
    setConfirmerAnnulation(false);
    if (r.billet) setNombre(Math.max(1, r.billet.quantite - r.billet.entrees_validees));
    try {
      navigator.vibrate?.(r.billet && !r.erreur ? 80 : [60, 60, 60]);
    } catch {}
  }, []);

  const controler = useCallback(
    (code: string) => {
      enPause.current = true;
      demarrer(async () => afficher(await chercherBillet(code)));
    },
    [afficher],
  );

  const arreterCamera = useCallback(() => {
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    setCamera("arret");
  }, []);

  const lancerCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera("absente");
    setCamera("demarrage");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      flux.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      enPause.current = false;
      setCamera("active");
    } catch (e) {
      console.error(e);
      setCamera((e as DOMException)?.name === "NotAllowedError" ? "refusee" : "absente");
    }
  }, []);

  // Lecture des images de la caméra, environ 6 fois par seconde.
  useEffect(() => {
    if (camera !== "active") return;
    let fini = false;
    let jsQR: typeof import("jsqr").default | null = null;
    import("jsqr").then((m) => (jsQR = m.default));
    const tour = window.setInterval(() => {
      const v = video.current;
      const c = toile.current;
      if (fini || enPause.current || !jsQR || !v || !c || v.readyState < 2 || !v.videoWidth) return;
      const echelle = Math.min(1, 640 / v.videoWidth);
      c.width = Math.round(v.videoWidth * echelle);
      c.height = Math.round(v.videoHeight * echelle);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
      if (code?.data) controler(code.data);
    }, 160);
    return () => {
      fini = true;
      window.clearInterval(tour);
    };
  }, [camera, controler]);

  useEffect(() => arreterCamera, [arreterCamera]);

  const suivant = () => {
    setResultat(null);
    setSaisie("");
    enPause.current = false;
  };

  return (
    <div className="scan">
      {!resultat && (
        <>
          <div className={`scan-video${camera === "active" ? " on" : ""}`}>
            <video ref={video} playsInline muted autoPlay />
            <canvas ref={toile} hidden />
            {camera === "active" && <div className="scan-cadre" aria-hidden="true" />}
            {camera !== "active" && (
              <div className="scan-invite">
                {camera === "refusee" ? (
                  <p>L&apos;accès à la caméra est bloqué. Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez.</p>
                ) : camera === "absente" ? (
                  <p>Caméra indisponible sur cet appareil. Tapez la référence du billet ci-dessous.</p>
                ) : (
                  <p>Pointez la caméra vers le QR code du billet.</p>
                )}
                <button type="button" className="btn gold" onClick={lancerCamera} disabled={camera === "demarrage"}>
                  {camera === "demarrage" ? "Ouverture…" : "Ouvrir la caméra"}
                </button>
              </div>
            )}
          </div>
          {envoi && <p className="scan-attente">Vérification du billet…</p>}
          <form
            className="form-row scan-saisie"
            onSubmit={(e) => {
              e.preventDefault();
              if (saisie.trim()) controler(saisie);
            }}
          >
            <label className="field">Ou tapez la référence<input value={saisie} onChange={(e) => setSaisie(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="BDC-XXXXXX" /></label>
            <button className="btn primary sm" disabled={envoi || !saisie.trim()}>Vérifier</button>
          </form>
          {camera === "active" && <button type="button" className="btn line sm" onClick={arreterCamera}>Fermer la caméra</button>}
        </>
      )}

      {resultat && (
        <Resultat
          resultat={resultat}
          nombre={nombre}
          setNombre={setNombre}
          envoi={envoi}
          confirmerAnnulation={confirmerAnnulation}
          setConfirmerAnnulation={setConfirmerAnnulation}
          entrer={(billet) => demarrer(async () => afficher(await faireEntrer(billet.reference, nombre)))}
          annuler={(billet) => demarrer(async () => afficher(await annulerReservation(billet.reference)))}
          suivant={suivant}
        />
      )}
    </div>
  );
}

function Resultat({ resultat, nombre, setNombre, envoi, confirmerAnnulation, setConfirmerAnnulation, entrer, annuler, suivant }: {
  resultat: ResultatControle;
  nombre: number;
  setNombre: (n: number) => void;
  envoi: boolean;
  confirmerAnnulation: boolean;
  setConfirmerAnnulation: (v: boolean) => void;
  entrer: (b: BilletControle) => void;
  annuler: (b: BilletControle) => void;
  suivant: () => void;
}) {
  const b = resultat.billet;
  if (!b) {
    return (
      <div className="scan-res s-refus" role="alert">
        <div className="scan-verdict">Refuser</div>
        <p>{resultat.erreur}</p>
        <button type="button" className="btn primary" onClick={suivant}>Scanner le suivant</button>
      </div>
    );
  }
  const annule = b.statut === "annulée" || b.statut === "échouée";
  const restant = b.quantite - b.entrees_validees;
  const paye = b.statut === "payée";
  const etat = annule || restant <= 0 ? "s-refus" : paye ? "s-ok" : "s-payer";
  const autreJour = jour(b.date_heure) !== jour(new Date());

  return (
    <div className={`scan-res ${etat}`} role="status">
      <div className="scan-verdict">
        {annule ? "Billet annulé" : restant <= 0 ? "Déjà utilisé" : paye ? "Payé · faire entrer" : `À encaisser : ${fcfa(b.total_fcfa)}`}
      </div>
      {resultat.ok && <p className="scan-msg">{resultat.ok}</p>}
      {resultat.erreur && <p className="scan-msg err">{resultat.erreur}</p>}

      <dl className="scan-infos">
        <div><dt>Nom</dt><dd>{b.nom_acheteur}</dd></div>
        <div><dt>Référence</dt><dd className="mono">{b.reference}</dd></div>
        <div><dt>Catégorie</dt><dd>{b.categorie}</dd></div>
        <div><dt>Entrées</dt><dd className="num">{b.entrees_validees} / {b.quantite}</dd></div>
        <div><dt>Match</dt><dd>{b.domicile ?? "?"} – {b.exterieur ?? "?"}<br /><span className="small">{quand(b.date_heure)}{b.terrain ? ` · ${b.terrain}` : ""}</span></dd></div>
        <div><dt>Total du billet</dt><dd className="num">{fcfa(b.total_fcfa)}{paye ? " · payé" : ""}</dd></div>
      </dl>
      {autreJour && !annule && restant > 0 && <p className="scan-alerte">Attention : ce billet est pour un autre jour ({quand(b.date_heure)}).</p>}
      {restant <= 0 && b.derniere_entree && <p className="scan-alerte">Dernière entrée enregistrée à {heure(b.derniere_entree)}.</p>}

      {!annule && restant > 0 && (
        <div className="scan-actions">
          {restant > 1 && (
            <label className="field">Personnes qui entrent maintenant
              <select value={nombre} onChange={(e) => setNombre(Number(e.target.value))}>
                {Array.from({ length: restant }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="btn primary scan-gros" disabled={envoi} onClick={() => entrer(b)}>
            {envoi ? "Enregistrement…" : paye ? `Faire entrer ${nombre} personne${nombre > 1 ? "s" : ""}` : `Encaissé ${fcfa(b.total_fcfa)} · faire entrer ${nombre}`}
          </button>
        </div>
      )}

      <button type="button" className="btn line" onClick={suivant} disabled={envoi}>Scanner le suivant</button>

      {b.statut === "en attente" && b.entrees_validees === 0 && (
        confirmerAnnulation ? (
          <div className="scan-annuler">
            <p>Annuler la réservation de {b.nom_acheteur} ? Ses places redeviennent libres.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn sm form-del-btn" disabled={envoi} onClick={() => annuler(b)}>Oui, annuler</button>
              <button type="button" className="btn line sm" onClick={() => setConfirmerAnnulation(false)}>Non</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn line sm scan-lien" onClick={() => setConfirmerAnnulation(true)}>Annuler cette réservation</button>
        )
      )}
    </div>
  );
}
