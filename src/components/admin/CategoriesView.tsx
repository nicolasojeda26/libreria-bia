"use client";

import { Check, ChevronDown, ChevronUp, CornerDownRight, FolderPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_NAME_MAX, resolveCategory, type CategoryTree } from "@/lib/categories";
import type { Product } from "@/types/product";
import { api } from "./api";
import { Button, Card, IconButton, inputClass, useFeedback } from "./ui";

type Props = {
  tree: CategoryTree;
  products: Product[];
  onTreeChange: (tree: CategoryTree) => void;
  onShowProducts: (category: string) => void;
  onReload: () => Promise<void>;
  onError: (error: unknown) => void;
};

type Editing = { kind: "rename-parent"; parent: string } | { kind: "rename-child"; parent: string; child: string } | { kind: "new-parent" } | { kind: "new-child"; parent: string };

function NameForm({ initial, label, placeholder, onSubmit, onCancel }: { initial: string; label: string; placeholder: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <input
        autoFocus
        aria-label={label}
        placeholder={placeholder}
        maxLength={CATEGORY_NAME_MAX}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
        className={`${inputClass} !min-h-10`}
      />
      <IconButton label="Guardar" type="submit" disabled={!name.trim()} className="!text-brand">
        <Check className="size-5" aria-hidden="true" />
      </IconButton>
      <IconButton label="Cancelar" onClick={onCancel}>
        <X className="size-5" aria-hidden="true" />
      </IconButton>
    </form>
  );
}

export default function CategoriesView({ tree, products, onTreeChange, onShowProducts, onReload, onError }: Props) {
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    let none = 0;
    for (const product of products) {
      const resolved = resolveCategory(tree, product.category);
      if (!resolved) {
        none++;
        continue;
      }
      map.set(resolved.parent.slug, (map.get(resolved.parent.slug) ?? 0) + 1);
      if (resolved.child) {
        const key = `${resolved.parent.slug}/${resolved.child.slug}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return { map, none };
  }, [products, tree]);

  const save = async (next: CategoryTree, done: string) => {
    setSaving(true);
    try {
      const data = await api<{ tree: CategoryTree }>("/api/categories", { method: "PUT", body: { tree: next } });
      onTreeChange(data.tree);
      // Los productos muestran el nombre nuevo de su categoría.
      await onReload();
      setEditing(null);
      toast(done);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  const move = <T,>(list: T[], index: number, delta: number): T[] => {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const removeParent = async (slug: string) => {
    const parent = tree.find((node) => node.slug === slug)!;
    const total = counts.map.get(slug) ?? 0;
    if (total > 0) {
      toast(`“${parent.name}” tiene ${total} ${total === 1 ? "producto" : "productos"}. Movelos a otra categoría antes de eliminarla.`, "error");
      return;
    }
    const extra = parent.children.length > 0 ? ` y sus ${parent.children.length} subcategorías` : "";
    if (await confirm({ title: "Eliminar categoría", message: <>Vas a eliminar <strong>{parent.name}</strong>{extra}. Desaparece del menú de la tienda.</>, confirmLabel: "Eliminar", danger: true })) {
      await save(tree.filter((node) => node.slug !== slug), "Categoría eliminada.");
    }
  };

  const removeChild = async (parentSlug: string, childSlug: string) => {
    const parent = tree.find((node) => node.slug === parentSlug)!;
    const child = parent.children.find((node) => node.slug === childSlug)!;
    const total = counts.map.get(`${parentSlug}/${childSlug}`) ?? 0;
    if (total > 0) {
      toast(`“${child.name}” tiene ${total} ${total === 1 ? "producto" : "productos"}. Movelos a otra categoría antes de eliminarla.`, "error");
      return;
    }
    if (await confirm({ title: "Eliminar subcategoría", message: <>Vas a eliminar <strong>{child.name}</strong> de {parent.name}.</>, confirmLabel: "Eliminar", danger: true })) {
      await save(tree.map((node) => (node.slug === parentSlug ? { ...node, children: node.children.filter((item) => item.slug !== childSlug) } : node)), "Subcategoría eliminada.");
    }
  };

  const countButton = (key: string, category: string, name: string) => {
    const total = counts.map.get(key) ?? 0;
    return (
      <button
        type="button"
        onClick={() => onShowProducts(category)}
        disabled={total === 0}
        aria-label={`Ver los ${total} productos de ${name}`}
        className="min-h-9 shrink-0 rounded-full bg-[#eef1f7] px-3 text-[13px] font-semibold tabular-nums text-[#374151] enabled:hover:bg-brand enabled:hover:text-white disabled:text-[#9aa3b2]"
      >
        {total}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categorías</h1>
          <p className="mt-1 max-w-xl text-[15px] text-[#4b5563]">Es el menú “Artículos” de la tienda, en este mismo orden. Los cambios se publican al instante.</p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ kind: "new-parent" })} disabled={saving}>
          <FolderPlus className="size-4" aria-hidden="true" /> Nueva categoría
        </Button>
      </div>

      {counts.none > 0 && (
        <p className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#78350f]">
          Hay {counts.none} {counts.none === 1 ? "producto" : "productos"} sin categoría: {counts.none === 1 ? "aparece" : "aparecen"} en “Todos los productos” y en el buscador, pero no en el menú.{" "}
          <button type="button" onClick={() => onShowProducts("__sin__")} className="font-semibold underline">
            Verlos
          </button>
        </p>
      )}

      {editing?.kind === "new-parent" && (
        <Card className="flex items-center gap-2 p-3">
          <NameForm initial="" label="Nombre de la nueva categoría" placeholder="Nombre de la nueva categoría" onCancel={() => setEditing(null)} onSubmit={(name) => save([...tree, { name, slug: "", children: [] }], "Categoría creada.")} />
        </Card>
      )}

      {tree.length === 0 ? (
        <Card className="px-5 py-12 text-center">
          <p className="text-base font-semibold">No hay categorías</p>
          <p className="mt-1 text-[15px] text-[#4b5563]">Creá la primera para armar el menú de la tienda.</p>
        </Card>
      ) : (
        <ul className={`space-y-3 ${saving ? "pointer-events-none opacity-60" : ""}`} aria-busy={saving}>
          {tree.map((parent, index) => (
            <li key={parent.slug}>
              <Card className="overflow-hidden">
                <div className="flex min-h-14 flex-wrap items-center gap-x-2 px-3 py-2 sm:flex-nowrap sm:px-4">
                  {editing?.kind === "rename-parent" && editing.parent === parent.slug ? (
                    <NameForm
                      initial={parent.name}
                      label={`Nuevo nombre de ${parent.name}`}
                      placeholder="Nombre de la categoría"
                      onCancel={() => setEditing(null)}
                      onSubmit={(name) => (name === parent.name ? setEditing(null) : save(tree.map((node) => (node.slug === parent.slug ? { ...node, name } : node)), "Nombre actualizado."))}
                    />
                  ) : (
                    <>
                      <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{parent.name}</p>
                      {countButton(parent.slug, parent.name, parent.name)}
                      {/* En celular las acciones bajan a una segunda línea para no cortar el nombre */}
                      <div className="flex w-full shrink-0 justify-end sm:w-auto">
                        <IconButton label={`Renombrar ${parent.name}`} onClick={() => setEditing({ kind: "rename-parent", parent: parent.slug })}>
                          <Pencil className="size-[18px]" aria-hidden="true" />
                        </IconButton>
                        <IconButton label={`Subir ${parent.name}`} disabled={index === 0} onClick={() => save(move(tree, index, -1), "Orden actualizado.")}>
                          <ChevronUp className="size-5" aria-hidden="true" />
                        </IconButton>
                        <IconButton label={`Bajar ${parent.name}`} disabled={index === tree.length - 1} onClick={() => save(move(tree, index, 1), "Orden actualizado.")}>
                          <ChevronDown className="size-5" aria-hidden="true" />
                        </IconButton>
                        <IconButton label={`Eliminar ${parent.name}`} onClick={() => removeParent(parent.slug)} className="hover:!text-[#b3261e]">
                          <Trash2 className="size-[18px]" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </>
                  )}
                </div>

                <ul className="border-t border-[#eef1f7] bg-[#fafbfd]">
                  {parent.children.map((child, childIndex) => (
                    <li key={child.slug} className="flex min-h-12 flex-wrap items-center gap-x-2 border-b border-[#eef1f7] py-1 pl-4 pr-3 sm:flex-nowrap sm:pl-6 sm:pr-4">
                      <CornerDownRight className="size-4 shrink-0 text-[#9aa3b2]" aria-hidden="true" />
                      {editing?.kind === "rename-child" && editing.parent === parent.slug && editing.child === child.slug ? (
                        <NameForm
                          initial={child.name}
                          label={`Nuevo nombre de ${child.name}`}
                          placeholder="Nombre de la subcategoría"
                          onCancel={() => setEditing(null)}
                          onSubmit={(name) =>
                            name === child.name
                              ? setEditing(null)
                              : save(tree.map((node) => (node.slug === parent.slug ? { ...node, children: node.children.map((item) => (item.slug === child.slug ? { ...item, name } : item)) } : node)), "Nombre actualizado.")
                          }
                        />
                      ) : (
                        <>
                          <p className="min-w-0 flex-1 truncate text-[15px]">{child.name}</p>
                          {countButton(`${parent.slug}/${child.slug}`, `${parent.name} > ${child.name}`, child.name)}
                          <div className="flex w-full shrink-0 justify-end sm:w-auto">
                            <IconButton label={`Renombrar ${child.name}`} onClick={() => setEditing({ kind: "rename-child", parent: parent.slug, child: child.slug })}>
                              <Pencil className="size-[18px]" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label={`Subir ${child.name}`}
                              disabled={childIndex === 0}
                              onClick={() => save(tree.map((node) => (node.slug === parent.slug ? { ...node, children: move(node.children, childIndex, -1) } : node)), "Orden actualizado.")}
                            >
                              <ChevronUp className="size-5" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label={`Bajar ${child.name}`}
                              disabled={childIndex === parent.children.length - 1}
                              onClick={() => save(tree.map((node) => (node.slug === parent.slug ? { ...node, children: move(node.children, childIndex, 1) } : node)), "Orden actualizado.")}
                            >
                              <ChevronDown className="size-5" aria-hidden="true" />
                            </IconButton>
                            <IconButton label={`Eliminar ${child.name}`} onClick={() => removeChild(parent.slug, child.slug)} className="hover:!text-[#b3261e]">
                              <Trash2 className="size-[18px]" aria-hidden="true" />
                            </IconButton>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  <li className="flex min-h-12 items-center gap-2 py-1 pl-4 pr-3 sm:pl-6 sm:pr-4">
                    {editing?.kind === "new-child" && editing.parent === parent.slug ? (
                      <>
                        <CornerDownRight className="size-4 shrink-0 text-[#9aa3b2]" aria-hidden="true" />
                        <NameForm
                          initial=""
                          label={`Nueva subcategoría de ${parent.name}`}
                          placeholder="Nombre de la subcategoría"
                          onCancel={() => setEditing(null)}
                          onSubmit={(name) => save(tree.map((node) => (node.slug === parent.slug ? { ...node, children: [...node.children, { name, slug: "" }] } : node)), "Subcategoría creada.")}
                        />
                      </>
                    ) : (
                      <button type="button" onClick={() => setEditing({ kind: "new-child", parent: parent.slug })} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-brand hover:bg-[#eef1f7]">
                        <Plus className="size-4" aria-hidden="true" /> Agregar subcategoría
                      </button>
                    )}
                  </li>
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
