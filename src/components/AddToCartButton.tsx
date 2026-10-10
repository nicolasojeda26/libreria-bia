"use client";

import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { getColorHex } from "@/lib/colors";
import { formatPrice } from "@/lib/site";
import { useCartStore } from "@/store/cartStore";
import type { PublicProduct } from "@/types/product";

export default function AddToCartButton({ product }: { product: PublicProduct }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [needsColor, setNeedsColor] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const colorAttr = product.attributes?.find((attr) => attr.name.toLowerCase() === "color" && attr.values.length > 0);
  const selectedVariant = selectedColor && colorAttr ? colorAttr.values.find((item) => item.value === selectedColor) : null;

  const price = selectedVariant?.price || (product.discountPrice ?? product.price);
  const stock = selectedVariant?.stock ?? product.stock;

  if (product.stock <= 0) {
    return (
      <p className="btn-outline w-full cursor-default" role="status">
        Sin stock
      </p>
    );
  }

  const handleAddToCart = () => {
    if (colorAttr && !selectedColor) {
      setNeedsColor(true);
      return;
    }
    addItem({ id: product.id, name: product.name, price, image: product.image, stock, quantity, selectedColor: selectedColor || undefined });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="flex w-full flex-col gap-5">
      {colorAttr && (
        <fieldset>
          <legend className="text-[15px] font-bold">
            Color: <span className="font-normal">{selectedColor ?? "elegí uno"}</span>
          </legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {colorAttr.values.map((item) => {
              const isSelected = selectedColor === item.value;
              const unavailable = item.stock <= 0;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={unavailable}
                  onClick={() => {
                    setSelectedColor(item.value);
                    setQuantity(1);
                    setNeedsColor(false);
                  }}
                  className={`flex min-h-11 items-center gap-2 rounded-[20px] border px-3.5 text-sm font-medium transition-colors duration-150 ${
                    isSelected
                      ? "border-brand bg-brand text-white"
                      : unavailable
                        ? "cursor-not-allowed border-line bg-page text-[#8a8a8a] line-through"
                        : "border-[#bdbdbd] bg-white text-ink hover:border-brand"
                  }`}
                >
                  <span className="size-4 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: getColorHex(item.value) }} aria-hidden="true" />
                  {item.value}
                </button>
              );
            })}
          </div>
          {needsColor && (
            <p className="mt-2 text-sm font-medium text-[#b3261e]" role="alert">
              Elegí un color para agregarlo al carrito.
            </p>
          )}
        </fieldset>
      )}

      {selectedVariant && selectedVariant.price > 0 && selectedVariant.price !== (product.discountPrice ?? product.price) && (
        <p className="text-[15px]">
          Precio de este color: <strong>{formatPrice(selectedVariant.price)}</strong>
        </p>
      )}

      <div className="flex items-center gap-4">
        <span className="text-[15px] font-bold" id="cantidad-label">
          Cantidad
        </span>
        <div className="flex items-center rounded-[20px] border border-ink bg-white" role="group" aria-labelledby="cantidad-label">
          <button type="button" aria-label="Restar uno" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} className="flex size-11 items-center justify-center disabled:opacity-30">
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="w-8 text-center text-base font-bold" aria-live="polite">
            {quantity}
          </span>
          <button type="button" aria-label="Sumar uno" onClick={() => setQuantity(Math.min(stock, quantity + 1))} disabled={quantity >= stock} className="flex size-11 items-center justify-center disabled:opacity-30">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button type="button" onClick={handleAddToCart} className="btn-pill w-full !min-h-[50px] !text-[0.9rem]">
        {added ? (
          <>
            <Check className="size-4" aria-hidden="true" /> Agregado al carrito
          </>
        ) : (
          "Agregar al carrito"
        )}
      </button>

      {added && (
        <Link href="/carrito" className="animate-fade-in text-center text-[15px] font-bold text-brand underline">
          Ver carrito y finalizar compra
        </Link>
      )}
    </div>
  );
}
