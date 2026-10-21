import type { MetadataRoute } from "next";
import { SEO_GUIDES } from "@/app/lib/seo-guides";

const baseUrl = "https://omni-final-one.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-10-21T00:00:00.000Z");
  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...SEO_GUIDES.map(({ slug }) => ({ url: `${baseUrl}/productos/${slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
