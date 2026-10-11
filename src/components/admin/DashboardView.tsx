"use client";

import { ChevronRight, FileSpreadsheet, FolderTree, ImageOff, Megaphone, Package, PackageX, Plus, Tag, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import type { CategoryTree } from "@/lib/categories";
import type { Product } from "@/types/product";
import { LOW_STOCK, matchesStatus, type StatusFilter } from "./types";
import { Button, Card, money } from "./ui";

type Props = {
  user: string;
  products: Product[];
  tree: CategoryTree;
  notice: string;
  onFilter: (status: StatusFilter) => void;
  onNewProduct: () => void;
  onImport: () => void;
  onEditProduct: (product: Product) => void;
  onGoTo: (section: "categorias" | "tienda") => void;
};

export default function DashboardView({ user, products, tree, notice, onFilter, onNewProduct, onImport, onEditProduct, onGoTo }: Props) {
  const stats = useMemo(() => {
    const count = (status: StatusFilter) => products.filter((product) => matchesStatus(product, status, tree)).length;
    const units = products.reduce((sum, product) => sum + Math.max(0, product.stock), 0);
    const value = products.reduce((sum, product) => sum + (product.discountPrice ?? product.price) * Math.max(0, product.stock), 0);
    const capital = products.reduce((sum, product) => sum + product.cost * Math.max(0, product.stock), 0);
    const withCost = products.filter((product) => product.cost > 0).length;
    return {
      total: products.length,
      out: count("sin-stock"),
      low: count("stock-bajo"),
      sale: count("oferta"),
      noPhoto: count("sin-foto"),
      noCategory: count("sin-categoria"),
      units,
      value,
      capital,
      withCost,
    };
  }, [products, tree]);

  const lowStock = useMemo(
    () => products.filter((product) => product.stock > 0 && product.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)).slice(0, 8),
    [products],
  );

  const tiles: { status: StatusFilter; label: string; value: number; icon: typeof Package; alert?: boolean }[] = [
    { status: "todos", label: "Productos", value: stats.total, icon: Package },
    { status: "sin-stock", label: "Sin stock", value: stats.out, icon: PackageX, alert: stats.out > 0 },
    { status: "stock-bajo", label: `Stock bajo (${LOW_STOCK} o menos)`, value: stats.low, icon: TriangleAlert, alert: stats.low > 0 },
    { status: "oferta", label: "En oferta", value: stats.sale, icon: Tag },
    { status: "sin-foto", label: "Sin foto", value: stats.noPhoto, icon: ImageOff, alert: stats.noPhoto > 0 },
    { status: "sin-categoria", label: "Sin categoría", value: stats.noCategory, icon: FolderTree, alert: stats.noCategory > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hola, {user}</h1>
          <p className="mt-1 text-[15px] text-[#4b5563]">Así está tu tienda hoy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onImport}>
            <FileSpreadsheet className="size-4" aria-hidden="true" /> Importar Excel
          </Button>
          <Button variant="primary" onClick={onNewProduct}>
            <Plus className="size-4" aria-hidden="true" /> Nuevo producto
          </Button>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map(({ status, label, value, icon: Icon, alert }) => (
          <li key={status}>
            <button
              type="button"
              onClick={() => onFilter(status)}
              className="group flex h-full w-full flex-col rounded-xl border border-[#dfe4ee] bg-white p-4 text-left transition-colors duration-150 hover:border-brand"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[#4b5563]">
                <Icon className={`size-4 ${alert ? "text-[#b45309]" : "text-brand"}`} aria-hidden="true" />
                {label}
              </span>
              <span className="mt-1.5 flex items-end justify-between gap-2">
                <span className="text-3xl font-bold tabular-nums">{value}</span>
                <ChevronRight className="mb-1 size-5 text-[#9aa3b2] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
              </span>
              <span className="sr-only">Ver estos productos</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-bold">Valor del inventario</h2>
          <dl className="mt-4 space-y-3 text-[15px]">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[#4b5563]">Unidades en stock</dt>
              <dd className="font-bold tabular-nums">{stats.units.toLocaleString("es-AR")}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[#4b5563]">A precio de venta</dt>
              <dd className="text-xl font-bold tabular-nums">{money(stats.value)}</dd>
            </div>
            {stats.withCost > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#4b5563]">Costo de esa mercadería</dt>
                  <dd className="font-bold tabular-nums">{money(stats.capital)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-[#e5e9f2] pt-3">
                  <dt className="text-[#4b5563]">Ganancia estimada</dt>
                  <dd className="font-bold tabular-nums text-[#166534]">{money(stats.value - stats.capital)}</dd>
                </div>
                {stats.withCost < stats.total && (
                  <p className="text-[13px] text-[#6b7280]">
                    Solo {stats.withCost} de {stats.total} productos tienen el costo cargado; el resto cuenta como costo cero.
                  </p>
                )}
              </>
            ) : (
              <p className="border-t border-[#e5e9f2] pt-3 text-[13px] text-[#6b7280]">Cargá el costo en cada producto para ver acá la ganancia estimada.</p>
            )}
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Megaphone className="size-4 text-brand" aria-hidden="true" /> Aviso de la tienda
            </h2>
            <Button size="sm" onClick={() => onGoTo("tienda")}>
              {notice ? "Cambiar" : "Escribir aviso"}
            </Button>
          </div>
          {notice ? (
            <p className="mt-4 rounded-lg bg-rosa px-4 py-3 text-center text-sm font-bold">{notice}</p>
          ) : (
            <p className="mt-4 text-[15px] text-[#4b5563]">No hay ningún aviso publicado. Sirve para contar novedades del día, por ejemplo cuándo hacés entregas.</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-[#e5e9f2] px-5 py-3.5">
          <h2 className="text-base font-bold">Se están por terminar</h2>
          {stats.low > lowStock.length && (
            <Button size="sm" variant="ghost" onClick={() => onFilter("stock-bajo")}>
              Ver los {stats.low}
            </Button>
          )}
        </div>
        {lowStock.length === 0 ? (
          <p className="px-5 py-6 text-[15px] text-[#4b5563]">Ningún producto tiene stock bajo.</p>
        ) : (
          <ul className="divide-y divide-[#eef1f7]">
            {lowStock.map((product) => (
              <li key={product.id}>
                <button type="button" onClick={() => onEditProduct(product)} className="flex min-h-12 w-full items-center justify-between gap-4 px-5 py-2 text-left text-[15px] hover:bg-[#f8f9fc]">
                  <span className="min-w-0 truncate font-medium">{product.name}</span>
                  <span className="shrink-0 rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[13px] font-bold text-[#92400e]">
                    {product.stock === 1 ? "Queda 1" : `Quedan ${product.stock}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
