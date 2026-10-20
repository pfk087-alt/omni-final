"use client";

import { useEffect, useState } from "react";
import styles from "./store.module.css";

type StoreStatus = { connected: boolean; enabled: boolean; importedToday: number; totalProducts: number; revenueToday: number | null; error?: string };

export default function AutoStorePage() {
  const [affiliateId, setAffiliateId] = useState("");
  const [status, setStatus] = useState<StoreStatus>({ connected: false, enabled: false, importedToday: 0, totalProducts: 0, revenueToday: null });
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/auto-store/status", { cache: "no-store" });
    const data = await response.json(); setStatus(data);
  }
  useEffect(() => { setAffiliateId(localStorage.getItem("omni-affiliate-id") || ""); void refresh(); }, []);
  function saveId(value: string) { setAffiliateId(value); localStorage.setItem("omni-affiliate-id", value); }

  async function importProducts() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auto-store/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ affiliateId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Falló la importación.");
      setMessage(`${data.imported} productos creados como borrador · ${data.skipped} ya existían · ${data.found} resultados válidos.`);
      if (data.errors?.length) setError(data.errors.slice(0, 3).join(" · "));
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error de importación."); }
    finally { setLoading(false); }
  }

  async function toggleAutopilot() {
    setToggling(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auto-store/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !status.enabled }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo actualizar el modo.");
      setStatus((value) => ({ ...value, enabled: data.enabled }));
      setMessage(data.enabled ? "VENDER SOLO activado. La sincronización programada actualizará precios y disponibilidad cada hora." : "Modo autónomo desactivado.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error al activar el modo autónomo."); }
    finally { setToggling(false); }
  }

  return <main className={styles.shell}>
    <header className={styles.topbar}><a className={styles.brand} href="/">◈ <span>OMNI <i>AUTONOMOUS COMPANY</i></span></a><div className={styles.topRight}><span className={`${styles.health} ${status.connected ? styles.good : ""}`}><b />{status.connected ? "SHOPIFY CONECTADO" : "CONFIGURACIÓN PENDIENTE"}</span><a className={styles.back} href="/">← Oficina</a></div></header>
    <section className={styles.content}>
      <div className={styles.head}><div><p className={styles.eyebrow}>COMMERCE AUTONOME <span>·</span> AMAZON FR</p><h1>Tu tienda,<br/><em>en piloto automático.</em></h1><p className={styles.sub}>Un catálogo afiliado en francés que se actualiza con disponibilidad y precios de Amazon.</p></div><div className={styles.pulse}><span>◈</span><i /></div></div>
      <div className={styles.banner}><div><strong>{status.connected ? status.enabled ? "PILOTO AUTOMÁTICO ACTIVO" : "TIENDA EN MODO MANUAL" : "CONECTA TUS SERVICIOS"}</strong><p>{status.connected ? status.enabled ? "Sincronización programada cada hora. Productos visibles como borradores hasta que los publiques." : "Configura el catálogo para empezar a importar productos reales." : "La API de Amazon Creators y Shopify necesitan credenciales de servidor."}</p></div><span className={status.enabled ? styles.live : styles.off}>{status.enabled ? "● LIVE" : "○ OFFLINE"}</span></div>
      <div className={styles.metrics}><article><span>COMISIONES HOY</span><strong>—</strong><small>Consulta el informe de Associates</small></article><article><span>IMPORTADOS HOY</span><strong>{status.importedToday}</strong><small>Borradores creados en Shopify</small></article><article><span>EN CATÁLOGO</span><strong>{status.totalProducts}</strong><small>Productos OMNI vinculados</small></article><article><span>ACTUALIZACIÓN</span><strong>60<small> min</small></strong><small>Cron horario en Vercel Pro</small></article></div>
      <div className={styles.workgrid}>
        <section className={styles.panel}><div className={styles.panelHead}><div><span>01 / CATÁLOGO</span><h2>Importar productos ganadores</h2></div><b>↗</b></div><p>Busca productos destacados en seis categorías de Amazon.fr, redacta sus fichas originales en francés y los crea como borradores de Shopify.</p><label className={styles.field}>AMAZON AFFILIATE ID<input value={affiliateId} onChange={(event) => saveId(event.target.value)} placeholder="p. ej. mi-tienda-21" autoComplete="off" /></label><button className={styles.import} type="button" onClick={() => void importProducts()} disabled={loading || !affiliateId.trim() || !status.connected}>{loading ? <><i className={styles.spinner} /> CONSULTANDO AMAZON + OPENAI</> : "IMPORTAR 20 PRODUCTOS GANADORES AHORA"}<span>↗</span></button><small className={styles.hint}>El ID se guarda en este navegador. Nunca se envía a Shopify ni se usa como secreto.</small></section>
        <section className={`${styles.panel} ${styles.solo}`}><div className={styles.panelHead}><div><span>02 / AUTOPILOTO</span><h2>VENDER SOLO</h2></div><div className={`${styles.switch} ${status.enabled ? styles.switchOn : ""}`}><i /></div></div><p>Activa las actualizaciones automáticas de precio y disponibilidad de los productos enlazados. Amazon procesa el pedido y el envío.</p><ul><li><span>↻</span> Precio y stock cada 60 minutos</li><li><span>↗</span> Compra dirigida a Amazon.fr</li><li><span>✓</span> Sin inventario local en Shopify</li></ul><button className={status.enabled ? styles.stop : styles.enable} onClick={() => void toggleAutopilot()} disabled={toggling || !status.connected}>{toggling ? "GUARDANDO…" : status.enabled ? "PAUSAR PILOTO" : "ACTIVAR VENDER SOLO"}</button></section>
      </div>
      {message && <div className={styles.notice}>{message}</div>}{error && <div className={styles.error}>{error}</div>}
      {!status.connected && <section className={styles.setup}><div><span className={styles.eyebrow}>ANTES DE ACTIVAR</span><h2>Conecta las claves del servidor</h2><p>Solo necesitas introducir el Affiliate ID en la app. Las credenciales API se configuran como variables de entorno privadas en Vercel/local:</p></div><pre>{`AMAZON_CREATOR_API_CLIENT_ID=\nAMAZON_CREATOR_API_CLIENT_SECRET=\nAMAZON_PARTNER_TAG=\nSHOPIFY_STORE_DOMAIN=tu-tienda.myshopify.com\nSHOPIFY_ADMIN_ACCESS_TOKEN=\nOPENAI_API_KEY=\nCRON_SECRET=`}</pre><small>Amazon Creators API requiere aceptación en Associates y acceso API aprobado. Shopify necesita scopes read_products, write_products y write_shop. No se usa contenido de ejemplo.</small></section>}
      <footer className={styles.footer}>En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises. Les prix et la disponibilité peuvent changer. <span>OMNI AUTO STORE · ANNECY · FR</span></footer>
    </section>
  </main>;
}
