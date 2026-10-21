import OpenAI from "openai";
import { unstable_cache } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FEATURED_PRODUCTS } from "@/app/lib/featured-products";
import { searchAmazonBestSellers, type AmazonItem } from "@/app/lib/auto-store";

export type RankedProduct = AmazonItem & { commissionNote: string };

export type OportunidadDiaria = {
  producto: string;
  porQueGana: string;
  competencia: "BAJA" | "MEDIA" | "ALTA" | "SIN DATOS";
  precio: string;
};

/** Elige entre los productos de Passerelle, guarda el análisis diario en /data. */
export async function generarOportunidadDiaria(now = new Date()): Promise<OportunidadDiaria> {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const runCachedAnalysis = unstable_cache(
    async () => {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.responses.create({
        model: process.env.OPENAI_REWRITE_MODEL || "gpt-4o-mini",
        max_output_tokens: 2000,
        tools: [{ type: "web_search", search_context_size: "high", user_location: { type: "approximate", country: "ES", city: "Madrid", region: "Comunidad de Madrid" } }],
        input: [
          { role: "system", content: "Eres el JEFE de Passerelle. Investiga hoy en Amazon.es los tres productos listados y elige un solo ganador para venta afiliada. Comprueba fichas o señales públicas actuales: precio, reseñas/valoración si aparecen, demanda y cantidad de ofertas rivales si se puede medir. No inventes puntuaciones, demanda, precio ni nivel de competencia. Competencia solo puede ser BAJA/MEDIA/ALTA cuando la búsqueda observada permita justificarla; si no, usa SIN DATOS. Si Amazon no muestra un precio, escribe 'Consultar en Amazon.es'. En porQueGana explica en una frase la evidencia que favorece al elegido y di cuando un dato no se pudo verificar. Devuelve solo JSON válido con exactamente estas claves: producto (debe coincidir exactamente con uno de los títulos facilitados), porQueGana, competencia, precio. Incluye URLs de las fuentes dentro del texto porQueGana cuando existan. Si no se encuentra evidencia verificable, indícalo claramente; jamás reproduzcas como hechos valores de ejemplo." },
          { role: "user", content: JSON.stringify({ fecha: date, candidatos: FEATURED_PRODUCTS.map(({ title, affiliateUrl }) => ({ title, amazon: affiliateUrl })) }) },
        ],
      });
      const text = response.output_text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const value = JSON.parse(text) as OportunidadDiaria;
      if (!FEATURED_PRODUCTS.some((product) => product.title === value.producto)) throw new Error("El JEFE no seleccionó uno de los tres productos de Passerelle.");
      if (!value.porQueGana || !["BAJA", "MEDIA", "ALTA", "SIN DATOS"].includes(value.competencia) || !value.precio) throw new Error("El análisis diario del JEFE está incompleto.");
      return value;
    },
    ["passerelle-oportunidad-diaria", date],
    { revalidate: 86_400 },
  );

  const opportunity = await runCachedAnalysis();
  const dataDirectory = path.join(process.cwd(), "data");
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(path.join(dataDirectory, "oportunidad.json"), `${JSON.stringify(opportunity, null, 2)}\n`, "utf8");
  return opportunity;
}

/** Busca productos reales y compara su potencial con la tabla oficial vigente. */
export async function buscarProductosConMejorComision(affiliateId: string) {
  const items = await searchAmazonBestSellers(affiliateId, 20);
  if (!items.length) throw new Error("Amazon no devolvió productos con precio disponible.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_REWRITE_MODEL || "gpt-4o-mini",
    max_output_tokens: 2500,
    tools: [{ type: "web_search", search_context_size: "medium" }],
    input: [
      { role: "system", content: "Eres responsable del catálogo afiliado de Amazon.es. Consulta únicamente la tabla oficial actual de comisiones de Amazon.es Associates; no uses tasas de otros países. Analiza solo los productos proporcionados. Devuelve JSON válido: {products:[{asin,category,commissionRate,estimatedCommission,reason}]}. commissionRate es un porcentaje solo si una fuente oficial lo acredita para esa categoría; estimatedCommission es precio × tasa y, si no se verifica, null. No inventes tasas. Ordena comisión estimada descendente, null al final. Añade la URL oficial consultada en reason." },
      { role: "user", content: JSON.stringify(items.map(({ asin, title, price, currency, rank, affiliateUrl }) => ({ asin, title, price, currency, rank, affiliateUrl }))) },
    ],
  });
  const text = response.output_text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let analysis: { products?: Array<{ asin: string; category?: string; commissionRate?: number | null; estimatedCommission?: number | null; reason?: string }> };
  try { analysis = JSON.parse(text); } catch { throw new Error("El análisis de productos no devolvió una lista válida."); }
  const byAsin = new Map((analysis.products || []).map((item) => [item.asin, item]));
  const products = items.map((item) => {
    const result = byAsin.get(item.asin);
    const rate = typeof result?.commissionRate === "number" ? result.commissionRate : null;
    const estimate = rate === null || item.price === null ? null : Math.round(item.price * rate / 100 * 100) / 100;
    return { ...item, category: result?.category || "Categoría pendiente de verificar", commissionRate: rate, estimatedCommission: estimate, commissionNote: result?.reason || "Amazon no ofrece una tasa verificable para este producto." };
  }).sort((a, b) => (b.estimatedCommission ?? -1) - (a.estimatedCommission ?? -1));
  return { products, source: "Amazon Creators API y tabla oficial de comisiones de Amazon.es", note: "Las comisiones reales dependen de la categoría y de las compras atribuidas; revisa Associates Central." };
}
