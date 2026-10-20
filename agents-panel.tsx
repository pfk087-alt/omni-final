"use client";

import { useState } from "react";
import "./agents-panel.css";

type AgentData = {
  products?: Array<{ asin: string; title: string; price: number | null; currency: string; estimatedCommission: number | null; commissionNote: string }>;
  ads?: Array<{ asin: string; product: string; ads: Array<{ channel: string; title: string; text: string; callToAction: string }> }>;
  leads?: Array<{ name: string; type: string; why: string; url: string; nextStep: string }>;
  note?: string;
  salesNote?: string;
};

export default function AgentsPanel({ affiliateId }: { affiliateId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AgentData | null>(null);
  async function run() {
    setBusy(true); setError(""); setData(null);
    try {
      const response = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ affiliateId }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "No se pudo completar la misión.");
      setData(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error al ejecutar los agentes."); }
    finally { setBusy(false); }
  }
  return <section className="agent-mission"><div className="mission-intro"><div><span className="store-overline">OPERACIÓN OMNI · 3 AGENTES</span><h2>La tienda sigue trabajando</h2><p>El jefe compara productos y comisión; el publicista crea anuncios; el comercial busca posibles canales.</p></div><button onClick={() => void run()} disabled={busy || !affiliateId.trim()}>{busy ? "TRABAJANDO…" : "INICIAR MISIÓN ↗"}</button></div>
    {error && <p className="store-error" role="alert">{error}</p>}
    {data && <div className="mission-results"><section><h3>JEFE · PRODUCTOS DESTACADOS</h3><p>{data.note}</p>{data.products?.slice(0, 5).map((item) => <article key={item.asin}><b>{item.title}</b><span>{item.price === null ? "Precio no disponible" : `${item.price.toFixed(2)} ${item.currency}`} · {item.estimatedCommission === null ? "Comisión sin verificar" : `comisión aprox. ${item.estimatedCommission.toFixed(2)} ${item.currency}`}</span><small>{item.commissionNote}</small></article>)}</section><section><h3>PUBLICISTA · ANUNCIOS</h3>{data.ads?.map((item) => <article key={item.asin}><b>{item.product}</b>{item.ads.map((ad, index) => <p key={index}><strong>{ad.channel} · {ad.title}</strong><br/>{ad.text}<br/><em>{ad.callToAction}</em></p>)}</article>)}</section><section><h3>COMERCIAL · POSIBLES CANALES</h3><p>{data.salesNote}</p>{data.leads?.map((lead, index) => <article key={`${lead.url}-${index}`}><a href={lead.url} target="_blank" rel="noopener noreferrer">{lead.name}</a><span>{lead.type} · {lead.why}</span><small>{lead.nextStep}</small></article>)}</section></div>}
  </section>;
}
