import { NextResponse } from "next/server";
import { crearPostDiarioInstagram } from "@/agents/publicista";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const post = await crearPostDiarioInstagram();
    console.info(`[Passerelle Instagram][${post.date}] Borrador diario preparado para ${post.productTitle}.`);
    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error("[Passerelle Instagram Cron]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falló la generación diaria." }, { status: 502 });
  }
}
