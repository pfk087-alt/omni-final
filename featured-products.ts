import { cleanAmazonLink } from "@/lib/cleanAmazonLink";

export type FeaturedProduct = {
  id: string;
  title: string;
  brand: string;
  category: string;
  imageUrl: string;
  affiliateUrl: string;
  asin?: string;
  price?: number | null;
  currency?: string;
  rating?: number | null;
  availability?: string;
};

export function amazonSearchUrl(query: string, tag?: string) {
  void tag;
  return cleanAmazonLink(`https://www.amazon.es/s?k=${encodeURIComponent(query)}`);
}

export function amazonProductUrl(asin: string, tag?: string) {
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error("ASIN no válido.");
  void tag;
  return cleanAmazonLink(`https://www.amazon.es/dp/${asin}`);
}

const amazonSearch = (query: string) => amazonSearchUrl(query);

export const FEATURED_PRODUCTS: FeaturedProduct[] = [
  {
    id: "moulinex-easy-fry",
    brand: "Moulinex",
    category: "COCINA",
    title: "Freidora de aire Moulinex Easy Fry Max",
    imageUrl: "https://cdn.auchan.fr/media/A0220231208000364275PRIMARY_2048x2048/B2CD/",
    affiliateUrl: amazonSearch("Moulinex Easy Fry"),
  },
  {
    id: "dyson-v15",
    brand: "Dyson",
    category: "LIMPIEZA",
    title: "Aspiradora Dyson V15 Detect Absolute",
    imageUrl: "https://m.media-amazon.com/images/I/61LsOhLYNTL.jpg",
    affiliateUrl: amazonSearch("Dyson V15"),
  },
  {
    id: "delonghi-magnifica-s",
    brand: "De’Longhi",
    category: "CAFÉ",
    title: "Cafetera superautomática De’Longhi Magnifica S",
    imageUrl: "https://dam.delonghi.com/902x902/assets/223655",
    affiliateUrl: amazonSearch("DeLonghi Magnifica S"),
  },
];

