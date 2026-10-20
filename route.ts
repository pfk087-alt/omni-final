import { NextResponse } from "next/server";
import { searchAmazonBestSellers } from "@/app/lib/auto-store";
import { readHomeProducts } from "@/app/lib/home-products";
import { amazonSearchUrl } from "@/app/lib/featured-products";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const searches = [
  { category: "Freidora Moulinex", query: "Moulinex Easy Fry friteuse sans huile" },
  { category: "Aspiradora Dyson", query: "Dyson aspirateur sans fil" },
  { category: "Cafetera", query: "machine à café espresso" },
];

export async function GET() {
  try {
    const products = await readHomeProducts();
    const tag = process.env.AMAZON_AFFILIATE_TAG?.trim() || "AMAZON_AFFILIATE_TAG";
    return NextResponse.json({ products: products.map((product) => ({ ...product, affiliateUrl: amazonSearchUrl(product.title, tag) })) });
  } catch (error) {
    console.error("[Passerelle catálogo]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el catálogo." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const affiliateId = String(body.affiliateId || "").trim();
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(affiliateId)) {
      return NextResponse.json({ error: "Escribe tu ID de afiliado de Amazon para cargar los productos y sus enlaces." }, { status: 400 });
    }
    const results = await Promise.all(searches.map(async ({ category, query }) => {
      try {
        const products = await searchAmazonBestSellers(affiliateId, 10, [query]);
        const product = products.find((item) => item.price !== null && item.imageUrl && item.affiliateUrl);
        return product ? { ...product, category, dataLive: true } : null;
      } catch (error) {
        console.error(`[Passerelle Amazon][${category}]`, error);
        return null;
      }
    }));
    const products = results.filter((product) => product !== null);
    if (!products.length) return NextResponse.json({ error: "Amazon no ha devuelto productos reales. Revisa el ID afiliado y las credenciales de Amazon Creators API del servidor." }, { status: 503 });
    return NextResponse.json({ products, missing: searches.filter((_, index) => !results[index]).map((item) => item.category), updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[Passerelle Amazon]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron consultar los datos de Amazon." }, { status: 502 });
  }
}
