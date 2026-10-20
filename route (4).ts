import { NextResponse } from "next/server";
import { safeError, shopify } from "@/app/lib/auto-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const query = `query AutoStoreStatus { products(first: 250, query: "tag:omni-auto-store", sortKey: CREATED_AT) { nodes { id createdAt metafield(namespace: "omni_auto_store", key: "enabled") { value } } } }`;
    const data = await shopify<{ products: { nodes: { id: string; createdAt: string; metafield: { value: string } | null }[] } }>(query);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const today = data.products.nodes.filter((product) => new Date(product.createdAt) >= dayStart).length;
    return NextResponse.json({ connected: true, enabled: data.products.nodes[0]?.metafield?.value === "true", importedToday: today, totalProducts: data.products.nodes.length, revenueToday: null });
  } catch (error) {
    const message = safeError(error);
    return NextResponse.json({ connected: false, enabled: false, importedToday: 0, totalProducts: 0, revenueToday: null, error: message }, { status: 503 });
  }
}
