import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("file");
    if (!(audio instanceof File)) return NextResponse.json({ error: "No se recibió ningún archivo de audio." }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Whisper detecta el idioma automáticamente cuando se omite el parámetro language.
    const result = await client.audio.transcriptions.create({ file: audio, model: "whisper-1" });
    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error("Error en /api/transcribe:", error);
    return NextResponse.json({ error: process.env.OPENAI_API_KEY ? "No se pudo transcribir el audio." : "Configura OPENAI_API_KEY en el archivo .env.local." }, { status: 500 });
  }
}
