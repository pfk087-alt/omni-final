import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 300;

type AgentId = "ceo" | "research" | "builder" | "sales" | "cfo";
type Event = { type: string; agent?: AgentId; status?: string; message?: string; delta?: string; result?: string; append?: boolean; success?: boolean };
type AgentResult = { result: string; ok: boolean };
type AgentSpec = { id: AgentId; name: string; task: string; maxTokens: number };

const specialistSpecs: AgentSpec[] = [
  { id: "research", name: "RESEARCH", maxTokens: 7000, task: `Investiga en toda Haute-Savoie (74), priorizando Annecy, Annecy-le-Vieux, Seynod y Meythet. Sectores prioritarios: outdoor, artesanía, queso y alimentación local, deportes de montaña y decoración. Busca hasta 20 comercios locales que vendan SUS PROPIOS productos en Amazon.fr. Un candidato solo entra si tiene ambas pruebas: (A) una ficha de producto Amazon.fr abierta con ASIN o boutique oficial Amazon que identifique explícitamente al comercio/marca como vendedor o titular de la marca; enlaza esa página exacta, nunca una URL inventada, una búsqueda genérica ni una URL amazon.fr/<slug> sin ficha verificable; (B) fuente pública del comercio y fuente actual del nombre/cargo de su dirigente legal (RNE/BODACC, annuaire-entreprises.data.gouv.fr o aviso legal oficial). Verifica nombre de empresa, dirección/establecimiento en Haute-Savoie y persona dirigente. Una marca vendida por un tercero no prueba que el comercio local venda en Amazon. No cuentes Amazon Logistics, lockers, afiliados, puntos de recogida, grandes cadenas solo presentes en Amazon, negocios de otras regiones, vendedores con mero nombre coincidente, fuentes de directorios genéricos ni personas cuya relación no esté acreditada. Formato de cada registro: empresa y marca; comuna y dirección de establecimiento; actividad; ASIN + URL Amazon.fr exacta + texto de Amazon que identifica al vendedor/brand owner; nombre completo y cargo actual del dirigente; URL primaria del registro/aviso legal; detalle concreto del producto/servicio con URL fuente. Solo acepta un negocio si los puntos A y B están comprobados; si no puedes abrir/verificar la ficha o el cargo actual, descártalo. Deduplica empresa y marca. Devuelve menos de 20 si esa es la evidencia disponible; cero es mejor que una lista débil. No inventes ni completes vacíos con inferencias. AUDITORÍA OBLIGATORIA: incluye una fila en la lista final solo si cada campo requerido está presente y respaldado por sus fuentes. Si falta ASIN, Amazon no identifica al vendedor/titular, falta nombre actual del dirigente, o falta su fuente primaria, elimina todo el registro de la lista; no lo menciones ni en secciones de candidatos descartados, ejemplos o recomendaciones. No afirmes 20 investigados sin indicarlo. Tras filtrar, declara el número de candidatos que cumplen todos los criterios. Si ese número es cero, dilo explícitamente. Al final resume consultas, fecha y limitaciones.` },
  { id: "builder", name: "BUILDER / CTO", maxTokens: 3000, task: `Diseña la página/demo comercial Passerelle para el servicio Amazon → Shopify en Annecy-le-Vieux. Usa la demo local ya creada en /demo como punto de entrada e indica mejoras concretas para vender un piloto. No afirmes que hay conexión API, catálogo real, reseñas, clientes ni migraciones realizadas. Distingue el prototipo local de un servicio desplegado.` },
  { id: "sales", name: "SALES / COPYWRITER", maxTokens: 7000, task: `Redacta en francés un email de prospección distinto para cada comercio de la lista Research que haya superado TODOS los criterios (hasta 20). Usa el nombre del gérant verificado en el saludo profesional y personaliza con un detalle de su actividad respaldado por la URL citada por Research. Menciona su presencia en Amazon solo cuando exista la URL Amazon.fr aportada. Presenta Shopify como propuesta opcional, no como diagnóstico de una carencia que no esté probada. Incluye asunto, email natural y breve, llamada a una conversación de 15 minutos y precio de referencia: configuración desde 1.290 € + soporte opcional de 49 €/mes, sujeto a definir alcance. Debajo de cada email lista URL Amazon.fr, fuente del detalle y fuente pública del nombre/cargo del gérant. No inventes correos electrónicos, hechos, familiaridad ni personalización. No redactes email para candidatos sin pruebas completas. Si no hay candidatos válidos, indícalo y entrega una plantilla general separada y marcada como plantilla. No envíes los emails.` },
  { id: "cfo", name: "CFO", maxTokens: 2200, task: `Analiza la oferta Passerelle — servicio Amazon → Shopify en Annecy-le-Vieux. Usa cifras transparentes: tarifa indicativa de configuración desde 1.290 € y soporte opcional de 49 €/mes. Calcula el número de instalaciones necesarias para superar el objetivo comercial de 10.000 € brutos; separa instalación de MRR, costes, IVA, cobro efectivo, capacidad de entrega y escenarios. Indica cuántos comercios quedaron verificados por Research y trata la lista como límite de prospección, no como clientes ni ventas. No inventes costes ni prometas ingresos.` },
];

function emit(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, event: Event) {
  try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { /* El cliente cerró la conexión. */ }
}

async function completeAgent(client: OpenAI, controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, agent: AgentId, system: string, prompt: string, maxTokens: number, options: { webSearch?: boolean; append?: boolean } = {}): Promise<string> {
  emit(controller, encoder, { type: "status", agent, status: "working" });
  let result = "";
  if (options.webSearch) {
    const stream = await client.responses.create({
      model: "gpt-4o-mini", stream: true, max_output_tokens: maxTokens,
      tools: [{ type: "web_search", search_context_size: "high", user_location: { type: "approximate", country: "FR", city: "Annecy", region: "Auvergne-Rhône-Alpes" } }],
      input: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });
    for await (const event of stream) if (event.type === "response.output_text.delta") {
      result += event.delta;
      emit(controller, encoder, { type: "delta", agent, delta: event.delta });
    }
  } else {
    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini", stream: true, max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });
    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        result += delta;
        emit(controller, encoder, { type: "delta", agent, delta });
      }
    }
  }
  if (!result.trim()) throw new Error("OpenAI devolvió una respuesta vacía.");
  emit(controller, encoder, { type: "result", agent, result, append: options.append });
  return result;
}

async function runAgent(args: {
  client: OpenAI; controller: ReadableStreamDefaultController<Uint8Array>; encoder: TextEncoder;
  id: AgentId; name: string; system: string; prompt: string; maxTokens: number; webSearch?: boolean; append?: boolean;
}): Promise<AgentResult> {
  const { client, controller, encoder, id, name, system, prompt, maxTokens, webSearch, append } = args;
  console.info(`[OMNI][${name}] Iniciando tarea con OpenAI gpt-4o-mini${webSearch ? " + búsqueda web" : ""}.`);
  emit(controller, encoder, { type: "status", agent: id, status: "thinking" });
  emit(controller, encoder, { type: "activity", agent: id, message: `Enviando tarea a OpenAI gpt-4o-mini${webSearch ? " con búsqueda web" : ""}.` });
  try {
    const result = await completeAgent(client, controller, encoder, id, system, prompt, maxTokens, { webSearch, append });
    console.info(`[OMNI][${name}] Tarea completada con OpenAI.`);
    return { result, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido de OpenAI.";
    console.error(`[OMNI][${name}] Falló la llamada real a OpenAI: ${message}`);
    emit(controller, encoder, { type: "error", agent: id, message: `OpenAI no pudo completar esta tarea: ${message}` });
    return { result: "", ok: false };
  }
}

export async function POST(request: Request) {
  let objective: unknown;
  let phase: unknown;
  try { ({ objective, phase } = await request.json()); }
  catch { return Response.json({ error: "La solicitud no contiene un objetivo válido." }, { status: 400 }); }
  if (typeof objective !== "string" || !objective.trim()) return Response.json({ error: "Escribe un objetivo para iniciar la misión." }, { status: 400 });

  // La misión solo se ejecuta con la clave real configurada en el servidor. No hay respuestas simuladas.
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Falta OPENAI_API_KEY en .env.local. La misión no se ha iniciado." }, { status: 500 });
  const client = new OpenAI({ apiKey, timeout: 55_000, maxRetries: 0 });
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const system = "Eres un agente de negocio de OMNI. Responde en español salvo que se pidan entregables en francés. Sé riguroso, distingue hechos de hipótesis y aporta fuentes web directas para afirmaciones verificables. Nunca afirmes que una comunicación se envió, que se cobró dinero ni que se ejecutó una migración.";
      const objectiveText = objective.trim();
      let allSucceeded = true;
      const deliverables: Partial<Record<AgentId, string>> = {};
      try {
        if (phase === "research-sales") {
          emit(controller, encoder, { type: "activity", agent: "research", message: "Ampliando la búsqueda a Annecy, Seynod, Meythet y Haute-Savoie; solo contará evidencia directa de Amazon.fr y del gérant." });
          const researchSpec = specialistSpecs[0];
          const research = await runAgent({
            client, controller, encoder, id: "research", name: "RESEARCH", system,
            prompt: `Objetivo del usuario: ${objectiveText}\n\n${researchSpec.task}`,
            maxTokens: researchSpec.maxTokens, webSearch: true,
          });
          deliverables.research = research.result;
          allSucceeded &&= research.ok;

          emit(controller, encoder, { type: "activity", agent: "sales", message: "Sales redacta únicamente para comercios con pruebas completas del marketplace y del gérant." });
          const salesSpec = specialistSpecs.find((spec) => spec.id === "sales")!;
          const sales = await runAgent({
            client, controller, encoder, id: "sales", name: "SALES / COPYWRITER", system,
            prompt: `Objetivo del usuario: ${objectiveText}\n\nHallazgos de Research (fuente de verdad; incluye solo registros completos):\n${research.result || "Research no completó la verificación. No inventes candidatos ni datos; informa que no es posible escribir correos personalizados."}\n\n${salesSpec.task}`,
            maxTokens: salesSpec.maxTokens,
          });
          deliverables.sales = sales.result;
          allSucceeded &&= sales.ok;
          emit(controller, encoder, { type: "activity", agent: "research", message: allSucceeded ? "Research y Sales terminaron con respuestas de OpenAI; revisa cada URL y dato antes de contactar." : "La fase terminó con una llamada fallida; revisa los errores." });
          console.info(`[OMNI][RESEARCH+SALES] Fase finalizada. Llamadas completadas: ${allSucceeded}.`);
          emit(controller, encoder, { type: "complete", success: allSucceeded });
          return;
        }

        emit(controller, encoder, { type: "activity", agent: "ceo", message: "El CEO está contrastando el brief con información pública del mercado local." });
        const strategy = await runAgent({
          client, controller, encoder, id: "ceo", name: "CEO / Estratega", system,
          prompt: `Brief del usuario: ${objectiveText}\n\nEl producto ya está definido como Passerelle: servicio de configuración de una tienda Shopify desde un catálogo Amazon para pequeños comercios de Annecy-le-Vieux. Evalúa con búsqueda web el contexto público local y crea un plan de misión conciso. No cambies el producto. No inventes que los comercios locales venden en Amazon; Research lo verificará. Oferta indicativa a validar: configuración desde 1.290 € y soporte opcional de 49 €/mes. El objetivo comercial es 10.000 € brutos, no garantizados.`,
          maxTokens: 1500, webSearch: true,
        });
        deliverables.ceo = strategy.result;
        allSucceeded &&= strategy.ok;
        emit(controller, encoder, { type: "activity", agent: "ceo", message: "Brief estratégico listo. Research está comprobando tiendas y fuentes." });

        const research = await runAgent({
          client, controller, encoder, id: "research", name: "RESEARCH", system,
          prompt: `Misión: ${objectiveText}\n\nDecisión/brief del CEO:\n${strategy.result || "El CEO no devolvió análisis; usa el brief del usuario y no inventes información."}\n\n${specialistSpecs[0].task}`,
          maxTokens: specialistSpecs[0].maxTokens, webSearch: true,
        });
        deliverables.research = research.result;
        allSucceeded &&= research.ok;

        const downstream = specialistSpecs.slice(1);
        const work = await Promise.all(downstream.map(async (spec) => {
          emit(controller, encoder, { type: "activity", agent: spec.id, message: `${spec.name} recibe el brief de Passerelle y los hallazgos de Research.` });
          const extra = spec.id === "sales"
            ? `\n\nHallazgos de Research (fuente de verdad; personaliza solo con tiendas y datos respaldados):\n${research.result || "Research no completó la comprobación. No atribuyas ventas en Amazon a ninguna tienda ni inventes nombres. Indica que no es posible generar emails personales verificables."}`
            : spec.id === "cfo"
              ? `\n\nHallazgos de Research (no tratar prospectos como clientes):\n${research.result || "Research no completó la comprobación. Indica que no se conoce el número de tiendas verificadas."}`
              : "";
          return { spec, output: await runAgent({
            client, controller, encoder, id: spec.id, name: spec.name, system,
            prompt: `Brief de misión:\n${strategy.result || objectiveText}\n\n${spec.task}${extra}\n\nObjetivo del usuario: ${objectiveText}`,
            maxTokens: spec.maxTokens,
          }) };
        }));
        for (const { spec, output } of work) {
          deliverables[spec.id] = output.result;
          allSucceeded &&= output.ok;
        }

        emit(controller, encoder, { type: "activity", agent: "ceo", message: "El CEO consolida las fuentes, resultados y tareas pendientes." });
        const finalPrompt = `Objetivo: ${objectiveText}\n\nEscribe el resumen ejecutivo final en español. Resume la propuesta Passerelle, número de comercios de Annecy confirmados realmente como vendedores de Amazon, fuentes y límites de la investigación, cifra CFO, demo local http://localhost:3001/demo y pasos que la persona debe completar manualmente para intentar vender. Resume solo los emails que Sales realmente pudo personalizar. Aclara que no se ha contactado ni cobrado a nadie. Si no se encontraron 20 tiendas, dilo explícitamente y no presentes arquetipos como negocios. No inventes links públicos de despliegue.\n\nResultados de agentes:\n${["ceo", ...specialistSpecs.map((spec) => spec.id)].map((id) => `${id.toUpperCase()}:\n${deliverables[id as AgentId] || "ERROR: no hay resultado de este agente."}`).join("\n\n")}`;
        const final = await runAgent({ client, controller, encoder, id: "ceo", name: "CEO / Resumen ejecutivo", system, prompt: finalPrompt, maxTokens: 2000, append: true });
        allSucceeded &&= final.ok;
        emit(controller, encoder, { type: "activity", agent: "ceo", message: allSucceeded ? "Misión completada con resultados de OpenAI." : "La misión terminó con tareas fallidas; revisa los errores y fuentes antes de actuar." });
        console.info(`[OMNI][COORDINADOR] Misión finalizada. Éxito total: ${allSucceeded}.`);
        emit(controller, encoder, { type: "complete", success: allSucceeded });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error inesperado del coordinador.";
        console.error(`[OMNI][COORDINADOR] La misión no pudo completarse: ${message}`);
        allSucceeded = false;
        emit(controller, encoder, { type: "error", agent: "ceo", message: `La misión no pudo completarse: ${message}` });
        emit(controller, encoder, { type: "complete", success: false });
      } finally { try { controller.close(); } catch { /* El stream ya se cerró. */ } }
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
