import { NextResponse } from "next/server";
import { runDailyCompanyMission } from "@/app/lib/daily-company";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const mission = await runDailyCompanyMission();
    return NextResponse.json(mission);
  } catch (error) {
    console.error("[Passerelle][Misión diaria]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo iniciar la misión diaria." }, { status: 502 });
  }
}
