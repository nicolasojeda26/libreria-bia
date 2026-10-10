"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useHydrated } from "@/lib/useHydrated";
import { useCartStore } from "@/store/cartStore";

export default function CartIcon() {
  // El carrito vive en localStorage: recién se muestra el número ya hidratado.
  const hydrated = useHydrated();
  const totalItems = useCartStore((state) => state.getTotalItems());
  const count = hydrated ? totalItems : 0;

  return (
    <Link
      href="/carrito"
      aria-label={count > 0 ? `Ver carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Ver carrito"}
      className="relative flex size-11 items-center justify-center text-ink"
    >
      <ShoppingBag className="size-6" strokeWidth={1.75} aria-hidden="true" />
      <span className="absolute right-0 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
        {count}
      </span>
    </Link>
  );
}
