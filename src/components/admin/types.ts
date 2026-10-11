import type { CategoryTree } from "@/lib/categories";
import { normalizeKey, resolveCategory } from "@/lib/categories";
import type { Product } from "@/types/product";

export type Section = "inicio" | "productos" | "categorias" | "tienda" | "cuenta";
export const SECTIONS: Section[] = ["inicio", "productos", "categorias", "tienda", "cuenta"];

export type StatusFilter = "todos" | "con-stock" | "sin-stock" | "stock-bajo" | "oferta" | "sin-foto" | "sin-categoria";
export type SortKey = "nuevos" | "nombre" | "precio-menor" | "precio-mayor" | "stock-menor";

export type ProductFilter = { search: string; category: string; status: StatusFilter; sort: SortKey };
export const EMPTY_FILTER: ProductFilter = { search: "", category: "", status: "todos", sort: "nuevos" };

export const LOW_STOCK = 3;

export const STATUS_LABELS: Record<StatusFilter, string> = {
  todos: "Todos",
  "con-stock": "Con stock",
  "sin-stock": "Sin stock",
  "stock-bajo": "Stock bajo",
  oferta: "En oferta",
  "sin-foto": "Sin foto",
  "sin-categoria": "Sin categoría",
};

export const hasPhoto = (product: Product) => !!product.image && !product.image.includes("via.placeholder.com");
export const hasColors = (product: Product) => (product.attributes?.[0]?.values.length ?? 0) > 0;

export function matchesStatus(product: Product, status: StatusFilter, tree: CategoryTree): boolean {
  switch (status) {
    case "con-stock":
      return product.stock > 0;
    case "sin-stock":
      return product.stock <= 0;
    case "stock-bajo":
      return product.stock > 0 && product.stock <= LOW_STOCK;
    case "oferta":
      return product.discountPrice != null;
    case "sin-foto":
      return !hasPhoto(product);
    case "sin-categoria":
      return !resolveCategory(tree, product.category);
    default:
      return true;
  }
}

/** `category` es el nombre de una categoría ("Escritura") o de una subcategoría ("Escritura > Marcadores"). */
export function matchesCategory(product: Product, category: string, tree: CategoryTree): boolean {
  if (!category) return true;
  const wanted = resolveCategory(tree, category);
  const actual = resolveCategory(tree, product.category);
  if (!wanted || !actual) return false;
  if (wanted.parent.slug !== actual.parent.slug) return false;
  return wanted.child ? actual.child?.slug === wanted.child.slug : true;
}

export function filterProducts(products: Product[], filter: ProductFilter, tree: CategoryTree): Product[] {
  const words = normalizeKey(filter.search).split(" ").filter(Boolean);
  const result = products.filter((product) => {
    if (!matchesStatus(product, filter.status, tree)) return false;
    if (!matchesCategory(product, filter.category, tree)) return false;
    if (words.length === 0) return true;
    const haystack = normalizeKey(`${product.name} ${product.id} ${product.category}`);
    return words.every((word) => haystack.includes(word));
  });

  const byNewest = (a: Product, b: Product) => {
    const idA = Number(a.id);
    const idB = Number(b.id);
    if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) return idB - idA;
    return a.name.localeCompare(b.name);
  };
  const sale = (product: Product) => product.discountPrice ?? product.price;

  switch (filter.sort) {
    case "nombre":
      return result.sort((a, b) => a.name.localeCompare(b.name));
    case "precio-menor":
      return result.sort((a, b) => sale(a) - sale(b));
    case "precio-mayor":
      return result.sort((a, b) => sale(b) - sale(a));
    case "stock-menor":
      return result.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
    default:
      return result.sort(byNewest);
  }
}
