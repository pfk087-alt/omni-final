export const AMAZON_AFFILIATE_TAG = "kevinpatane20-21";

function decodeRepeatedly(value: string) {
  let decoded = value.trim();
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded.replace(/\+/g, "%20"));
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function cleanSearchTerm(value: string) {
  let cleaned = decodeRepeatedly(value);
  const trackingParameter = cleaned.search(/(?:tag|linkCode|ref_|ascsubtag|asc_source|ar_[a-z]+|creatorsDisableRedirect)(?:=|%3d)/i);
  if (trackingParameter >= 0) cleaned = cleaned.slice(0, trackingParameter);
  return cleaned
    .replace(/[.…?&#\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonicalizes any Amazon link as a plain Amazon.es link with our fixed tag. */
export function cleanAmazonLink(input: string) {
  const decoded = decodeRepeatedly(input);
  let parsed: URL | undefined;
  try {
    parsed = new URL(decoded.startsWith("http") ? decoded : `https://${decoded}`);
  } catch {
    parsed = undefined;
  }

  if (parsed && !/(^|\.)amazon\.(?:es|fr|de|it|nl|se|pl|com|co\.uk)$/i.test(parsed.hostname)) {
    return buildSearch(cleanSearchTerm(decoded));
  }

  const pathname = parsed?.pathname || "";
  const asin = pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase();
  if (asin) return `https://www.amazon.es/dp/${asin}?tag=${AMAZON_AFFILIATE_TAG}`;

  const query = parsed?.searchParams.get("k") || parsed?.searchParams.get("field-keywords");
  if (query) return buildSearch(cleanSearchTerm(query));

  const slug = pathname.split("/").filter(Boolean).slice(-1)[0] || decoded;
  return buildSearch(cleanSearchTerm(slug.replace(/[-_]+/g, " ")));
}

function buildSearch(query: string) {
  const term = cleanSearchTerm(query) || "hogar";
  return `https://www.amazon.es/s?k=${encodeURIComponent(term).replace(/%20/g, "+")}&tag=${AMAZON_AFFILIATE_TAG}`;
}
