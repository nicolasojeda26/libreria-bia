import { isStoredImageUrl, normalizeAttributes } from '@/lib/db';
import { canonicalCategory, type CategoryTree } from '@/lib/categories';
import { parseFormattedNumber } from '@/lib/numbers';
import type { Product, ProductAttribute } from '@/types/product';

// Validación de lo que llega del panel antes de guardarlo.

export class InputError extends Error {}

const MAX_INLINE_IMAGE = 1_500_000; // caracteres de un data URL (~1,1 MB de foto)
const INLINE_IMAGE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/** `keep` indica que hay que conservar la foto que el producto ya tenía. */
export function parseImage(value: unknown): { image: string; keep: boolean } {
  const image = typeof value === 'string' ? value.trim() : '';
  if (!image || image.includes('via.placeholder.com')) return { image: '', keep: false };
  // Dirección de una foto ya guardada (relativa, o absoluta como sale en el Excel exportado).
  if (isStoredImageUrl(image) || /^https?:\/\/[^/]+\/api\/products\//i.test(image)) return { image: '', keep: true };
  if (image.startsWith('data:')) {
    if (image.length > MAX_INLINE_IMAGE) throw new InputError('La foto es demasiado pesada. Probá con una más chica.');
    if (!INLINE_IMAGE.test(image)) throw new InputError('El archivo no es una foto válida (JPG, PNG, WebP o GIF).');
    return { image, keep: false };
  }
  if (/^https?:\/\//i.test(image) && image.length <= 2000) return { image, keep: false };
  throw new InputError('El enlace de la foto no es válido.');
}

function money(value: unknown): number {
  return Math.max(0, Math.round(parseFormattedNumber(value) * 100) / 100);
}

/** Con variantes, el stock del producto es la suma y un precio vacío hereda el del producto. */
export function settleVariants(product: Product): Product {
  const attributes = product.attributes;
  if (!attributes || attributes.length === 0) return { ...product, attributes: undefined };
  const settled: ProductAttribute[] = attributes.map((attr) => ({
    name: attr.name,
    values: attr.values.map((item) => ({ ...item, price: item.price > 0 ? item.price : product.discountPrice ?? product.price })),
  }));
  const stock = settled[0].values.reduce((sum, item) => sum + item.stock, 0);
  return { ...product, attributes: settled, stock };
}

/** Arma un producto completo a partir del formulario del panel. */
export function buildProduct(id: string, raw: Record<string, unknown>, tree: CategoryTree, existing: Product | null): Product {
  const name = String(raw.name ?? '').trim().slice(0, 255);
  if (!name) throw new InputError('El producto necesita un nombre.');

  const price = money(raw.price);
  const discount = raw.discountPrice === null || raw.discountPrice === undefined || raw.discountPrice === '' ? 0 : money(raw.discountPrice);
  if (discount > 0 && discount >= price) throw new InputError('El precio de oferta tiene que ser menor que el precio.');

  // Si el pedido no trae variantes se conservan las que el producto ya tenía.
  const attributes = raw.attributes === undefined ? existing?.attributes : normalizeAttributes(raw.attributes);

  return settleVariants({
    id,
    name,
    description: String(raw.description ?? '').trim().slice(0, 5000),
    price,
    cost: money(raw.cost),
    discountPrice: discount > 0 ? discount : undefined,
    stock: Math.max(0, Math.floor(parseFormattedNumber(raw.stock))),
    category: canonicalCategory(tree, String(raw.category ?? '')).slice(0, 255),
    image: '',
    attributes,
  });
}

export type ProductPatch = {
  name?: unknown;
  price?: unknown;
  stock?: unknown;
  discountPrice?: unknown;
  category?: unknown;
};

/** Cambios sueltos desde el listado (precio, stock, oferta, categoría, nombre). */
export function applyPatch(existing: Product, patch: ProductPatch, tree: CategoryTree): Product {
  const next: Product = { ...existing };

  if (patch.name !== undefined) {
    const name = String(patch.name).trim().slice(0, 255);
    if (!name) throw new InputError('El producto necesita un nombre.');
    next.name = name;
  }
  if (patch.category !== undefined) next.category = canonicalCategory(tree, String(patch.category ?? '')).slice(0, 255);

  if (patch.stock !== undefined) {
    if (existing.attributes?.length) throw new InputError('Este producto tiene colores: el stock se edita color por color.');
    next.stock = Math.max(0, Math.floor(parseFormattedNumber(patch.stock)));
  }

  if (patch.price !== undefined) {
    const price = money(patch.price);
    const oldSale = existing.discountPrice ?? existing.price;
    next.price = price;
    if (next.discountPrice && next.discountPrice >= price) next.discountPrice = undefined;
    // Los colores que valían lo mismo que el producto acompañan el cambio.
    if (existing.attributes) {
      const newSale = next.discountPrice ?? price;
      next.attributes = existing.attributes.map((attr) => ({
        name: attr.name,
        values: attr.values.map((item) => (item.price === oldSale || item.price === existing.price ? { ...item, price: newSale } : item)),
      }));
    }
  }

  if (patch.discountPrice !== undefined) {
    const discount = patch.discountPrice === null || patch.discountPrice === '' ? 0 : money(patch.discountPrice);
    if (discount > 0 && discount >= next.price) throw new InputError('El precio de oferta tiene que ser menor que el precio.');
    next.discountPrice = discount > 0 ? discount : undefined;
  }

  return settleVariants(next);
}

function roundTo(value: number, step: number): number {
  return step > 1 ? Math.round(value / step) * step : Math.round(value);
}

/** Aumenta o baja todos los precios de un producto un porcentaje. */
export function adjustPrices(existing: Product, percent: number, step: number): Product {
  const factor = 1 + percent / 100;
  const scale = (value: number) => Math.max(0, roundTo(value * factor, step));
  const price = scale(existing.price);
  const discount = existing.discountPrice ? scale(existing.discountPrice) : undefined;
  return settleVariants({
    ...existing,
    price,
    discountPrice: discount && discount < price ? discount : undefined,
    attributes: existing.attributes?.map((attr) => ({
      name: attr.name,
      values: attr.values.map((item) => ({ ...item, price: scale(item.price) })),
    })),
  });
}
