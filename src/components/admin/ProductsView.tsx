"use client";

import { ChevronLeft, ChevronRight, Copy, Download, FileSpreadsheet, FolderInput, Palette, Pencil, Percent, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import ProductImage from "@/components/ProductImage";
import { CATEGORY_SEPARATOR, type CategoryTree } from "@/lib/categories";
import type { Product } from "@/types/product";
import { api, bulk } from "./api";
import { EMPTY_FILTER, STATUS_LABELS, filterProducts, hasColors, type ProductFilter, type SortKey, type StatusFilter } from "./types";
import { Button, CategorySelect, Field, IconButton, Modal, inputClass, money, useFeedback } from "./ui";

const PER_PAGE = 25;
const STATUSES = Object.keys(STATUS_LABELS) as StatusFilter[];
const SORTS: { value: SortKey; label: string }[] = [
  { value: "nuevos", label: "Más nuevos primero" },
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "precio-menor", label: "Precio: menor a mayor" },
  { value: "precio-mayor", label: "Precio: mayor a menor" },
  { value: "stock-menor", label: "Menos stock primero" },
];

type Props = {
  products: Product[];
  tree: CategoryTree;
  filter: ProductFilter;
  onFilterChange: (filter: ProductFilter) => void;
  onNew: () => void;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onImport: () => void;
  onExport: () => void;
  onSaved: (product: Product) => void;
  onRemoved: (ids: string[]) => void;
  onReload: () => Promise<void>;
  onError: (error: unknown) => void;
};

/** Número que se edita en el lugar: clic, escribir, Enter. */
function QuickNumber({ value, label, display, disabled, onSave }: { value: number; label: string; display: string; disabled?: boolean; onSave: (value: number) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const committing = useRef(false);

  const commit = async () => {
    if (committing.current || draft === null) return;
    const next = Number(draft.replace(",", "."));
    if (draft.trim() === "" || !Number.isFinite(next) || next < 0 || next === value) {
      setDraft(null);
      return;
    }
    committing.current = true;
    setSaving(true);
    try {
      await onSave(next);
    } finally {
      committing.current = false;
      setSaving(false);
      setDraft(null);
    }
  };

  if (draft !== null) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        disabled={saving}
        onFocus={(event) => event.target.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
        className="h-10 w-full min-w-0 rounded-lg border border-brand bg-white px-2 text-right text-[15px] font-semibold tabular-nums outline-none ring-[3px] ring-brand/20"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${display}. Tocar para editar`}
      onClick={() => setDraft(String(value))}
      className="h-10 w-full min-w-0 rounded-lg border border-transparent px-2 text-right text-[15px] font-semibold tabular-nums transition-colors duration-150 hover:border-[#cdd5e3] hover:bg-white disabled:cursor-not-allowed disabled:hover:border-transparent disabled:hover:bg-transparent"
    >
      {display}
    </button>
  );
}

export default function ProductsView({ products, tree, filter, onFilterChange, onNew, onEdit, onDuplicate, onImport, onExport, onSaved, onRemoved, onReload, onError }: Props) {
  const { toast, confirm } = useFeedback();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"category" | "price" | null>(null);
  const [working, setWorking] = useState("");

  const filtered = useMemo(() => filterProducts(products, filter, tree), [products, filter, tree]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Solo cuentan los seleccionados que siguen a la vista con el filtro actual.
  const selectedIds = useMemo(() => filtered.filter((product) => selected.has(product.id)).map((product) => product.id), [filtered, selected]);
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const isFiltered = filter.search !== "" || filter.category !== "" || filter.status !== "todos";

  const setFilter = (patch: Partial<ProductFilter>) => {
    onFilterChange({ ...filter, ...patch });
    setPage(1);
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((product) => product.id)));

  const patch = async (product: Product, body: Record<string, unknown>, done: string) => {
    try {
      const data = await api<{ product: Product }>(`/api/products/${encodeURIComponent(product.id)}`, { method: "PATCH", body });
      onSaved(data.product);
      toast(done);
    } catch (error) {
      onError(error);
    }
  };

  const remove = async (product: Product) => {
    const ok = await confirm({ title: "Eliminar producto", message: <>Vas a eliminar <strong>{product.name}</strong>. No se puede deshacer.</>, confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    try {
      await api(`/api/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      onRemoved([product.id]);
      toast("Producto eliminado.");
    } catch (error) {
      onError(error);
    }
  };

  const runBulk = async (payload: Record<string, unknown>, verb: string, doneText: string) => {
    const ids = selectedIds;
    setDialog(null);
    setWorking(`${verb} 0 de ${ids.length}…`);
    try {
      await bulk(ids, payload, (done, total) => setWorking(`${verb} ${done} de ${total}…`));
      await onReload();
      setSelected(new Set());
      toast(doneText);
    } catch (error) {
      await onReload().catch(() => {});
      onError(error);
    } finally {
      setWorking("");
    }
  };

  const removeSelected = async () => {
    const count = selectedIds.length;
    const ok = await confirm({
      title: "Eliminar productos",
      message: <>Vas a eliminar <strong>{count} {count === 1 ? "producto" : "productos"}</strong>. No se puede deshacer.</>,
      confirmLabel: `Eliminar ${count}`,
      danger: true,
    });
    if (ok) await runBulk({ action: "delete" }, "Eliminando", count === 1 ? "Producto eliminado." : `${count} productos eliminados.`);
  };

  const grid = "grid grid-cols-[28px_52px_minmax(0,1fr)] md:grid-cols-[28px_52px_minmax(0,1fr)_minmax(0,220px)_112px_104px_124px] items-center gap-x-3";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onExport} disabled={products.length === 0}>
            <Download className="size-4" aria-hidden="true" /> Exportar
          </Button>
          <Button onClick={onImport}>
            <FileSpreadsheet className="size-4" aria-hidden="true" /> Importar Excel
          </Button>
          <Button variant="primary" onClick={onNew}>
            <Plus className="size-4" aria-hidden="true" /> Nuevo producto
          </Button>
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="space-y-3 rounded-xl border border-[#dfe4ee] bg-white p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar por nombre o código"
              placeholder="Buscar por nombre o código"
              value={filter.search}
              onChange={(event) => setFilter({ search: event.target.value })}
              className={`${inputClass} pl-9`}
            />
          </div>
          <CategorySelect tree={tree} value={filter.category} onChange={(category) => setFilter({ category })} emptyLabel="Todas las categorías" />
          <select aria-label="Ordenar" value={filter.sort} onChange={(event) => setFilter({ sort: event.target.value as SortKey })} className={inputClass}>
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </div>
        <div className="hide-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por estado">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter.status === status}
              onClick={() => setFilter({ status })}
              className={`min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                filter.status === status ? "border-brand bg-brand text-white" : "border-[#cdd5e3] bg-white text-[#374151] hover:border-brand"
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm text-[#4b5563]">
        <p aria-live="polite">
          {filtered.length === products.length ? `${products.length} productos` : `${filtered.length} de ${products.length} productos`}
          {isFiltered && (
            <button type="button" onClick={() => { onFilterChange({ ...EMPTY_FILTER, sort: filter.sort }); setPage(1); }} className="ml-3 font-semibold text-brand underline">
              Quitar filtros
            </button>
          )}
        </p>
        <p className="hidden text-[13px] md:block">Tocá un precio o un stock para cambiarlo ahí mismo.</p>
      </div>

      {/* Listado */}
      <div className="overflow-hidden rounded-xl border border-[#dfe4ee] bg-white">
        <div className={`${grid} border-b border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-[#4b5563] sm:px-4`}>
          <input type="checkbox" aria-label="Seleccionar todos los productos del listado" checked={allSelected} onChange={toggleAll} disabled={filtered.length === 0} className="size-[18px] accent-[#446cb3]" />
          <span className="col-span-2">Producto</span>
          <span className="hidden md:block">Categoría</span>
          <span className="hidden text-right md:block">Precio</span>
          <span className="hidden text-right md:block">Stock</span>
          <span className="sr-only">Acciones</span>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-base font-semibold">{products.length === 0 ? "Todavía no cargaste productos" : "Ningún producto coincide con la búsqueda"}</p>
            <p className="mt-1 text-[15px] text-[#4b5563]">{products.length === 0 ? "Creá el primero o importá tu catálogo desde un Excel." : "Probá con otra palabra o quitá los filtros."}</p>
            {products.length === 0 && (
              <Button variant="primary" onClick={onNew} className="mt-5">
                <Plus className="size-4" aria-hidden="true" /> Nuevo producto
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[#eef1f7]">
            {visible.map((product) => {
              const colors = hasColors(product);
              const sale = product.discountPrice ?? product.price;
              const [category, subcategory] = product.category.split(CATEGORY_SEPARATOR);
              return (
                <li key={product.id} className={`${grid} px-3 py-2.5 sm:px-4 ${selected.has(product.id) ? "bg-[#eef3fb]" : ""}`}>
                  <input type="checkbox" aria-label={`Seleccionar ${product.name}`} checked={selected.has(product.id)} onChange={() => toggle(product.id)} className="size-[18px] accent-[#446cb3]" />
                  <button type="button" onClick={() => onEdit(product)} tabIndex={-1} aria-hidden="true" className="relative size-[52px] overflow-hidden rounded-lg border border-[#e5e9f2] bg-[#f8f9fc]">
                    <ProductImage src={product.image} alt="" className="object-cover" />
                  </button>
                  <div className="min-w-0">
                    <button type="button" onClick={() => onEdit(product)} className="block max-w-full truncate text-left text-[15px] font-semibold hover:text-brand hover:underline">
                      {product.name}
                    </button>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[#6b7280]">
                      <span className="truncate md:hidden">{product.category || "Sin categoría"}</span>
                      <span className="hidden md:inline">Cód. {product.id}</span>
                      {product.discountPrice != null && <span className="rounded bg-[#dcfce7] px-1.5 font-semibold text-[#166534]">Oferta</span>}
                      {colors && (
                        <span className="inline-flex items-center gap-1">
                          <Palette className="size-3.5" aria-hidden="true" />
                          {product.attributes![0].values.length} colores
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="hidden min-w-0 text-sm leading-snug text-[#374151] md:block">
                    {product.category ? (
                      <>
                        <span className="block truncate">{subcategory || category}</span>
                        {subcategory && <span className="block truncate text-[13px] text-[#6b7280]">{category}</span>}
                      </>
                    ) : (
                      <span className="text-[#b45309]">Sin categoría</span>
                    )}
                  </p>

                  {/* En celular, precio, stock y acciones van en una segunda línea */}
                  <div className="col-span-3 mt-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2 md:col-span-3 md:mt-0 md:grid-cols-[112px_104px_124px] md:gap-x-3">
                    <div className="min-w-0">
                      <span className="mb-0.5 block px-2 text-right text-[11px] font-semibold uppercase text-[#6b7280] md:hidden">Precio</span>
                      <QuickNumber
                        value={sale}
                        label={`Precio de ${product.name}`}
                        display={money(sale)}
                        onSave={(value) => patch(product, product.discountPrice != null ? { discountPrice: value } : { price: value }, "Precio actualizado.")}
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="mb-0.5 block px-2 text-right text-[11px] font-semibold uppercase text-[#6b7280] md:hidden">Stock</span>
                      {colors ? (
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          aria-label={`Stock de ${product.name}: ${product.stock}. Se edita por color`}
                          title="El stock se edita color por color"
                          className={`h-10 w-full rounded-lg px-2 text-right text-[15px] font-semibold tabular-nums hover:bg-white ${product.stock <= 0 ? "text-[#b3261e]" : ""}`}
                        >
                          {product.stock}
                        </button>
                      ) : (
                        <div className={product.stock <= 0 ? "text-[#b3261e]" : ""}>
                          <QuickNumber value={product.stock} label={`Stock de ${product.name}`} display={String(product.stock)} onSave={(value) => patch(product, { stock: Math.floor(value) }, "Stock actualizado.")} />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <IconButton label={`Editar ${product.name}`} onClick={() => onEdit(product)}>
                        <Pencil className="size-[18px]" aria-hidden="true" />
                      </IconButton>
                      <IconButton label={`Duplicar ${product.name}`} onClick={() => onDuplicate(product)}>
                        <Copy className="size-[18px]" aria-hidden="true" />
                      </IconButton>
                      <IconButton label={`Eliminar ${product.name}`} onClick={() => remove(product)} className="hover:!text-[#b3261e]">
                        <Trash2 className="size-[18px]" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2.5 sm:px-4">
            <span className="text-[13px] text-[#4b5563]">
              {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <IconButton label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="size-5" aria-hidden="true" />
              </IconButton>
              <span className="px-1 text-sm font-semibold tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <IconButton label="Página siguiente" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="size-5" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        )}
      </div>

      {/* Acciones sobre la selección */}
      {(selectedIds.length > 0 || working) && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-3 pb-3 lg:bottom-0 lg:left-60 lg:px-8 lg:pb-5" role="region" aria-label="Acciones sobre los productos seleccionados">
          <div className="animate-panel-in mx-auto flex max-w-[1116px] flex-wrap items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-white shadow-panel" style={{ transformOrigin: "bottom center" }}>
            {working ? (
              <p className="flex-1 text-sm font-semibold" role="status">
                {working}
              </p>
            ) : (
              <>
                <p className="mr-auto text-sm font-semibold">
                  {selectedIds.length} {selectedIds.length === 1 ? "seleccionado" : "seleccionados"}
                </p>
                <Button size="sm" onClick={() => setDialog("category")}>
                  <FolderInput className="size-4" aria-hidden="true" /> Cambiar categoría
                </Button>
                <Button size="sm" onClick={() => setDialog("price")}>
                  <Percent className="size-4" aria-hidden="true" /> Ajustar precios
                </Button>
                <Button size="sm" variant="danger" onClick={removeSelected}>
                  <Trash2 className="size-4" aria-hidden="true" /> Eliminar
                </Button>
                <IconButton label="Quitar la selección" onClick={() => setSelected(new Set())} className="!text-white hover:!bg-white/15">
                  <X className="size-5" aria-hidden="true" />
                </IconButton>
              </>
            )}
          </div>
        </div>
      )}

      {dialog === "category" && (
        <BulkCategoryDialog
          tree={tree}
          count={selectedIds.length}
          onClose={() => setDialog(null)}
          onApply={(category) => runBulk({ action: "category", category }, "Moviendo", `${selectedIds.length === 1 ? "Producto movido" : `${selectedIds.length} productos movidos`} a ${category || "Sin categoría"}.`)}
        />
      )}
      {dialog === "price" && (
        <BulkPriceDialog
          count={selectedIds.length}
          sample={filtered.find((product) => selected.has(product.id))}
          onClose={() => setDialog(null)}
          onApply={(percent, round) => runBulk({ action: "price", percent, round }, "Actualizando", "Precios actualizados.")}
        />
      )}
    </div>
  );
}

function BulkCategoryDialog({ tree, count, onClose, onApply }: { tree: CategoryTree; count: number; onClose: () => void; onApply: (category: string) => void }) {
  const [category, setCategory] = useState("");
  return (
    <Modal
      title="Cambiar categoría"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onApply(category)}>
            Mover {count} {count === 1 ? "producto" : "productos"}
          </Button>
        </>
      }
    >
      <Field label="Nueva categoría">
        <CategorySelect tree={tree} value={category} onChange={setCategory} />
      </Field>
    </Modal>
  );
}

function BulkPriceDialog({ count, sample, onClose, onApply }: { count: number; sample?: Product; onClose: () => void; onApply: (percent: number, round: number) => void }) {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [amount, setAmount] = useState("10");
  const [round, setRound] = useState(50);

  const value = Number(amount.replace(",", "."));
  const percent = direction === "up" ? value : -value;
  const valid = Number.isFinite(value) && value > 0 && (direction === "up" ? value <= 500 : value <= 90);
  const before = sample ? sample.discountPrice ?? sample.price : 0;
  const after = Math.max(0, round > 1 ? Math.round((before * (1 + percent / 100)) / round) * round : Math.round(before * (1 + percent / 100)));

  return (
    <Modal
      title="Ajustar precios"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onApply(percent, round)}>
            Aplicar a {count} {count === 1 ? "producto" : "productos"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de ajuste">
          {(["up", "down"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={direction === option}
              onClick={() => setDirection(option)}
              className={`min-h-11 rounded-lg border text-sm font-semibold ${direction === option ? "border-brand bg-brand text-white" : "border-[#cdd5e3] bg-white"}`}
            >
              {option === "up" ? "Aumentar" : "Bajar"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Porcentaje (%)" error={amount !== "" && !valid ? (direction === "up" ? "Entre 0 y 500" : "Entre 0 y 90") : undefined}>
            <input className={inputClass} type="number" min={0} step="any" inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Redondear a">
            <select className={inputClass} value={round} onChange={(event) => setRound(Number(event.target.value))}>
              <option value={1}>Sin redondeo</option>
              <option value={10}>$10</option>
              <option value={50}>$50</option>
              <option value={100}>$100</option>
            </select>
          </Field>
        </div>
        {sample && valid && (
          <p className="rounded-lg bg-[#f4f6fb] px-3 py-2.5 text-sm text-[#374151]">
            Por ejemplo, <strong>{sample.name}</strong> pasa de {money(before)} a <strong>{money(after)}</strong>.
          </p>
        )}
        <p className="text-[13px] text-[#6b7280]">También se ajustan los precios de oferta y los de cada color.</p>
      </div>
    </Modal>
  );
}
