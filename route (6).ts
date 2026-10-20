import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Envía al menos un mensaje." }, { status: 400 });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Eres OMNI, un asistente útil, claro y amable. Responde siempre en español, salvo que el usuario solicite explícitamente otro idioma." },
        ...messages.map((message: { role: string; content: string }) => ({ role: message.role === "assistant" ? "assistant" as const : "user" as const, content: String(message.content) })),
      ],
    });
    return NextResponse.json({ message: completion.choices[0]?.message?.content ?? "No he podido generar una respuesta." });
  } catch (error) {
    console.error("Error en /api/chat:", error);
    return NextResponse.json({ error: process.env.OPENAI_API_KEY ? "No se pudo completar la respuesta." : "Configura OPENAI_API_KEY en el archivo .env.local." }, { status: 500 });
  }
}
