import { NextResponse } from "next/server";
import { safeError, setShopAutopilot } from "@/app/lib/auto-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const enabled = await setShopAutopilot(Boolean(body.enabled));
    return NextResponse.json({ enabled });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 503 });
  }
}
