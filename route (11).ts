import { NextResponse } from "next/server";
import { crearPostDiarioInstagram } from "@/agents/publicista";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const post = await crearPostDiarioInstagram();
    return NextResponse.json({ post });
  } catch (error) {
    console.error("[Passerelle Instagram]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo generar el borrador diario." }, { status: 502 });
  }
}
