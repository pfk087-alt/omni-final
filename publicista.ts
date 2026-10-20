import OpenAI from "openai";
import { unstable_cache } from "next/cache";
import type { RankedProduct } from "./jefe";
import { FEATURED_PRODUCTS } from "@/app/lib/featured-products";

export type ProductAds = { asin: string; product: string; ads: Array<{ channel: string; title: string; text: string; callToAction: string }> };

/** Escribe tres anuncios originales en español, uno para cada producto ganador. */
export async function crearAnuncios(productos: RankedProduct[]): Promise<ProductAds[]> {
  if (!productos.length) return [];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results: ProductAds[] = [];
  for (const product of productos) {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_REWRITE_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Eres publicista de comercio electrónico. Escribe exactamente tres anuncios breves y distintos en español para este producto: redes sociales, email y anuncio corto. Basa las afirmaciones solo en los datos facilitados; no inventes beneficios, valoraciones, descuentos ni disponibilidad. Incluye título, texto y llamada a la acción. Devuelve JSON {ads:[{channel,title,text,callToAction}]} sin Markdown." },
        { role: "user", content: JSON.stringify({ title: product.title, price: product.price, currency: product.currency, features: product.features, link: product.affiliateUrl }) },
      ],
    });
    const value = JSON.parse(response.choices[0]?.message.content || "{}");
    results.push({ asin: product.asin, product: product.title, ads: Array.isArray(value.ads) ? value.ads.slice(0, 3) : [] });
  }
  return results;
}

export type DailyInstagramPost = {
  date: string;
  productId: string;
  productTitle: string;
  caption: string;
  hashtags: string[];
  callToAction: string;
  affiliateDisclosure: string;
};

const dailyPosts = new Map<string, DailyInstagramPost>();

/** Genera y reutiliza un único borrador en español por día y por proceso. */
export async function crearPostDiarioInstagram(now = new Date(), winningProductTitle?: string): Promise<DailyInstagramPost> {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const dayNumber = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const product = winningProductTitle
    ? FEATURED_PRODUCTS.find((candidate) => candidate.title === winningProductTitle)
    : FEATURED_PRODUCTS[((dayNumber % FEATURED_PRODUCTS.length) + FEATURED_PRODUCTS.length) % FEATURED_PRODUCTS.length];
  if (!product) throw new Error("El producto del JEFE no pertenece a la tienda Passerelle.");
  const cacheKey = `${date}:${product.id}`;
  const cached = dailyPosts.get(cacheKey);
  if (cached) return cached;
  const getCachedPost = unstable_cache(
    () => generarPost(date, product),
    ["passerelle-instagram-post", date, product.id],
    { revalidate: 86_400 },
  );
  const post = await getCachedPost();
  dailyPosts.set(cacheKey, post);
  return post;
}

async function generarPost(date: string, product: (typeof FEATURED_PRODUCTS)[number]): Promise<DailyInstagramPost> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_REWRITE_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Eres el publicista de Passerelle. Crea UN borrador de publicación de Instagram en español de España sobre el producto dado. Escribe un caption claro, cercano y original de 50-90 palabras. No inventes prestaciones, resultados, reseñas, descuentos ni precio. Devuelve JSON: {caption:string, hashtags:string[], callToAction:string}. Incluye entre 5 y 8 hashtags pertinentes y una llamada a consultar el producto en Amazon. No afirmes que has publicado el contenido." },
      { role: "user", content: JSON.stringify({ date, title: product.title, brand: product.brand, category: product.category, link: product.affiliateUrl }) },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (!content) throw new Error("OpenAI no devolvió el borrador de Instagram.");
  const generated = JSON.parse(content) as { caption?: string; hashtags?: string[]; callToAction?: string };
  if (!generated.caption || !generated.callToAction) throw new Error("El borrador diario llegó incompleto.");
  const post: DailyInstagramPost = {
    date,
    productId: product.id,
    productTitle: product.title,
    caption: generated.caption,
    hashtags: Array.isArray(generated.hashtags) ? generated.hashtags.filter((tag) => /^#[A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ]+$/.test(tag)).slice(0, 8) : [],
    callToAction: generated.callToAction,
    affiliateDisclosure: `Enlace de afiliado: si compras a través de él, Passerelle puede recibir una comisión. ${product.affiliateUrl}`,
  };
  return post;
}
