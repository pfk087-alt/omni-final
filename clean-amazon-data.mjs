import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TAG = "kevinpatane20-21";
const files = ["data/social-queue.json", "data/affiliate-products.json"].filter(existsSync);

function cleanLink(raw, fallbackQuery) {
  let url;
  try { url = new URL(raw); } catch { url = new URL(`https://www.amazon.es/s?k=${encodeURIComponent(fallbackQuery)}`); }
  if (!/(^|\.)amazon\.(?:es|fr|de|it|nl|se|pl|com|co\.uk)$/i.test(url.hostname)) url = new URL(`https://www.amazon.es/s?k=${encodeURIComponent(fallbackQuery)}`);
  const asin = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase();
  if (asin) return `https://www.amazon.es/dp/${asin}?tag=${TAG}`;
  let query = url.searchParams.get("k") || url.searchParams.get("field-keywords") || fallbackQuery;
  try { query = decodeURIComponent(query.replace(/\+/g, "%20")); } catch {}
  const trackingIndex = query.search(/(?:tag|linkCode|ref_|ascsubtag|asc_source|ar_[a-z]+|creatorsDisableRedirect)(?:=|%3d)/i);
  if (trackingIndex >= 0) query = query.slice(0, trackingIndex);
  query = query.replace(/[.…?&#\s]+$/g, "").replace(/\s+/g, " ").trim() || fallbackQuery;
  return `https://www.amazon.es/s?k=${encodeURIComponent(query).replace(/%20/g, "+")}&tag=${TAG}`;
}

let changed = false;
for (const file of files) {
  const before = readFileSync(file, "utf8");
  let data;
  try { data = JSON.parse(before); } catch { console.error(`JSON inválido: ${file}`); process.exitCode = 1; continue; }
  const walk = (value, fallbackQuery = "hogar") => {
    if (Array.isArray(value)) { value.forEach((item) => walk(item, item?.product || item?.title || fallbackQuery)); return; }
    if (!value || typeof value !== "object") return;
    const itemQuery = String(value.product || value.title || fallbackQuery);
    for (const [key, child] of Object.entries(value)) {
      if ((key === "affiliateUrl" || key === "affiliate_url") && typeof child === "string") value[key] = cleanLink(child, itemQuery);
      else walk(child, itemQuery);
    }
  };
  walk(data);
  const after = `${JSON.stringify(data, null, 2)}\n`;
  if (after !== before) { writeFileSync(file, after); changed = true; console.log(`Enlaces normalizados: ${file}`); }
}
console.log(changed ? "Se actualizaron enlaces de afiliado." : "No hay enlaces de afiliado que corregir.");
