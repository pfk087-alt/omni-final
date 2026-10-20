import { NextResponse } from "next/server";
import { AMAZON_MARKETPLACE, safeError, shopify } from "@/app/lib/auto-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SyncProduct = {
  id: string;
  setting: { value: string } | null;
  affiliate: { value: string } | null;
  variants: { nodes: { id: string; sku: string | null }[] };
};

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const products = await shopify<{ products: { nodes: SyncProduct[] } }>(
      `query AutoStoreSyncProducts { products(first: 250, query: "tag:omni-auto-store", sortKey: CREATED_AT) { nodes { id setting: metafield(namespace: "omni_auto_store", key: "enabled") { value } affiliate: metafield(namespace: "omni_auto_store", key: "affiliate_id") { value } variants(first: 1) { nodes { id sku } } } } }`,
    );
    const settings = products.products.nodes[0];
    if (settings?.setting?.value !== "true") return NextResponse.json({ skipped: true, reason: "VENDER SOLO está desactivado." });
    const partnerTag = settings?.affiliate?.value;
    if (!partnerTag) throw new Error("Guarda el Affiliate ID importando productos antes de activar la sincronización.");
    const ids = products.products.nodes.flatMap((p) => p.variants.nodes.map((v) => v.sku).filter((sku): sku is string => Boolean(sku)));
    let updated = 0;
    for (let index = 0; index < ids.length; index += 10) {
      const chunk = ids.slice(index, index + 10);
      const response = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", {
        method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", "x-marketplace": AMAZON_MARKETPLACE },
        body: JSON.stringify({ itemIds: chunk, itemIdType: "ASIN", marketplace: AMAZON_MARKETPLACE, partnerTag, resources: ["offersV2.listings.price", "offersV2.listings.availability"] }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`Amazon Creators API: ${data.errors?.[0]?.message || `HTTP ${response.status}`}`);
      const byAsin = new Map((data.itemsResult?.items || []).map((item: any) => [item.asin, item]));
      for (const product of products.products.nodes) {
        const variant = product.variants.nodes[0]; const item: any = variant?.sku ? byAsin.get(variant.sku) : null;
        if (!variant || !item) continue;
        const listing = item.offersV2?.listings?.[0];
        const amount = Number(listing?.price?.money?.amount);
        if (Number.isFinite(amount) && amount >= 0) {
          const result = await shopify<{ productVariantsBulkUpdate: { userErrors: { message: string }[] } }>(`mutation UpdateAutoStorePrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { message } } }`, { productId: product.id, variants: [{ id: variant.id, price: amount.toFixed(2) }] });
          if (result.productVariantsBulkUpdate.userErrors.length) throw new Error(result.productVariantsBulkUpdate.userErrors[0].message);
        }
        const availability = String(listing?.availability?.type || "UNKNOWN");
        const meta = await shopify<{ metafieldsSet: { userErrors: { message: string }[] } }>(`mutation RefreshAvailability($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`, { metafields: [{ ownerId: product.id, namespace: "omni_auto_store", key: "amazon_availability", type: "single_line_text_field", value: availability }] });
        if (meta.metafieldsSet.userErrors.length) throw new Error(meta.metafieldsSet.userErrors[0].message);
        updated++;
      }
    }
    return NextResponse.json({ updated, syncedAt: new Date().toISOString() });
  } catch (error) { return NextResponse.json({ error: safeError(error) }, { status: 500 }); }
}

let tokenCache: { value: string; expiresAt: number } | undefined;
async function token() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const response = await fetch("https://api.amazon.co.uk/auth/o2/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "client_credentials", client_id: process.env.AMAZON_CREATOR_API_CLIENT_ID, client_secret: process.env.AMAZON_CREATOR_API_CLIENT_SECRET, scope: "creatorsapi::default" }), cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Amazon OAuth: ${data.error_description || data.error || `HTTP ${response.status}`}`);
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
  return tokenCache.value;
}
