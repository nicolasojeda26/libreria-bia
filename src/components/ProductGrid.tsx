import Link from "next/link";
import ProductCard from "./ProductCard";
import type { ProductCardData } from "@/types/product";

type Props = {
  products: ProductCardData[];
  /** Destino del botón "Ver más"; si no se pasa, no se muestra. */
  moreHref?: string;
  /** false cuando "Ver más" lleva a otra página en vez de ampliar esta lista. */
  keepScroll?: boolean;
};

export default function ProductGrid({ products, moreHref, keepScroll = true }: Props) {
  return (
    <>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-10">
        {products.map((product, index) => (
          <li key={product.id}>
            <ProductCard product={product} priority={index < 4} />
          </li>
        ))}
      </ul>
      {moreHref && (
        <div className="mt-12 flex justify-center">
          <Link href={moreHref} scroll={!keepScroll} className="btn-serif">
            Ver más
          </Link>
        </div>
      )}
    </>
  );
}
