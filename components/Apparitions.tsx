"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Blocs qui apparaissent en glissant vers le haut quand on les atteint en faisant défiler la page.
// Les grilles sont animées carte par carte ; le reste, bloc par bloc.
const CIBLES = "main section:not(.hero) .wrap > :not(.grid):not(:has(.grid)), main .grid > *";
// Navigateurs sans :has() (anciens navigateurs intégrés) : seules les cartes des grilles sont animées.
const CIBLES_SIMPLES = "main .grid > *";

function cibles() {
  try {
    return document.querySelectorAll<HTMLElement>(CIBLES);
  } catch {
    return document.querySelectorAll<HTMLElement>(CIBLES_SIMPLES);
  }
}

export function Apparitions() {
  const chemin = usePathname();

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    // Espace pro et espace club : outils de travail, rien n'y est masqué en attendant le défilement.
    if (chemin.startsWith("/admin") || chemin.startsWith("/espace-club")) return;
    const io = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.dataset.rv = "vu";
          io.unobserve(el);
          // Une fois arrivé, on rend la main aux transitions propres au bloc (survol, etc.).
          setTimeout(() => (el.dataset.rv = "fini"), 1600);
        }
      },
      // Seuil à 0 : un bloc très haut (une longue liste) apparaît dès son premier pixel visible.
      // Avec un seuil en pourcentage, un bloc plus haut que l'écran ne l'atteignait jamais et restait invisible.
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    const elements = Array.from(cibles()).filter((el) => !el.dataset.rv);
    // (data-rv vide : pas encore vu ; « vu » ou « fini » : déjà apparu, on n'y touche plus.)
    for (const el of elements) {
      // Décalage en cascade entre voisins d'une même grille.
      const rang = el.parentElement?.classList.contains("grid") ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty("--rang", String(Math.min(rang, 6)));
      el.dataset.rv = "";
      io.observe(el);
    }
    return () => io.disconnect();
  }, [chemin]);

  return null;
}
