import OpenAI from "openai";
type CommercialProduct = { title: string; features: string[]; price: number | null; currency: string };

export type Lead = { product: string; name: string; type: string; why: string; url: string; nextStep: string };

/** Investiga posibles canales/clientes de venta usando búsqueda web en tiempo real. */
export async function buscarClientes(productos: CommercialProduct[]) {
  if (!productos.length) return { leads: [] as Lead[], note: "No hay productos que investigar." };
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_REWRITE_MODEL || "gpt-4o-mini",
    max_output_tokens: 3000,
    tools: [{ type: "web_search", search_context_size: "high", user_location: { type: "approximate", country: "ES", city: "Madrid", region: "Comunidad de Madrid" } }],
    input: [
      { role: "system", content: "Eres el COMERCIAL de Passerelle, tienda de afiliados de Amazon España. Busca canales públicos españoles que puedan atraer compradores al producto: medios de hogar, cocina o café, creadores con páginas públicas, clubes o comunidades temáticas. Devuelve JSON {leads:[{product,name,type,why,url,nextStep}]}. Incluye solo entidades reales encontradas en fuentes públicas y una URL visible que las respalde. No inventes nombres ni contactos, no escribas ni envíes mensajes. Si no encuentras oportunidades verificables, devuelve lista vacía." },
      { role: "user", content: JSON.stringify(productos.slice(0, 5).map(({ title, features, price, currency }) => ({ title, features, price, currency }))) },
    ],
  });
  const text = response.output_text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let data: { leads?: Lead[] };
  try { data = JSON.parse(text); } catch { throw new Error("La búsqueda de clientes no devolvió resultados válidos."); }
  const leads = (data.leads || []).filter((lead) => lead.name && lead.url && /^https?:\/\//i.test(lead.url)).slice(0, 15);
  return { leads, note: "Son posibles canales comerciales públicos; verifica que acepten colaboraciones antes de contactar." };
}
