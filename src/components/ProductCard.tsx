"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";
import ProductImage from "./ProductImage";
import { formatPrice } from "@/lib/site";
import { useCartStore } from "@/store/cartStore";
import type { ProductCardData } from "@/types/product";

export default function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);
  const price = product.discountPrice ?? product.price;
  const hasDiscount = product.discountPrice != null;
  const outOfStock = product.stock <= 0;
  const href = `/producto/${encodeURIComponent(product.id)}`;

  const handleBuy = () => {
    addItem({ id: product.id, name: product.name, price, image: product.image, stock: product.stock, quantity: 1 });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  // Los productos con colores se compran desde el detalle, donde se elige el color.
  const buyButton = outOfStock ? null : product.hasVariants ? (
    <Link href={href} className="btn-pill w-full">
      Comprar
    </Link>
  ) : (
    <button type="button" onClick={handleBuy} className="btn-pill w-full" aria-live="polite">
      {added ? (
        <>
          <Check className="size-4" aria-hidden="true" /> Agregado
        </>
      ) : (
        "Comprar"
      )}
    </button>
  );

  return (
    <article className="polaroid">
      <div className="relative p-2.5">
        <Link href={href} className="relative block aspect-[3/4]" aria-label={product.name} tabIndex={-1}>
          <ProductImage src={product.image} alt={product.name} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" priority={priority} />
        </Link>
        {outOfStock && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-base font-medium text-muted">
            SIN STOCK
          </span>
        )}
        <div className="polaroid-overlay">
          {buyButton}
          <Link href={href} className="btn-pill w-full">
            Ver detalle
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2 pb-3.5 text-center">
        <h3 className="font-serif text-[1.02rem] font-medium leading-[1.12] tracking-[-0.01em] text-ink-soft sm:text-[1.3rem]">
          <Link href={href}>{product.name}</Link>
        </h3>
        <p className="mt-1.5 flex flex-wrap items-baseline justify-center gap-x-2 text-[1.02rem] font-bold leading-none text-ink-soft sm:text-[1.3rem]">
          {hasDiscount && <s className="text-[0.8em] font-normal text-muted">{formatPrice(product.price)}</s>}
          <span>{formatPrice(price)}</span>
        </p>
        <div className="polaroid-touch-actions mt-auto pt-3">
          {buyButton ?? (
            <Link href={href} className="btn-outline w-full !min-h-[44px] !px-3 !text-[0.8rem]">
              Ver detalle
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
