"use client";

import { useEffect, useState } from "react";
import { FEATURED_PRODUCTS, amazonSearchUrl, type FeaturedProduct } from "./lib/featured-products";
import "./storefront.css";
import "./instagram.css";

type DailyPost = { date: string; productTitle: string; caption: string; hashtags: string[]; callToAction: string; affiliateDisclosure: string };
type Opportunity = { producto: string; porQueGana: string; competencia: string; precio: string };
const initialOpportunity: Opportunity = { producto: FEATURED_PRODUCTS[0].title, porQueGana: "El análisis verificable del JEFE está pendiente.", competencia: "SIN DATOS", precio: "Consultar en Amazon.es" };

export default function AffiliateStore({ affiliateTag }: { affiliateTag: string }) {
  const [products, setProducts] = useState<FeaturedProduct[]>(FEATURED_PRODUCTS);
  const [post, setPost] = useState<DailyPost | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState("");
  const [opportunity, setOpportunity] = useState<Opportunity>(initialOpportunity);
  const [missionState, setMissionState] = useState("JEFE → PUBLICISTA → COMERCIAL · preparando la misión diaria");
  const [commercialResults, setCommercialResults] = useState<Array<{ name: string; type: string; why: string; url: string }>>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/affiliate-products", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && active && Array.isArray(data.products) && data.products.length) setProducts(data.products);
      })
      .catch((error) => console.error("[Passerelle catálogo] No se pudo actualizar el catálogo:", error));
    fetch("/api/company/daily", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo actualizar la oportunidad.");
        if (!active) return;
        setOpportunity(data.oportunidad);
        setPost(data.post);
        setCommercialResults(data.leads || []);
        setMissionState(data.errors?.length ? `JEFE → PUBLICISTA → COMERCIAL · completada con ${data.errors.length} aviso(s)` : "JEFE → PUBLICISTA → COMERCIAL · misión diaria completada");
        setPostError(data.errors?.map((item: { agente: string; mensaje: string }) => `${item.agente}: ${item.mensaje}`).join(" · ") || "");
      })
      .catch((cause) => { if (active) setMissionState(cause instanceof Error ? `Misión diaria pendiente · ${cause.message}` : "Misión diaria pendiente"); })
      .finally(() => { if (active) setPostLoading(false); });
    setPostLoading(true);
    return () => { active = false; };
  }, []);

  async function loadDailyPost() {
    setPostLoading(true); setPostError("");
    try {
      const response = await fetch("/api/company/daily", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el post de hoy.");
      setOpportunity(data.oportunidad);
      setPost(data.post as DailyPost | null);
      setCommercialResults(data.leads || []);
      setMissionState("JEFE → PUBLICISTA → COMERCIAL · misión diaria completada");
      if (!data.post) throw new Error(data.errors?.map((item: { agente: string; mensaje: string }) => `${item.agente}: ${item.mensaje}`).join(" · ") || "No se pudo crear el post.");
    } catch (cause) { setPostError(cause instanceof Error ? cause.message : "No se pudo crear el post de hoy."); }
    finally { setPostLoading(false); }
  }

  return <main className="passerelle-store">
    <section className="opportunity-headline" aria-live="polite"><span>OPORTUNIDAD DE HOY:</span> {opportunity.producto}</section>
    <section className="opportunity-banner" aria-live="polite"><div className="opportunity-top"><span>●</span> OPORTUNIDAD DE HOY <small>{missionState}</small></div><p><strong>Freidora Moulinex</strong><span>Pocas reseñas, mucha demanda</span><span>Competencia <b>BAJA</b></span></p></section>
    <header className="store-nav"><a className="store-brand" href="/">PASSERELLE<span>SELECCIÓN</span></a><div className="nav-note"><i /> ENLACES DE AFILIADO AMAZON.ES</div><a className="nav-amazon" href="https://www.amazon.es/" target="_blank" rel="noopener noreferrer">Amazon.es ↗</a></header>
    <section className="store-hero"><div className="hero-copy"><span className="store-overline">TECNOLOGÍA ÚTIL · SELECCIÓN INDEPENDIENTE</span><h1>Buenos productos.<br/><em>Sin perder tiempo.</em></h1><p>Una selección para cocinar, limpiar y disfrutar del café. Elige un producto y consulta la oferta en Amazon.es.</p><div className="hero-proof"><span>01 <b>Selección directa</b></span><span>02 <b>Enlace de afiliado</b></span><span>03 <b>Compra en Amazon</b></span></div></div><div className="hero-art"><div className="hero-circle"/><div className="hero-stamp">PASSERELLE<br/>HOME EDIT</div><span className="hero-index">SELECCIÓN · ESPAÑA</span></div></section>
    <section className="catalog-section"><div className="catalog-head"><div><span className="store-overline">NUESTRA SELECCIÓN</span><h2>Hogar que funciona</h2><p>Tres productos para hacer más sencilla la rutina.</p></div><span className="live-badge"><i/>3 PRODUCTOS</span></div>
      <div className="products-grid">{products.map((product, index) => { const affiliateUrl = amazonSearchUrl(product.title, affiliateTag); return <article className="product-tile" key={product.id}><a className="tile-image" href={affiliateUrl} target="_blank" rel="sponsored nofollow noopener"><span className="tile-number">0{index + 1}</span><img src={product.imageUrl} alt={product.title}/>{typeof product.rating === "number" && <span className="rating-chip">★ {product.rating.toFixed(1)}</span>}<span className="tile-arrow">↗</span></a><div className="tile-info"><span className="tile-category">{product.category} · {product.brand}</span><h3>{product.title}</h3><a className="buy-button" href={affiliateUrl} target="_blank" rel="sponsored nofollow noopener">Ver en Amazon <span>↗</span></a><small>Precio y disponibilidad se consultan en Amazon.es.</small></div></article>; })}</div>
      <p className="catalog-refresh"><span>Enlaces con identificador de afiliado {affiliateTag}</span></p>
    </section>
    <section className="instagram-section"><div className="instagram-heading"><span className="store-overline">CONTENIDO DIARIO · PUBLICISTA</span><h2>Post de Instagram</h2><p>Un borrador diario creado después de que el JEFE elige el producto.</p></div><button className="instagram-button" onClick={() => void loadDailyPost()} disabled={postLoading}>{postLoading ? "PREPARANDO…" : post ? "ACTUALIZAR MISIÓN DE HOY" : "EJECUTAR MISIÓN DE HOY ↗"}</button>{postError && <p className="store-error" role="alert">{postError}</p>}{post && <article className="instagram-post"><div className="post-date">{post.date} · {post.productTitle}</div><p>{post.caption}</p><p className="post-cta">{post.callToAction}</p><p className="post-hashtags">{post.hashtags.join(" ")}</p><small>{post.affiliateDisclosure}</small></article>}{commercialResults.length > 0 && <div className="commercial-results"><h3>COMERCIAL · CANALES PÚBLICOS</h3>{commercialResults.slice(0, 5).map((lead, index) => <a key={`${lead.url}-${index}`} href={lead.url} target="_blank" rel="noopener noreferrer"><strong>{lead.name}</strong><span>{lead.type} · {lead.why}</span>↗</a>)}</div>}</section>
    <footer className="store-footer"><span>PASSERELLE · SELECCIÓN DE HOGAR</span><p>Como afiliado de Amazon, obtengo ingresos por las compras que cumplen los requisitos. Amazon puede cambiar precios y disponibilidad.</p></footer>
  </main>;
}
