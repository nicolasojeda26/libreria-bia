import { getProducts as getDbProducts } from '@/lib/db';
import { getProducts as getSheetProducts } from '@/lib/google-sheets';
import { normalizeKey, resolveCategory, type ResolvedCategory } from '@/lib/categories';
import type { Product, ProductCardData } from '@/types/product';

export const PAGE_SIZE = 24;

function byNewest(a: Product, b: Product): number {
  // Los códigos son correlativos: el más alto es el producto más nuevo.
  const idA = Number(a.id);
  const idB = Number(b.id);
  if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) return idB - idA;
  return a.name.localeCompare(b.name);
}

/** Todos los productos de la tienda, del más nuevo al más viejo. */
export async function getStoreProducts(): Promise<Product[]> {
  let products = await getDbProducts();
  if (products.length === 0) products = await getSheetProducts();
  return [...products].sort(byNewest);
}

export function hasVariants(product: Product): boolean {
  return (product.attributes ?? []).some((attr) => attr.values.length > 0);
}

export function toCardData(product: Product): ProductCardData {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    discountPrice: product.discountPrice,
    stock: product.stock,
    image: product.image,
    hasVariants: hasVariants(product),
  };
}

export function filterByCategory(products: Product[], category: ResolvedCategory): Product[] {
  return products.filter((product) => {
    const resolved = resolveCategory(product.category);
    if (!resolved || resolved.parent.slug !== category.parent.slug) return false;
    return category.child ? resolved.child?.slug === category.child.slug : true;
  });
}

export function searchProducts(products: Product[], query: string): Product[] {
  const words = normalizeKey(query).split(' ').filter(Boolean);
  if (words.length === 0) return products;
  return products.filter((product) => {
    const haystack = normalizeKey(`${product.name} ${product.category} ${product.description}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Cantidad de productos a mostrar según el parámetro ?ver= de la URL. */
export function visibleCount(raw: string | string[] | undefined, total: number): number {
  const requested = parseInt(Array.isArray(raw) ? raw[0] : raw ?? '', 10);
  const count = Number.isFinite(requested) && requested > 0 ? requested : PAGE_SIZE;
  return Math.min(count, total);
}
