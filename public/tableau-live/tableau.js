// Tableau d'affichage des lives du BÊGNANAN DALOA CUP (page /live).
// Lit toutes les 3 secondes le match saisi par le comité (Espace pro → Match en direct) et
// l'affiche par-dessus la vidéo : score, chrono, période, tirs au but, annonce des buts et des
// cartons, ronde des partenaires. Aucune écriture : la page n'utilise que la clé publique.
(function () {
  "use strict";

  var C = JSON.parse(document.getElementById("config").textContent);
  var scene = document.getElementById("scene");
  var VERTICAL = C.format === "vertical";
  var PLEIN = C.format === "plein";
  var LARGEUR = VERTICAL ? 1080 : 1920;
  var HAUTEUR = VERTICAL ? 1920 : 1080;

  var PERIODES = { mt1: "1re mi-temps", mt2: "2e mi-temps", prol1: "1re prolongation", prol2: "2e prolongation", tab: "Tirs au but" };
  var ENTRE_DEUX = { mt1: "Mi-temps", mt2: "Fin du temps réglementaire", prol1: "Pause des prolongations", prol2: "Fin des prolongations", tab: "Tirs au but" };
  var EVENEMENTS = {
    but: { titre: "BUT !", classe: "but" },
    csc: { titre: "BUT !", sous: "Contre son camp", classe: "but" },
    jaune: { titre: "Carton 2 min", classe: "jaune" },
    rouge: { titre: "Carton 5 min", classe: "rouge" },
  };

  // ---------- Outils ----------

  function el(tag, classe, texte) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texte != null) n.textContent = texte;
    return n;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  var deux = function (n) { return (n < 10 ? "0" : "") + n; };
  // Daloa est à l'heure de Greenwich toute l'année.
  function heure(iso) {
    var d = new Date(iso);
    return deux(d.getUTCHours()) + "h" + deux(d.getUTCMinutes());
  }
  function jour(iso) {
    try {
      return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));
    } catch (e) { return ""; }
  }

  /** Écart entre l'horloge du PC et celle du serveur, pour que le chrono soit juste à la seconde. */
  var decalage = 0;
  function maintenant() { return Date.now() + decalage; }
  function caler() {
    var avant = Date.now();
    fetch(location.pathname, { method: "HEAD", cache: "no-store" }).then(function (r) {
      var serveur = Date.parse(r.headers.get("date") || "");
      if (!isNaN(serveur)) decalage = serveur + 500 - (avant + Date.now()) / 2;
    }).catch(function () {});
  }

  // ---------- Lecture de la base ----------

  function lire(chemin) {
    return fetch(C.url + "/rest/v1/" + chemin, {
      headers: { apikey: C.cle, Authorization: "Bearer " + C.cle },
      cache: "no-store",
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /** Le match demandé, sinon celui en cours, sinon celui qui vient de finir, sinon le prochain. */
  function trouverMatch() {
    if (C.match) return lire("matchs?select=*&id=eq." + C.match).then(function (l) { return l[0] || null; });
    return lire("matchs?select=*&statut=eq." + encodeURIComponent("en cours") + "&order=date_heure.asc&limit=1").then(function (l) {
      if (l[0]) return l[0];
      var ilYa = new Date(maintenant() - 45 * 60000).toISOString();
      return lire("matchs?select=*&statut=eq." + encodeURIComponent("terminé") + "&modifie_le=gte." + ilYa + "&order=modifie_le.desc&limit=1").then(function (l2) {
        if (l2[0]) return l2[0];
        var depuis = new Date(maintenant() - 6 * 3600000).toISOString();
        return lire("matchs?select=*&statut=eq." + encodeURIComponent("programmé") + "&date_heure=gte." + depuis + "&order=date_heure.asc&limit=1").then(function (l3) { return l3[0] || null; });
      });
    });
  }

  var clubs = {};
  var reglages = { mi_temps: null, prolongation: null, tireurs: 3 };
  var dernierReglage = 0;

  function charger() {
    return trouverMatch().then(function (m) {
      if (!m) return { match: null, evenements: [], tirs: [] };
      var besoin = [m.club_domicile, m.club_exterieur].filter(function (id) { return !clubs[id]; });
      var attentes = [
        lire("evenements_match?select=*&match_id=eq." + m.id + "&order=cree_le.asc"),
        m.periode === "tab" || m.tab_domicile != null ? lire("tirs_au_but?select=*&match_id=eq." + m.id + "&order=ordre.asc") : Promise.resolve([]),
        besoin.length ? lire("clubs?select=id,nom,sigle,couleur,logo_url&id=in.(" + besoin.join(",") + ")") : Promise.resolve([]),
        Date.now() - dernierReglage > 60000 ? lire("tournoi?select=duree_mi_temps,duree_prolongation,tab_tireurs&id=eq.1") : Promise.resolve(null),
      ];
      return Promise.all(attentes).then(function (r) {
        r[2].forEach(function (c) { clubs[c.id] = c; });
        if (r[3] && r[3][0]) {
          dernierReglage = Date.now();
          reglages = { mi_temps: r[3][0].duree_mi_temps, prolongation: r[3][0].duree_prolongation, tireurs: r[3][0].tab_tireurs || 3 };
        }
        return { match: m, evenements: r[0], tirs: r[1] };
      });
    });
  }

  // ---------- Match fictif (?demo=1) ----------

  var demoDebut = Date.now();
  var DEMO_CLUBS = {
    d1: { id: "d1", nom: "Baraka", sigle: "BAR", couleur: "#a52e2f", logo_url: "/clubs/baraka.webp" },
    d2: { id: "d2", nom: "Chicago MC", sigle: "CHI", couleur: "#b62122", logo_url: "/clubs/chicago-mc.webp" },
  };
  function demo() {
    clubs = DEMO_CLUBS;
    reglages = { mi_temps: 20, prolongation: 5, tireurs: 3 };
    var cycle = 70;
    var t = ((Date.now() - demoDebut) / 1000) % cycle;
    var tour = Math.floor((Date.now() - demoDebut) / 1000 / cycle);
    var debut = new Date(demoDebut + tour * cycle * 1000).toISOString();
    var evts = [
      { a: 4, club_id: "d1", type: "but", joueur_nom: "Ibrahim Koné", minute: 8 },
      { a: 18, club_id: "d2", type: "jaune", joueur_nom: "Moussa Traoré", minute: 9 },
      { a: 32, club_id: "d2", type: "but", joueur_nom: "Yves Zadi", minute: 9 },
      { a: 46, club_id: "d1", type: "but", joueur_nom: "Abdoul Diarra", minute: 10 },
    ].filter(function (e) { return e.a <= t; }).map(function (e, i) {
      return { id: "demo-" + tour + "-" + i, match_id: "demo", club_id: e.club_id, type: e.type, joueur_nom: e.joueur_nom, minute: e.minute, cree_le: debut };
    });
    var buts = function (c) { return evts.filter(function (e) { return e.club_id === c && (e.type === "but" || e.type === "csc"); }).length; };
    var mitemps = t >= 58;
    var m = {
      id: "demo", club_domicile: "d1", club_exterieur: "d2", phase: "poules", poule: "A", terrain: "Espace CP1–Orly",
      date_heure: debut, statut: "en cours", buts_domicile: buts("d1"), buts_exterieur: buts("d2"),
      periode: "mt1", periode_terminee: mitemps,
      chrono_lance: mitemps ? null : new Date(demoDebut + tour * cycle * 1000 - 7 * 60000).toISOString(),
      chrono_ecoule: mitemps ? 20 * 60 : 0, tab_domicile: null, tab_exterieur: null,
    };
    return Promise.resolve({ match: m, evenements: evts, tirs: [] });
  }

  // ---------- Chrono (mêmes règles que lib/chrono.ts) ----------

  function secondesJouees(m) {
    var enCours = m.chrono_lance ? Math.max(0, Math.floor((maintenant() - Date.parse(m.chrono_lance)) / 1000)) : 0;
    return (m.chrono_ecoule || 0) + enCours;
  }
  function dureePeriode(p) {
    return p === "mt1" || p === "mt2" ? reglages.mi_temps : p === "prol1" || p === "prol2" ? reglages.prolongation : null;
  }
  function debutPeriode(p) {
    if (p === "mt1") return 0;
    if (reglages.mi_temps == null) return 0;
    if (p === "mt2") return reglages.mi_temps;
    if (p === "prol1") return 2 * reglages.mi_temps;
    return reglages.prolongation == null ? 0 : 2 * reglages.mi_temps + reglages.prolongation;
  }
  /** Horloge façon télé : « 27:14 », bloquée à la fin du temps prévu, avec les arrêts de jeu à côté (« +2 »). */
  function horloge(m) {
    var s = secondesJouees(m);
    var duree = dureePeriode(m.periode);
    var base = debutPeriode(m.periode) * 60;
    var plus = 0;
    if (duree != null && s > duree * 60) {
      plus = Math.ceil((s - duree * 60) / 60);
      s = duree * 60;
    }
    var total = base + s;
    return { texte: deux(Math.floor(total / 60)) + ":" + deux(total % 60), plus: plus };
  }

  /** Ce que dit la case du temps : chrono, pause ou heure du coup d'envoi. */
  function etatTemps(m) {
    if (m.statut === "programmé") return { haut: heure(m.date_heure), bas: "Coup d'envoi" };
    if (m.statut === "terminé") return { haut: "FIN", bas: "Score final" };
    if (m.statut === "reporté" || m.statut === "interrompu" || m.statut === "annulé") return { haut: m.statut.toUpperCase(), bas: "" };
    if (!m.periode) return { haut: "00:00", bas: "Coup d'envoi" };
    if (m.periode === "tab") return { haut: "TAB", bas: PERIODES.tab };
    if (m.periode_terminee) return { haut: ENTRE_DEUX[m.periode] === "Mi-temps" ? "MT" : "PAUSE", bas: ENTRE_DEUX[m.periode] };
    var h = horloge(m);
    return { haut: h.texte, plus: h.plus, bas: PERIODES[m.periode], arrete: !m.chrono_lance };
  }

  // ---------- Pièces communes ----------

  function blason(club, classe) {
    var b = el("div", "blason " + (classe || ""));
    if (club && club.logo_url) {
      var img = el("img");
      img.src = club.logo_url;
      img.alt = "";
      img.onerror = function () { b.removeChild(img); b.textContent = club.sigle; b.style.background = club.couleur; };
      b.appendChild(img);
    } else if (club) {
      b.textContent = club.sigle;
      b.style.background = club.couleur;
    }
    return b;
  }

  /** Ronds des tirs au but : plein s'il est marqué, barré s'il est manqué, vide s'il reste à tirer. */
  function ligneTirs(tirs, club, n) {
    var l = tirs.filter(function (t) { return t.club_id === club; });
    var cases = Math.max(n, l.length);
    var span = el("span", "tirs");
    for (var i = 0; i < cases; i++) span.appendChild(el("i", l[i] ? (l[i].reussi ? "ok" : "rate") : ""));
    return span;
  }

  // ---------- Bandeau et vertical ----------

  var stage = el("div", "stage");
  stage.style.width = LARGEUR + "px";
  stage.style.height = HAUTEUR + "px";
  scene.appendChild(stage);

  function ajuster() {
    var k = Math.min(innerWidth / LARGEUR, innerHeight / HAUTEUR);
    stage.style.transform = "scale(" + k + ")";
    // Centre la scène si la fenêtre n'a pas les mêmes proportions.
    stage.style.left = (innerWidth - LARGEUR * k) / 2 + "px";
    stage.style.top = (innerHeight - HAUTEUR * k) / 2 + "px";
  }
  addEventListener("resize", ajuster);
  ajuster();

  var bug, popup, sponsor, plein;
  var refs = {};

  function construireBandeau() {
    bug = el("div", "bug cache");
    var ligne = el("div", "bug-ligne");
    var logo = el("img", "bug-logo");
    logo.src = "/logo-small.webp";
    logo.alt = "";
    ligne.appendChild(logo);
    refs.dom = el("div", "bug-equipe dom");
    refs.score = el("div", "bug-score");
    refs.bd = el("span", "num", "0");
    refs.be = el("span", "num", "0");
    refs.score.appendChild(refs.bd);
    refs.score.appendChild(el("span", "tiret", "–"));
    refs.score.appendChild(refs.be);
    refs.ext = el("div", "bug-equipe ext");
    refs.temps = el("div", "bug-temps");
    refs.horloge = el("b", "num");
    refs.plus = el("span", "plus");
    refs.temps.appendChild(refs.horloge);
    refs.temps.appendChild(refs.plus);
    ligne.appendChild(refs.dom);
    ligne.appendChild(refs.score);
    ligne.appendChild(refs.ext);
    ligne.appendChild(refs.temps);
    bug.appendChild(ligne);
    refs.sous = el("div", "bug-sous");
    refs.periode = el("span", "periode");
    refs.tab = el("span", "bug-tab");
    refs.sous.appendChild(refs.periode);
    refs.sous.appendChild(refs.tab);
    bug.appendChild(refs.sous);
    stage.appendChild(bug);

    popup = el("div", "popup");
    stage.appendChild(popup);

    sponsor = el("div", "sponsor cache");
    refs.spLabel = el("span", "sponsor-label", "Partenaire officiel");
    refs.spImg = el("img");
    refs.spImg.alt = "";
    refs.spNom = el("span", "sponsor-nom");
    sponsor.appendChild(refs.spLabel);
    var cadre = el("div", "sponsor-cadre");
    cadre.appendChild(refs.spImg);
    sponsor.appendChild(cadre);
    sponsor.appendChild(refs.spNom);
    stage.appendChild(sponsor);
  }

  function equipe(n, club) {
    if (n.dataset.club === (club ? club.id : "")) return;
    n.dataset.club = club ? club.id : "";
    vider(n);
    n.appendChild(blason(club, "petit"));
    n.appendChild(el("span", "sigle", club ? club.sigle : ""));
    var barre = el("i", "couleur");
    barre.style.background = club ? club.couleur : "transparent";
    n.appendChild(barre);
  }

  var scoreAvant = null;
  function majBandeau(d) {
    var m = d.match;
    if (!m) { bug.classList.add("cache"); return; }
    bug.classList.remove("cache");
    equipe(refs.dom, clubs[m.club_domicile]);
    equipe(refs.ext, clubs[m.club_exterieur]);
    var joue = m.statut === "en cours" || m.statut === "terminé";
    refs.score.classList.toggle("avant", !joue);
    refs.bd.textContent = joue ? m.buts_domicile || 0 : "";
    refs.be.textContent = joue ? m.buts_exterieur || 0 : "";
    var cle = m.id + ":" + (m.buts_domicile || 0) + "-" + (m.buts_exterieur || 0);
    if (scoreAvant && scoreAvant !== cle && scoreAvant.split(":")[0] === m.id) {
      refs.score.classList.remove("eclat");
      void refs.score.offsetWidth;
      refs.score.classList.add("eclat");
    }
    scoreAvant = cle;
    var t = etatTemps(m);
    refs.horloge.textContent = t.haut;
    refs.temps.classList.toggle("texte", !/^\d/.test(t.haut) || m.statut === "programmé");
    refs.temps.classList.toggle("arrete", !!t.arrete);
    refs.plus.textContent = t.plus ? "+" + t.plus : "";
    refs.periode.textContent = t.bas;
    vider(refs.tab);
    if (d.tirs.length || m.periode === "tab") {
      refs.tab.appendChild(ligneTirs(d.tirs, m.club_domicile, reglages.tireurs));
      refs.tab.appendChild(el("b", "num", (m.tab_domicile || 0) + " – " + (m.tab_exterieur || 0)));
      refs.tab.appendChild(ligneTirs(d.tirs, m.club_exterieur, reglages.tireurs));
    }
  }

  // ---------- Annonces des buts et cartons ----------

  var vus = null;
  var matchVu = null;
  var file = [];
  var enAffichage = false;

  function reperer(d) {
    var m = d.match;
    if (!m) return;
    // Au chargement, ou quand le match change : ce qui est déjà saisi n'est pas annoncé.
    if (matchVu !== m.id || !vus) {
      matchVu = m.id;
      vus = {};
      d.evenements.forEach(function (e) { vus[e.id] = true; });
      return;
    }
    d.evenements.forEach(function (e) {
      if (vus[e.id]) return;
      vus[e.id] = true;
      // Une saisie annulée tout de suite par le comité (erreur) n'est pas annoncée si elle a disparu avant son tour.
      file.push({ e: e, m: m });
    });
    var presents = {};
    d.evenements.forEach(function (e) { presents[e.id] = true; });
    file = file.filter(function (x) { return presents[x.e.id]; });
    suivante();
  }

  function suivante() {
    if (enAffichage || !file.length || PLEIN) return;
    enAffichage = true;
    var x = file.shift();
    var e = x.e;
    var info = EVENEMENTS[e.type] || EVENEMENTS.but;
    var club = clubs[e.club_id];
    vider(popup);
    popup.className = "popup " + info.classe;
    var carte = el("div", "popup-carte");
    carte.appendChild(blason(club, "moyen"));
    var texte = el("div", "popup-texte");
    texte.appendChild(el("div", "popup-titre", info.titre));
    var nom = e.joueur_nom || (club ? club.nom : "");
    texte.appendChild(el("div", "popup-nom", nom));
    var detail = [club && e.joueur_nom ? club.nom : null, info.sous || null].filter(Boolean).join(" · ");
    if (detail) texte.appendChild(el("div", "popup-detail", detail));
    carte.appendChild(texte);
    if (e.minute != null) carte.appendChild(el("div", "popup-minute num", e.minute + "'"));
    popup.appendChild(carte);
    void popup.offsetWidth;
    popup.classList.add("visible");
    setTimeout(function () {
      popup.classList.remove("visible");
      setTimeout(function () { enAffichage = false; suivante(); }, 700);
    }, e.type === "but" || e.type === "csc" ? 8000 : 6000);
  }

  // ---------- Partenaires ----------

  var partenaires = [];
  var rangSponsor = 0;
  function chargerPartenaires() {
    if (!C.sponsors || !C.url) return;
    lire("partenaires?select=nom,logo_url,niveau,ordre&visible=eq.true&order=ordre.asc,nom.asc").then(function (l) {
      var rang = { principal: 0, officiel: 1, soutien: 2 };
      partenaires = l.sort(function (a, b) { return rang[a.niveau] - rang[b.niveau]; });
      // Logos chargés d'avance : pas d'image vide pendant le live.
      partenaires.forEach(function (p) { new Image().src = p.logo_url; });
      if (!PLEIN) tournerSponsor();
    }).catch(function () {});
  }
  function tournerSponsor() {
    if (!partenaires.length) return;
    var p = partenaires[rangSponsor % partenaires.length];
    rangSponsor++;
    sponsor.classList.add("cache");
    setTimeout(function () {
      refs.spImg.src = p.logo_url;
      refs.spNom.textContent = p.nom;
      refs.spLabel.textContent = p.niveau === "principal" ? "Partenaire principal" : "Partenaire officiel";
      sponsor.classList.remove("cache");
    }, 600);
  }

  // ---------- Écran plein (avant-match, mi-temps, fin) ----------

  function construirePlein() {
    plein = el("div", "plein");
    stage.appendChild(plein);
  }

  function buteurs(evts, club) {
    var ul = el("ul", "buteurs");
    evts.filter(function (e) { return e.club_id === club && (e.type === "but" || e.type === "csc"); }).forEach(function (e) {
      ul.appendChild(el("li", "", "⚽ " + (e.joueur_nom || "But") + (e.type === "csc" ? " (csc)" : "") + (e.minute != null ? " " + e.minute + "'" : "")));
    });
    return ul;
  }

  var signaturePlein = "";
  function majPlein(d) {
    var m = d.match;
    var t = m ? etatTemps(m) : null;
    // On ne reconstruit l'écran que si quelque chose a changé (sinon les logos clignotent).
    var sig = JSON.stringify([m && [m.id, m.statut, m.buts_domicile, m.buts_exterieur, m.periode, m.periode_terminee, m.tab_domicile, m.tab_exterieur], d.evenements.length, d.tirs.length, t && t.bas, partenaires.length]);
    if (m && t && /^\d/.test(t.haut) && m.statut === "en cours") {
      if (refs.pleinHorloge) refs.pleinHorloge.textContent = t.haut + (t.plus ? " +" + t.plus : "");
    }
    if (sig === signaturePlein) return;
    signaturePlein = sig;
    vider(plein);
    refs.pleinHorloge = null;

    var tete = el("div", "plein-tete");
    var logo = el("img", "plein-logo");
    logo.src = "/logo.webp";
    logo.alt = "";
    tete.appendChild(logo);
    var titres = el("div");
    titres.appendChild(el("div", "plein-tournoi", "BÊGNANAN DALOA CUP"));
    if (m) titres.appendChild(el("div", "plein-phase", (m.poule ? "Poule " + m.poule : m.phase || "") + (m.terrain ? " · " + m.terrain : "")));
    tete.appendChild(titres);
    plein.appendChild(tete);

    if (!m) {
      plein.appendChild(el("div", "plein-vide", "Le direct reprend dans un instant"));
    } else {
      var etiquette = m.statut === "programmé" ? "À suivre · " + jour(m.date_heure) : t.bas || "";
      plein.appendChild(el("div", "plein-etat", etiquette));
      var affiche = el("div", "plein-affiche");
      [m.club_domicile, null, m.club_exterieur].forEach(function (id) {
        if (id === null) {
          var centre = el("div", "plein-centre");
          if (m.statut === "programmé") {
            centre.appendChild(el("div", "plein-heure num", heure(m.date_heure)));
          } else {
            centre.appendChild(el("div", "plein-score num", (m.buts_domicile || 0) + " – " + (m.buts_exterieur || 0)));
            if (m.tab_domicile != null) centre.appendChild(el("div", "plein-tab num", "Tirs au but " + m.tab_domicile + " – " + m.tab_exterieur));
            if (m.statut === "en cours" && /^\d/.test(t.haut)) {
              refs.pleinHorloge = el("div", "plein-horloge num", t.haut + (t.plus ? " +" + t.plus : ""));
              centre.appendChild(refs.pleinHorloge);
            }
          }
          affiche.appendChild(centre);
          return;
        }
        var c = clubs[id];
        var col = el("div", "plein-equipe");
        col.appendChild(blason(c, "grand"));
        col.appendChild(el("div", "plein-nom", c ? c.nom : ""));
        if (m.statut !== "programmé") col.appendChild(buteurs(d.evenements, id));
        affiche.appendChild(col);
      });
      plein.appendChild(affiche);
    }

    if (partenaires.length) {
      var bas = el("div", "plein-partenaires");
      bas.appendChild(el("div", "plein-merci", "Merci à nos partenaires"));
      refs.pleinLogos = el("div", "plein-logos");
      bas.appendChild(refs.pleinLogos);
      plein.appendChild(bas);
      tournerLogosPlein();
    }
  }

  var pagePlein = 0;
  function tournerLogosPlein() {
    if (!refs.pleinLogos || !partenaires.length) return;
    var parPage = 8;
    var pages = Math.ceil(partenaires.length / parPage);
    var debut = (pagePlein % pages) * parPage;
    vider(refs.pleinLogos);
    partenaires.slice(debut, debut + parPage).forEach(function (p) {
      var cadre = el("div", "plein-logo-partenaire");
      var img = el("img");
      img.src = p.logo_url;
      img.alt = p.nom;
      cadre.appendChild(img);
      refs.pleinLogos.appendChild(cadre);
    });
  }

  // ---------- Boucle ----------

  if (PLEIN) construirePlein(); else construireBandeau();

  var derniere = { match: null, evenements: [], tirs: [] };
  function rafraichir() {
    var source = C.demo ? demo() : charger();
    source.then(function (d) {
      derniere = d;
      document.body.classList.remove("hors-ligne");
      reperer(d);
      if (PLEIN) majPlein(d); else majBandeau(d);
    }).catch(function () {
      // Réseau coupé : on garde le dernier affichage, le chrono continue de tourner.
      document.body.classList.add("hors-ligne");
    }).then(function () { setTimeout(rafraichir, 3000); });
  }

  // Le chrono avance chaque seconde, entre deux lectures de la base.
  setInterval(function () {
    if (!derniere.match) return;
    if (PLEIN) majPlein(derniere); else majBandeau(derniere);
  }, 1000);

  if (!C.demo) { caler(); setInterval(caler, 5 * 60000); }
  chargerPartenaires();
  setInterval(chargerPartenaires, 10 * 60000);
  setInterval(function () { if (PLEIN) { pagePlein++; tournerLogosPlein(); } else tournerSponsor(); }, 9000);
  rafraichir();
})();
