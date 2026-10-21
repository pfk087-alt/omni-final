import type { Metadata } from "next";

export const metadata: Metadata = { title: "Facturación verificada | Passerelle", robots: { index: false, follow: false } };

export default function BillingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
