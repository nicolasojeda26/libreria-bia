import PickupInfo from "@/components/PickupInfo";
import ProductGrid from "@/components/ProductGrid";
import { getStoreProducts, toCardData } from "@/lib/store";

const HOME_PRODUCTS = 12;

export default async function Home() {
  const products = await getStoreProducts();
  const featured = products.slice(0, HOME_PRODUCTS).map(toCardData);

  return (
    <>
      <h1 className="sr-only">Librería Bia</h1>
      <section aria-labelledby="todos-los-productos" className="mx-auto max-w-[1340px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <h2 id="todos-los-productos" className="section-title mb-7">
          Todos los productos
        </h2>
        {featured.length === 0 ? (
          <p className="py-16 text-center text-muted">No hay productos disponibles por el momento.</p>
        ) : (
          <ProductGrid products={featured} moreHref={products.length > HOME_PRODUCTS ? "/productos" : undefined} keepScroll={false} />
        )}
      </section>
      <PickupInfo />
    </>
  );
}
