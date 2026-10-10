import type { Metadata } from "next";
import { Literata, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["300", "400", "500", "700"], display: "swap" });
const literata = Literata({ variable: "--font-literata", subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tienda online de Librería Bia",
    template: "%s | Librería Bia",
  },
  description: "Esta es la tienda online de Librería Bia. Ingresá y conocé nuestra amplia variedad de productos.",
  openGraph: {
    title: "Tienda online de Librería Bia",
    description: "Esta es la tienda online de Librería Bia. Ingresá y conocé nuestra amplia variedad de productos.",
    images: ["/logo.jpg"],
    type: "website",
    locale: "es_AR",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${poppins.variable} ${literata.variable} antialiased`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
