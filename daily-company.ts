import { unstable_cache } from "next/cache";
import { buscarClientes, type Lead } from "@/agents/comercial";
import { generarOportunidadDiaria, type OportunidadDiaria } from "@/agents/jefe";
import { crearPostDiarioInstagram, type DailyInstagramPost } from "@/agents/publicista";
import { FEATURED_PRODUCTS } from "@/app/lib/featured-products";

export type DailyCompanyMission = {
  oportunidad: OportunidadDiaria;
  post: DailyInstagramPost | null;
  leads: Lead[];
  errors: { agente: string; mensaje: string }[];
  order: string[];
};

const fallbackOpportunity: OportunidadDiaria = {
  producto: FEATURED_PRODUCTS[0].title,
  porQueGana: "Producto de la selección Passerelle; el análisis verificable del JEFE está pendiente.",
  competencia: "SIN DATOS",
  precio: "Consultar en Amazon.es",
};

/** Ejecuta la oficina de forma secuencial para que cada agente reciba el resultado anterior. */
export async function runDailyCompanyMission(now = new Date()): Promise<DailyCompanyMission> {
  const errors: DailyCompanyMission["errors"] = [];
  const order: string[] = [];
  let oportunidad = fallbackOpportunity;
  let post: DailyInstagramPost | null = null;
  let leads: Lead[] = [];

  order.push("JEFE");
  try {
    oportunidad = await generarOportunidadDiaria(now);
  } catch (error) {
    console.error("[Passerelle][JEFE]", error);
    errors.push({ agente: "JEFE", mensaje: error instanceof Error ? error.message : "No se pudo verificar la oportunidad." });
  }

  order.push("PUBLICISTA");
  try {
    post = await crearPostDiarioInstagram(now, oportunidad.producto);
  } catch (error) {
    console.error("[Passerelle][PUBLICISTA]", error);
    errors.push({ agente: "PUBLICISTA", mensaje: error instanceof Error ? error.message : "No se pudo preparar el contenido." });
  }

  order.push("COMERCIAL");
  try {
    const selected = FEATURED_PRODUCTS.find((product) => product.title === oportunidad.producto) ?? FEATURED_PRODUCTS[0];
    const getLeads = unstable_cache(
      () => buscarClientes([{ title: selected.title, features: [], price: null, currency: "EUR" }]),
      ["passerelle-daily-commercial", selected.id, parisDate(now)],
      { revalidate: 86_400 },
    );
    leads = (await getLeads()).leads;
  } catch (error) {
    console.error("[Passerelle][COMERCIAL]", error);
    errors.push({ agente: "COMERCIAL", mensaje: error instanceof Error ? error.message : "No se pudo preparar la búsqueda comercial." });
  }

  return { oportunidad, post, leads, errors, order };
}

function parisDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
