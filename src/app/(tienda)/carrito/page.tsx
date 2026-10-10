"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { formatPrice } from "@/lib/site";
import { useHydrated } from "@/lib/useHydrated";
import { useCartStore } from "@/store/cartStore";

export default function CartPage() {
  const hydrated = useHydrated();
  const { items, updateQuantity, removeItem, getTotalPrice, getTotalItems } = useCartStore();

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;

  return (
    <section className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <h1 className="section-title">Mi carrito</h1>

      {items.length === 0 ? (
        <div className="mx-auto mt-8 max-w-md bg-white px-6 py-12 text-center shadow-card">
          <ShoppingBag className="mx-auto size-10 text-brand" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-4 font-serif text-xl font-medium text-ink-soft">Tu carrito está vacío</p>
          <p className="mt-2 text-[15px] text-muted">Sumá productos para armar tu pedido.</p>
          <Link href="/productos" className="btn-serif mt-6">
            Ver productos
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
          <ul className="divide-y divide-line bg-white px-4 shadow-card sm:px-6">
            {items.map((item) => (
              <li key={`${item.id}-${item.selectedColor || ""}`} className="grid grid-cols-[72px_1fr] gap-x-4 gap-y-3 py-5 sm:grid-cols-[88px_1fr_auto] sm:items-center">
                <Link href={`/producto/${encodeURIComponent(item.id)}`} className="relative block aspect-[3/4] bg-page" tabIndex={-1} aria-hidden="true">
                  <ProductImage src={item.image} alt="" sizes="88px" />
                </Link>
                <div className="min-w-0">
                  <Link href={`/producto/${encodeURIComponent(item.id)}`} className="font-serif text-lg font-medium leading-tight text-ink-soft hover:underline">
                    {item.name}
                  </Link>
                  {item.selectedColor && <p className="mt-1 text-sm text-muted">Color: {item.selectedColor}</p>}
                  <p className="mt-1.5 text-[15px] font-bold">{formatPrice(item.price)}</p>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                  <div className="flex items-center rounded-[20px] border border-ink" role="group" aria-label={`Cantidad de ${item.name}`}>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedColor)}
                      disabled={item.quantity <= 1}
                      className="flex size-11 items-center justify-center disabled:opacity-30"
                      aria-label="Restar uno"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <span className="w-7 text-center text-[15px] font-bold" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedColor)}
                      disabled={item.quantity >= item.stock}
                      className="flex size-11 items-center justify-center disabled:opacity-30"
                      aria-label="Sumar uno"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="min-w-24 text-right text-[15px] font-bold sm:hidden">{formatPrice(item.price * item.quantity)}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id, item.selectedColor)}
                    className="flex size-11 items-center justify-center text-muted hover:text-[#b3261e]"
                    aria-label={`Quitar ${item.name} del carrito`}
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <aside className="bg-white p-6 shadow-card lg:sticky lg:top-32" aria-label="Resumen del pedido">
            <h2 className="font-serif text-xl font-bold">Resumen</h2>
            <dl className="mt-5 space-y-3 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt>
                  Productos ({getTotalItems()})
                </dt>
                <dd className="font-bold">{formatPrice(getTotalPrice())}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Envío</dt>
                <dd className="text-right text-ink-soft">Según la forma de retiro</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-4">
                <dt className="font-bold">Total</dt>
                <dd className="text-2xl font-bold">{formatPrice(getTotalPrice())}</dd>
              </div>
            </dl>
            <Link href="/checkout" className="btn-serif mt-6 w-full">
              Iniciar compra
            </Link>
            <Link href="/productos" className="mt-4 block text-center text-[15px] font-medium text-brand underline">
              Seguir comprando
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
