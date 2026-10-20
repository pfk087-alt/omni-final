import { NextResponse } from "next/server";
import { runDailyCompanyMission } from "@/app/lib/daily-company";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Compatibilidad con el botón de misión: la secuencia siempre es JEFE → PUBLICISTA → COMERCIAL. */
export async function POST() {
  try {
    return NextResponse.json(await runDailyCompanyMission());
  } catch (error) {
    console.error("[Passerelle agents]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo completar la misión." }, { status: 502 });
  }
}
