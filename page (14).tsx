import AffiliateStore from "./storefront";

export const dynamic = "force-dynamic";

export default function Home() {
  return <AffiliateStore affiliateTag={process.env.AMAZON_AFFILIATE_TAG?.trim() || "AMAZON_AFFILIATE_TAG"} />;
}
