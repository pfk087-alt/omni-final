import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AmazonItem } from "@/app/lib/auto-store";
import { FEATURED_PRODUCTS, type FeaturedProduct } from "@/app/lib/featured-products";

export type HomeProduct = FeaturedProduct & {
  asin?: string;
  price?: number | null;
  currency?: string;
  rating?: number | null;
  availability?: string;
  features?: string[];
  rank?: number | null;
};

type CatalogFile = { products: HomeProduct[]; updatedAt: string };
const catalogId = "home";
const table = "affiliate_catalog";

export async function readHomeProducts(): Promise<HomeProduct[]> {
  const url = process.env.SUPABASE_URL?.trim();
  if (url) {
    const key = process.env.SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!key) throw new Error("Configura SUPABASE_ANON_KEY para leer el catálogo de Supabase.");
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${table}?id=eq.${catalogId}&select=products`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error(`No se pudo leer el catálogo de Supabase (HTTP ${response.status}).`);
    const rows = await response.json() as Array<{ products?: HomeProduct[] }>;
    return Array.isArray(rows[0]?.products) && rows[0].products!.length ? rows[0].products! : FEATURED_PRODUCTS;
  }
  if (process.env.VERCEL) return FEATURED_PRODUCTS;
  try {
    const content = await readFile(catalogPath(), "utf8");
    const catalog = JSON.parse(content) as CatalogFile;
    return Array.isArray(catalog.products) && catalog.products.length ? catalog.products : FEATURED_PRODUCTS;
  } catch (error) {
    if (isMissingFile(error)) return FEATURED_PRODUCTS;
    throw error;
  }
}

export async function writeHomeProducts(items: Array<AmazonItem & { category: string }>): Promise<void> {
  const products: HomeProduct[] = items.map((item) => ({
    id: item.asin,
    asin: item.asin,
    title: item.title,
    brand: "Selección Amazon",
    category: item.category,
    imageUrl: item.imageUrl || "",
    affiliateUrl: item.affiliateUrl,
    price: item.price,
    currency: item.currency,
    rating: item.rating,
    availability: item.availability,
    features: item.features,
    rank: item.rank,
  }));
  const updatedAt = new Date().toISOString();
  const url = process.env.SUPABASE_URL?.trim();
  if (url) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!key) throw new Error("Configura SUPABASE_SERVICE_ROLE_KEY para que el cron pueda guardar el catálogo.");
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${table}?on_conflict=id`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: catalogId, products, updated_at: updatedAt }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`No se pudo guardar el catálogo de Supabase (HTTP ${response.status}): ${(await response.text()).slice(0, 300)}`);
    return;
  }
  if (process.env.VERCEL) throw new Error("Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; el disco de Vercel no es persistente para este catálogo.");
  const dir = path.dirname(catalogPath());
  await mkdir(dir, { recursive: true });
  await writeFile(catalogPath(), `${JSON.stringify({ products, updatedAt }, null, 2)}\n`, "utf8");
}

function catalogPath() { return path.join(process.cwd(), "data", "affiliate-products.json"); }
function isMissingFile(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }

