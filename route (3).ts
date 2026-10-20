import { NextResponse } from "next/server";
import { rewriteInFrench, safeError, saveShopAffiliateId, searchAmazonBestSellers, shopify, type AmazonItem } from "@/app/lib/auto-store";
import { writeHomeProducts } from "@/app/lib/home-products";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const CREATE_PRODUCT = `mutation CreateProduct($product: ProductCreateInput!) { productCreate(product: $product) { product { id title variants(first: 1) { nodes { id } } } userErrors { message } } }`;
const SET_METAFIELDS = `mutation SetProductFields($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`;
const homeSearches = [
  { category: "COCINA", terms: ["freidora de aire", "robot de cocina"] },
  { category: "LIMPIEZA", terms: ["aspiradora escoba", "aspiradora sin cable"] },
  { category: "CAFÉ", terms: ["cafetera espresso", "cafetera automática"] },
];

async function discoverRatedProducts(partnerTag: string) {
  if (!partnerTag || partnerTag === "AMAZON_AFFILIATE_TAG") throw new Error("Configura AMAZON_AFFILIATE_TAG en Vercel.");
  const groups = await Promise.all(homeSearches.map(async ({ category, terms }) => {
    const items = await searchAmazonBestSellers(partnerTag, 20, terms);
    return items
      .filter((item) => item.rating !== null && item.rating > 4.4 && item.imageUrl && item.price !== null)
      .map((item) => ({ ...item, category }));
  }));
  const unique = new Map<string, AmazonItem & { category: string }>();
  for (const product of groups.flat()) if (!unique.has(product.asin)) unique.set(product.asin, product);
  const products = Array.from(unique.values()).sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)).slice(0, 20);
  if (!products.length) throw new Error("Amazon no devolvió productos con nota numérica verificable superior a 4,4. No se guardaron datos sin verificar.");
  await writeHomeProducts(products);
  return products;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const partnerTag = process.env.AMAZON_AFFILIATE_TAG?.trim() || "";
    const products = await discoverRatedProducts(partnerTag);
    console.info(`[OMNI import] Guardados ${products.length} productos Amazon con nota > 4,4 en el catálogo de home.`);
    return NextResponse.json({ ok: true, count: products.length, products: products.map(({ asin, title, category, rating }) => ({ asin, title, category, rating })) });
  } catch (error) {
    console.error("[OMNI import cron]", error);
    return NextResponse.json({ error: safeError(error) }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const partnerTag = String(body.affiliateId || process.env.AMAZON_AFFILIATE_TAG || "").trim();
    if (!partnerTag || partnerTag === "AMAZON_AFFILIATE_TAG") throw new Error("Configura un ID de afiliado real antes de importar productos.");
    await saveShopAffiliateId(partnerTag);
    const found = await discoverRatedProducts(partnerTag);
    const rewritten = await rewriteInFrench(found);
    const existing = await shopify<{ products: { nodes: { variants: { nodes: { sku: string | null }[] } }[] } }>(
      `query ExistingAutoStore { products(first: 250, query: "tag:omni-auto-store") { nodes { variants(first: 1) { nodes { sku } } } } }`,
    );
    const asins = new Set(existing.products.nodes.flatMap((p) => p.variants.nodes.map((v) => v.sku).filter((sku): sku is string => Boolean(sku))));
    let imported = 0; let skipped = 0; const errors: string[] = [];
    for (const product of rewritten) {
      if (asins.has(product.asin)) { skipped++; continue; }
      try {
        const created = await shopify<{ productCreate: { product: { id: string; variants: { nodes: { id: string }[] } } | null; userErrors: { message: string }[] } }>(CREATE_PRODUCT, {
          product: { title: product.seoTitle, descriptionHtml: product.descriptionHtml, vendor: "OMNI Auto Store", productType: "Sélection Amazon", status: "DRAFT", tags: ["omni-auto-store", `asin-${product.asin}`] },
        });
        if (created.productCreate.userErrors.length || !created.productCreate.product) throw new Error(created.productCreate.userErrors[0]?.message || "Shopify no creó el producto.");
        const id = created.productCreate.product.id;
        const variant = created.productCreate.product.variants.nodes[0];
        if (variant && product.price !== null) {
          const priceUpdate = await shopify<{ productVariantsBulkUpdate: { userErrors: { message: string }[] } }>(
            `mutation SetVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { message } } }`,
            { productId: id, variants: [{ id: variant.id, price: product.price.toFixed(2), inventoryItem: { sku: product.asin } }] },
          );
          if (priceUpdate.productVariantsBulkUpdate.userErrors.length) throw new Error(priceUpdate.productVariantsBulkUpdate.userErrors[0].message);
        }
        const meta = await shopify<{ metafieldsSet: { userErrors: { message: string }[] } }>(SET_METAFIELDS, { metafields: [
          { ownerId: id, namespace: "omni_auto_store", key: "amazon_url", type: "url", value: product.affiliateUrl },
          { ownerId: id, namespace: "omni_auto_store", key: "asin", type: "single_line_text_field", value: product.asin },
          { ownerId: id, namespace: "omni_auto_store", key: "affiliate_id", type: "single_line_text_field", value: partnerTag },
          { ownerId: id, namespace: "omni_auto_store", key: "amazon_availability", type: "single_line_text_field", value: product.availability },
          ...(product.imageUrl ? [{ ownerId: id, namespace: "omni_auto_store", key: "amazon_image_url", type: "url", value: product.imageUrl }] : []),
        ] });
        if (meta.metafieldsSet.userErrors.length) throw new Error(meta.metafieldsSet.userErrors[0].message);
        imported++;
      } catch (error) { errors.push(`${product.asin}: ${safeError(error)}`); }
    }
    if (rewritten.every((product) => asins.has(product.asin))) await saveShopAffiliateId(partnerTag);
    return NextResponse.json({ found: found.length, imported, skipped, errors, note: "Productos creados como borradores de Shopify para revisión antes de publicar." });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 502 });
  }
}
