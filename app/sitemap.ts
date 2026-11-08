import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getClubs, getMatchs, getPublications } from "@/lib/data";

// Plan du site pour Google : pages publiques, fiches des clubs, matchs et publications.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [clubs, matchs, publications] = await Promise.all([getClubs(), getMatchs(), getPublications()]);
  const pages = ["", "/matchs", "/classements", "/equipes", "/billetterie", "/medias", "/infos", "/reglement", "/inscription-club"];
  return [
    ...pages.map((p) => ({ url: `${SITE}${p}`, changeFrequency: "daily" as const, priority: p ? 0.8 : 1 })),
    ...clubs.map((c) => ({ url: `${SITE}/equipes/${c.id}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...matchs.map((m) => ({ url: `${SITE}/matchs/${m.id}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ...publications.map((p) => ({ url: `${SITE}/medias/${p.id}`, lastModified: p.publiee_le ?? undefined, priority: 0.5 })),
  ];
}
