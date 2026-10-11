"use client";

import { ExternalLink, ImagePlus, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CategoryTree } from "@/lib/categories";
import { getColorHex } from "@/lib/colors";
import { fileToPhoto } from "@/lib/image-client";
import type { Product } from "@/types/product";
import { api, errorMessage } from "./api";
import { hasPhoto } from "./types";
import { Button, CategorySelect, Field, IconButton, inputClass, money, useFeedback } from "./ui";

export type EditorDraft = { mode: "new" | "edit"; product: Product };

type ColorRow = { key: number; value: string; stock: string; price: string };
type Form = {
  name: string;
  description: string;
  category: string;
  price: string;
  discountPrice: string;
  cost: string;
  stock: string;
  image: string;
  withColors: boolean;
  colors: ColorRow[];
};

const text = (value: number | undefined) => (value ? String(value) : "");
const number = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
};

function toForm(product: Product): Form {
  const sale = product.discountPrice ?? product.price;
  const colors = (product.attributes?.[0]?.values ?? []).map((item, index) => ({
    key: index,
    value: item.value,
    stock: String(item.stock),
    // Solo se muestra el precio del color cuando es distinto al del producto.
    price: item.price && item.price !== sale ? String(item.price) : "",
  }));
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    price: text(product.price),
    discountPrice: text(product.discountPrice),
    cost: text(product.cost),
    stock: String(product.stock),
    image: product.image,
    withColors: colors.length > 0,
    colors,
  };
}

type Props = {
  draft: EditorDraft;
  tree: CategoryTree;
  colorSuggestions: string[];
  onClose: () => void;
  onSaved: (product: Product) => void;
  onRemoved: (id: string) => void;
  onError: (error: unknown) => void;
};

export default function ProductEditor({ draft, tree, colorSuggestions, onClose, onSaved, onRemoved, onError }: Props) {
  const { toast, confirm } = useFeedback();
  const isNew = draft.mode === "new";
  const initial = useMemo(() => toForm(draft.product), [draft.product]);
  const [form, setForm] = useState<Form>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const nextKey = useRef(1000);
  const titleId = useId();
  const colorListId = useId();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  const requestClose = async () => {
    if (saving) return;
    if (dirty && !(await confirm({ title: "Salir sin guardar", message: "Hiciste cambios que todavía no guardaste. ¿Querés descartarlos?", confirmLabel: "Descartar cambios", danger: true }))) return;
    onClose();
  };
  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      // El Escape de un diálogo que esté encima no debe cerrar el editor.
      if (event.key === "Escape" && !document.querySelector("[aria-modal='true']:not([data-editor])")) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLInputElement>("input[name='name']")?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // --- Foto ---
  const applyPhoto = async (file: Blob | undefined | null) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      set("image", await fileToPhoto(file));
      setShowLink(false);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      applyPhoto(file);
    }
  };

  // --- Colores ---
  const addColor = () => {
    const key = nextKey.current++;
    setForm((current) => ({ ...current, colors: [...current.colors, { key, value: "", stock: "0", price: "" }] }));
    window.setTimeout(() => panelRef.current?.querySelector<HTMLInputElement>(`[data-color='${key}']`)?.focus(), 0);
  };
  const updateColor = (key: number, patch: Partial<ColorRow>) =>
    setForm((current) => ({ ...current, colors: current.colors.map((row) => (row.key === key ? { ...row, ...patch } : row)) }));
  const removeColor = (key: number) => setForm((current) => ({ ...current, colors: current.colors.filter((row) => row.key !== key) }));
  const toggleColors = (enabled: boolean) => {
    setForm((current) => ({
      ...current,
      withColors: enabled,
      colors: enabled && current.colors.length === 0 ? [{ key: nextKey.current++, value: "", stock: current.stock || "0", price: "" }] : current.colors,
    }));
  };

  const price = number(form.price);
  const discount = form.discountPrice.trim() === "" ? 0 : number(form.discountPrice);
  const cost = form.cost.trim() === "" ? 0 : number(form.cost);
  const sale = discount > 0 ? discount : price;
  const colorTotal = form.colors.reduce((sum, row) => sum + (Math.max(0, Math.floor(number(row.stock))) || 0), 0);

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!form.name.trim()) found.name = "Escribí el nombre del producto.";
    if (form.price.trim() === "" || !Number.isFinite(price) || price < 0) found.price = "Escribí el precio.";
    if (!Number.isFinite(discount) || discount < 0) found.discountPrice = "El precio de oferta no es válido.";
    else if (discount > 0 && Number.isFinite(price) && discount >= price) found.discountPrice = "Tiene que ser menor que el precio.";
    if (!Number.isFinite(cost) || cost < 0) found.cost = "El costo no es válido.";
    if (form.withColors) {
      const names = form.colors.map((row) => row.value.trim().toLowerCase());
      if (form.colors.length === 0) found.colors = "Agregá al menos un color o desactivá los colores.";
      else if (names.some((name) => !name)) found.colors = "Hay un color sin nombre.";
      else if (new Set(names).size !== names.length) found.colors = "Hay colores repetidos.";
      else if (form.colors.some((row) => !Number.isFinite(number(row.stock)) || number(row.stock) < 0)) found.colors = "Revisá el stock de los colores.";
      else if (form.colors.some((row) => row.price.trim() !== "" && (!Number.isFinite(number(row.price)) || number(row.price) < 0))) found.colors = "Revisá el precio de los colores.";
    } else if (form.stock.trim() === "" || !Number.isFinite(number(form.stock)) || number(form.stock) < 0) {
      found.stock = "Escribí el stock (puede ser 0).";
    }
    return found;
  };

  // Después del primer intento de guardar, los errores se actualizan al escribir.
  const errors = submitted ? validate() : {};

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setSubmitted(true);
    if (Object.keys(found).length > 0) {
      toast("Revisá los campos marcados.", "error");
      window.setTimeout(() => panelRef.current?.querySelector("[role='alert']")?.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ product: Product }>(`/api/products/${encodeURIComponent(draft.product.id)}`, {
        method: "PUT",
        body: {
          name: form.name,
          description: form.description,
          category: form.category,
          price,
          discountPrice: discount > 0 ? discount : null,
          cost,
          stock: form.withColors ? colorTotal : Math.floor(number(form.stock)),
          image: form.image,
          attributes: form.withColors
            ? [{ name: "Color", values: form.colors.map((row) => ({ value: row.value.trim(), stock: Math.floor(number(row.stock)), price: row.price.trim() === "" ? 0 : number(row.price) })) }]
            : [],
        },
      });
      onSaved(data.product);
      toast(isNew ? "Producto creado." : "Cambios guardados.");
      onClose();
    } catch (error) {
      onError(error);
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: "Eliminar producto", message: <>Vas a eliminar <strong>{draft.product.name}</strong>. No se puede deshacer.</>, confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    setSaving(true);
    try {
      await api(`/api/products/${encodeURIComponent(draft.product.id)}`, { method: "DELETE" });
      onRemoved(draft.product.id);
      toast("Producto eliminado.");
      onClose();
    } catch (error) {
      onError(error);
      setSaving(false);
    }
  };

  const section = "rounded-xl border border-[#dfe4ee] bg-white p-4 sm:p-5";
  const sectionTitle = "text-[15px] font-bold";
  const photo = hasPhoto({ image: form.image } as Product);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={requestClose} className="animate-fade-in absolute inset-0 cursor-default bg-[#0f172a]/50" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-editor
        aria-labelledby={titleId}
        onPaste={onPaste}
        className="animate-drawer-right relative flex h-full w-full max-w-[760px] flex-col bg-[#f4f6fb] shadow-panel"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#dfe4ee] bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-bold">
              {isNew ? "Nuevo producto" : form.name || "Editar producto"}
            </h2>
            {!isNew && (
              <a href={`/producto/${encodeURIComponent(draft.product.id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
                Ver en la tienda <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
          <IconButton label="Cerrar" onClick={requestClose}>
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        </div>

        <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {/* Foto */}
            <section className={section}>
              <h3 className={sectionTitle}>Foto</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-[168px_minmax(0,1fr)]">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    applyPhoto(Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/")));
                  }}
                  className={`relative mx-auto aspect-[3/4] w-full max-w-[168px] overflow-hidden rounded-lg border-2 border-dashed bg-[#f8f9fc] transition-colors duration-150 ${
                    dragging ? "border-brand bg-[#eef3fb]" : "border-[#cdd5e3]"
                  }`}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image} alt="Foto actual del producto" className="absolute inset-0 size-full object-contain" />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-[13px] text-[#6b7280]">
                      <ImagePlus className="size-7 text-brand" strokeWidth={1.5} aria-hidden="true" />
                      Arrastrá la foto acá
                    </span>
                  )}
                  {photoBusy && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/80" role="status" aria-label="Procesando la foto">
                      <Loader2 className="size-6 animate-spin text-brand" aria-hidden="true" />
                    </span>
                  )}
                </div>

                <div className="flex flex-col justify-center gap-3">
                  <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => { applyPhoto(event.target.files?.[0]); event.target.value = ""; }} />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                      <ImagePlus className="size-4" aria-hidden="true" /> {photo ? "Cambiar foto" : "Elegir foto"}
                    </Button>
                    {photo && (
                      <Button variant="ghost" onClick={() => set("image", "")}>
                        <Trash2 className="size-4" aria-hidden="true" /> Quitar
                      </Button>
                    )}
                  </div>
                  <p className="text-[13px] leading-relaxed text-[#6b7280]">
                    Podés arrastrarla, elegirla desde el celular o la compu, o pegarla con Ctrl+V. Se achica sola para que la tienda cargue rápido.
                  </p>
                  {showLink ? (
                    <Field label="Enlace de la foto">
                      <input className={inputClass} type="url" inputMode="url" placeholder="https://…" value={form.image.startsWith("http") ? form.image : ""} onChange={(event) => set("image", event.target.value.trim())} />
                    </Field>
                  ) : (
                    <button type="button" onClick={() => setShowLink(true)} className="inline-flex min-h-9 items-center gap-1.5 self-start text-[13px] font-semibold text-brand hover:underline">
                      <Link2 className="size-3.5" aria-hidden="true" /> Usar un enlace
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Datos */}
            <section className={section}>
              <h3 className={sectionTitle}>Datos del producto</h3>
              <div className="mt-3 space-y-4">
                <Field label="Nombre" error={errors.name}>
                  <input name="name" className={inputClass} maxLength={255} value={form.name} onChange={(event) => set("name", event.target.value)} aria-invalid={!!errors.name} />
                </Field>
                <Field label="Categoría">
                  <CategorySelect tree={tree} value={form.category} onChange={(category) => set("category", category)} />
                </Field>
                <Field label="Descripción (opcional)">
                  <textarea className={`${inputClass} py-2.5`} rows={3} maxLength={5000} value={form.description} onChange={(event) => set("description", event.target.value)} />
                </Field>
              </div>
            </section>

            {/* Precio */}
            <section className={section}>
              <h3 className={sectionTitle}>Precio</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="Precio ($)" error={errors.price}>
                  <input className={inputClass} type="number" min={0} step="any" inputMode="decimal" value={form.price} onChange={(event) => set("price", event.target.value)} aria-invalid={!!errors.price} />
                </Field>
                <Field label="Precio de oferta ($)" hint={errors.discountPrice ? undefined : "Opcional. El precio normal se muestra tachado."} error={errors.discountPrice}>
                  <input className={inputClass} type="number" min={0} step="any" inputMode="decimal" value={form.discountPrice} onChange={(event) => set("discountPrice", event.target.value)} aria-invalid={!!errors.discountPrice} />
                </Field>
                <Field label="Costo ($)" hint={errors.cost ? undefined : "Solo lo ves vos."} error={errors.cost}>
                  <input className={inputClass} type="number" min={0} step="any" inputMode="decimal" value={form.cost} onChange={(event) => set("cost", event.target.value)} aria-invalid={!!errors.cost} />
                </Field>
              </div>
              {cost > 0 && sale > 0 && (
                <p className="mt-3 text-sm text-[#374151]">
                  Ganancia por unidad: <strong className={sale - cost >= 0 ? "text-[#166534]" : "text-[#b3261e]"}>{money(sale - cost)}</strong> ({Math.round(((sale - cost) / sale) * 100)}% del precio)
                </p>
              )}
            </section>

            {/* Stock y colores */}
            <section className={section}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className={sectionTitle}>Stock</h3>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={form.withColors} onChange={(event) => toggleColors(event.target.checked)} className="size-[18px] accent-[#446cb3]" />
                  Este producto viene en varios colores
                </label>
              </div>

              {!form.withColors ? (
                <Field label="Unidades disponibles" error={errors.stock} className="mt-3 max-w-[200px]">
                  <input className={inputClass} type="number" min={0} step={1} inputMode="numeric" value={form.stock} onChange={(event) => set("stock", event.target.value)} aria-invalid={!!errors.stock} />
                </Field>
              ) : (
                <div className="mt-3">
                  <datalist id={colorListId}>
                    {colorSuggestions.map((color) => (
                      <option key={color} value={color} />
                    ))}
                  </datalist>
                  <div className="hidden grid-cols-[minmax(0,1fr)_96px_128px_40px] gap-2 px-1 pb-1.5 text-xs font-bold uppercase tracking-wide text-[#4b5563] sm:grid">
                    <span>Color</span>
                    <span>Stock</span>
                    <span>Precio distinto</span>
                    <span className="sr-only">Quitar</span>
                  </div>
                  <ul className="space-y-2">
                    {form.colors.map((row, index) => (
                      <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_72px_40px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_96px_128px_40px]">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 rounded-full border border-black/15" style={{ backgroundColor: row.value.trim() ? getColorHex(row.value) : "#ffffff" }} aria-hidden="true" />
                          <input
                            data-color={row.key}
                            list={colorListId}
                            aria-label={`Nombre del color ${index + 1}`}
                            placeholder="Ej: Rosa"
                            maxLength={60}
                            value={row.value}
                            onChange={(event) => updateColor(row.key, { value: event.target.value })}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                if (index === form.colors.length - 1) addColor();
                              }
                            }}
                            className={`${inputClass} pl-9`}
                          />
                        </div>
                        <input aria-label={`Stock de ${row.value || `color ${index + 1}`}`} type="number" min={0} step={1} inputMode="numeric" value={row.stock} onChange={(event) => updateColor(row.key, { stock: event.target.value })} className={`${inputClass} text-right`} />
                        <label className="col-span-2 flex items-center gap-2 sm:col-span-1">
                          <span className="shrink-0 text-[13px] text-[#6b7280] sm:hidden">Precio distinto</span>
                          <input
                            aria-label={`Precio de ${row.value || `color ${index + 1}`} (vacío: igual al producto)`}
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            placeholder={Number.isFinite(sale) && sale > 0 ? String(sale) : "Igual"}
                            value={row.price}
                            onChange={(event) => updateColor(row.key, { price: event.target.value })}
                            className={`${inputClass} text-right`}
                          />
                        </label>
                        <IconButton label={`Quitar ${row.value || `color ${index + 1}`}`} onClick={() => removeColor(row.key)} className="row-start-1 col-start-3 sm:row-auto sm:col-auto">
                          <Trash2 className="size-[18px]" aria-hidden="true" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                  {errors.colors && (
                    <p className="mt-2 text-[13px] font-medium text-[#b3261e]" role="alert">
                      {errors.colors}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Button size="sm" onClick={addColor}>
                      <Plus className="size-4" aria-hidden="true" /> Agregar color
                    </Button>
                    <p className="text-sm text-[#374151]">
                      Stock total: <strong className="tabular-nums">{colorTotal}</strong>
                    </p>
                  </div>
                  <p className="mt-2 text-[13px] text-[#6b7280]">Dejá vacío “Precio distinto” si el color vale lo mismo que el producto.</p>
                </div>
              )}
            </section>

            <p className="px-1 text-[13px] text-[#6b7280]">Código del producto: {draft.product.id}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#dfe4ee] bg-white px-4 py-3 sm:px-6">
            {!isNew && (
              <Button variant="ghost" onClick={remove} disabled={saving} aria-label="Eliminar producto" className="mr-auto !px-3 !text-[#b3261e] hover:!bg-[#fdecea]">
                <Trash2 className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Eliminar</span>
              </Button>
            )}
            <Button onClick={requestClose} disabled={saving} className={isNew ? "ml-auto" : ""}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={photoBusy}>
              {isNew ? "Crear producto" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
