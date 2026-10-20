import { NextResponse } from "next/server";
import { runDailyCompanyMission } from "@/app/lib/daily-company";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const mission = await runDailyCompanyMission();
    console.info(`[Passerelle][Misión diaria] Secuencia: ${mission.order.join(" -> ")}; producto: ${mission.oportunidad.producto}.`);
    return NextResponse.json({ ok: true, ...mission });
  } catch (error) {
    console.error("[Passerelle][Misión diaria Cron]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falló la misión diaria." }, { status: 502 });
  }
}
