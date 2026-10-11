import AnnouncementBar from "@/components/AnnouncementBar";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { getCategoryTree } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const categories = await getCategoryTree();

  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        Ir al contenido
      </a>
      <AnnouncementBar />
      <Header categories={categories} />
      <main id="contenido">{children}</main>
      <Footer categories={categories} />
      <WhatsAppFloat />
    </>
  );
}
