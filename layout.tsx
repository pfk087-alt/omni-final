import type { Metadata } from "next";
import "./globals.css";
import "./office.css";

export const metadata: Metadata = {
  title: "Passerelle — Selección de hogar",
  description: "Una selección de hogar con precios y disponibilidad consultados en Amazon.fr.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
