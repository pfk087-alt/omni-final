import OpenAI from "openai";

export const SHOPIFY_API_VERSION = "2026-07";
export const AMAZON_MARKETPLACE = process.env.AMAZON_MARKETPLACE?.trim() || "www.amazon.es";

export type AmazonItem = {
  asin: string;
  title: string;
  features: string[];
  imageUrl: string | null;
  price: number | null;
  currency: string;
  rating: number | null;
  availability: string;
  rank: number | null;
  affiliateUrl: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name} en el entorno del servidor.`);
  return value;
}

export function getShopifyConfig() {
  const domain = requiredEnv("SHOPIFY_STORE_DOMAIN").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return { domain, token: requiredEnv("SHOPIFY_ADMIN_ACCESS_TOKEN") };
}

export async function shopify<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { domain, token } = getShopifyConfig();
  const response = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `Shopify devolvió HTTP ${response.status}.`);
  }
  return payload.data as T;
}

let tokenCache: { value: string; expiresAt: number } | undefined;
async function creatorsAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const clientId = requiredEnv("AMAZON_CREATOR_API_CLIENT_ID");
  const clientSecret = requiredEnv("AMAZON_CREATOR_API_CLIENT_SECRET");
  const response = await fetch("https://api.amazon.co.uk/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: "creatorsapi::default" }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Amazon Creators API: ${data.error_description || data.error || `HTTP ${response.status}`}`);
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
  return tokenCache.value;
}

function amazonRecord(item: any, partnerTag: string): AmazonItem | null {
  if (!item?.asin) return null;
  const listing = item.offersV2?.listings?.[0];
  const price = listing?.price?.money;
  const url = new URL(item.detailPageURL || `https://www.amazon.fr/dp/${item.asin}`);
  url.searchParams.set("tag", partnerTag);
  const rankValues = item.browseNodeInfo?.websiteSalesRank?.salesRank
    ?? item.browseNodeInfo?.websiteSalesRank?.value;
  const rank = Number(rankValues);
  const ratingCandidates = [
    item.customerReviews?.starRating?.value,
    item.customerReviews?.starRating?.displayValue,
    item.customerReviews?.rating,
    item.customerReviews?.averageRating,
    item.itemInfo?.customerReviews?.starRating?.value,
    item.itemInfo?.customerReviews?.rating,
    item.itemInfo?.customerReviews?.averageRating,
  ];
  const rating = ratingCandidates.map((candidate) => {
    if (typeof candidate === "number") return candidate;
    const match = typeof candidate === "string" ? candidate.match(/\d(?:[.,]\d+)?/) : null;
    return match ? Number(match[0].replace(",", ".")) : NaN;
  }).find((value) => Number.isFinite(value) && value >= 0 && value <= 5);
  return {
    asin: String(item.asin),
    title: String(item.itemInfo?.title?.displayValue || item.asin),
    features: (item.itemInfo?.features?.displayValues || []).slice(0, 5).map(String),
    imageUrl: item.images?.primary?.large?.url || item.images?.primary?.medium?.url || item.images?.primary?.small?.url || null,
    price: Number.isFinite(Number(price?.amount)) ? Number(price.amount) : null,
    currency: String(price?.currency || "EUR"),
    rating: rating ?? null,
    availability: String(listing?.availability?.type || listing?.availability?.message || "INCONNUE"),
    rank: Number.isFinite(rank) && rank > 0 ? rank : null,
    affiliateUrl: url.toString(),
  };
}

export async function searchAmazonBestSellers(partnerTag: string, target = 20, searchTerms?: string[]): Promise<AmazonItem[]> {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(partnerTag)) throw new Error("El Affiliate ID no tiene un formato válido.");
  const accessToken = await creatorsAccessToken();
  const keywords = searchTerms?.length ? searchTerms : ["randonnée", "cuisine", "maison", "jardin", "sport", "animaux"];
  const collected = new Map<string, AmazonItem>();
  for (const keyword of keywords) {
    const response = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "x-marketplace": AMAZON_MARKETPLACE },
      body: JSON.stringify({
        keywords: keyword, marketplace: AMAZON_MARKETPLACE, partnerTag, itemCount: 10, sortBy: "AvgCustomerReviews", minReviewsRating: 4,
        availability: "Available", condition: "New", languagesOfPreference: ["fr_FR"], currencyOfPreference: "EUR",
        resources: ["images.primary.large", "itemInfo.title", "itemInfo.features", "offersV2.listings.price", "offersV2.listings.availability", "browseNodeInfo.websiteSalesRank"],
      }),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Amazon Creators API: ${data.errors?.[0]?.message || `HTTP ${response.status}`}`);
    for (const raw of data.searchResult?.items || []) {
      const product = amazonRecord(raw, partnerTag);
      if (product && !collected.has(product.asin)) collected.set(product.asin, product);
    }
    if (collected.size >= target) break;
  }
  const items = Array.from(collected.values()).filter((item) => item.price !== null && item.currency === "EUR");
  items.sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  return items.slice(0, target);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function rewriteInFrench(items: AmazonItem[]) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_REWRITE_MODEL || "gpt-5.4-mini",
    max_output_tokens: 6500,
    input: [
      { role: "system", content: "Tu es rédacteur e-commerce SEO francophone. Pour chaque produit, écris un titre français original, un résumé bref et trois points factuels reformulés. N'invente aucune caractéristique, promesse ni certification. Ne recopie pas le texte source. Retourne uniquement un tableau JSON valide avec les clés asin, title, summary, features (tableau de chaînes), sans Markdown ni HTML." },
      { role: "user", content: JSON.stringify(items.map(({ asin, title, features, affiliateUrl }) => ({ asin, title, features, affiliateUrl }))) },
    ],
  });
  const text = response.output_text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const value = JSON.parse(text) as Array<{ asin: string; title: string; summary: string; features: string[] }>;
  const byAsin = new Map(value.map((product) => [product.asin, product]));
  return items.map((item) => {
    const rewritten = byAsin.get(item.asin);
    if (!rewritten?.title || !rewritten.summary) throw new Error(`OpenAI no devolvió contenido válido para ${item.asin}.`);
    const bullets = Array.isArray(rewritten.features) ? rewritten.features.slice(0, 3).map((feature) => `<li>${escapeHtml(String(feature).slice(0, 240))}</li>`).join("") : "";
    const descriptionHtml = `<p>${escapeHtml(rewritten.summary.slice(0, 700))}</p>${bullets ? `<ul>${bullets}</ul>` : ""}<p>Le prix et la disponibilité peuvent changer. Vérifiez les informations à jour sur Amazon.fr.</p><p><a href="${escapeHtml(item.affiliateUrl)}" rel="nofollow sponsored">Voir l’offre sur Amazon.fr</a></p><small>En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.</small>`;
    return { ...item, seoTitle: rewritten.title.slice(0, 255), descriptionHtml };
  });
}

export async function setShopAutopilot(enabled: boolean, affiliateId?: string) {
  const query = `query AutoStoreSettingsProduct { products(first: 1, query: "tag:omni-auto-store", sortKey: CREATED_AT) { nodes { id } } }`;
  const data = await shopify<{ products: { nodes: { id: string }[] } }>(query);
  const ownerId = data.products.nodes[0]?.id;
  if (!ownerId) throw new Error("Importa productos antes de activar VENDER SOLO.");
  const result = await shopify<{ metafieldsSet: { userErrors: { message: string }[] } }>(
    `mutation SetAutoStore($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`,
    { metafields: [
      { ownerId, namespace: "omni_auto_store", key: "enabled", type: "boolean", value: String(enabled) },
      ...(affiliateId ? [{ ownerId, namespace: "omni_auto_store", key: "affiliate_id", type: "single_line_text_field", value: affiliateId }] : []),
    ] },
  );
  if (result.metafieldsSet.userErrors.length) throw new Error(result.metafieldsSet.userErrors[0].message);
  return enabled;
}

export async function saveShopAffiliateId(affiliateId: string) {
  const query = `query AutoStoreSettingsProduct { products(first: 1, query: "tag:omni-auto-store", sortKey: CREATED_AT) { nodes { id } } }`;
  const data = await shopify<{ products: { nodes: { id: string }[] } }>(query);
  const ownerId = data.products.nodes[0]?.id;
  if (!ownerId) return;
  const result = await shopify<{ metafieldsSet: { userErrors: { message: string }[] } }>(
    `mutation SaveAffiliateId($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`,
    { metafields: [{ ownerId, namespace: "omni_auto_store", key: "affiliate_id", type: "single_line_text_field", value: affiliateId }] },
  );
  if (result.metafieldsSet.userErrors.length) throw new Error(result.metafieldsSet.userErrors[0].message);
}

export function safeError(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado en la integración.";
}
