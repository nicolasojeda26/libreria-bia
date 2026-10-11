import { NextResponse } from 'next/server';
import { clearProducts, getProductById, getProducts, normalizeAttributes, saveProduct, type Product } from '@/lib/db';
import { getAdminUser, unauthorized } from '@/lib/auth';
import { canonicalCategory } from '@/lib/categories';
import { parseFormattedNumber } from '@/lib/numbers';
import { InputError, parseImage, settleVariants } from '@/lib/product-input';
import { getCategoryTree, withCanonicalCategories } from '@/lib/store';
import { toPublicProduct } from '@/types/product';

function pick(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export async function GET() {
  try {
    const products = withCanonicalCategories(await getProducts(), await getCategoryTree());
    // El costo es un dato interno: solo lo ve el panel con la sesión iniciada.
    if (await getAdminUser()) return NextResponse.json(products);
    return NextResponse.json(products.map(toPublicProduct));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await getAdminUser())) return unauthorized();
  try {
    await clearProducts();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo vaciar el catálogo.' }, { status: 500 });
  }
}

// Importación desde Excel, en tandas.
//   ?replace=1  borra todo el catálogo antes de cargar la tanda.
// Sin ese parámetro, cada fila actualiza el producto con el mismo código
// (solo las columnas que trae) o crea uno nuevo.
export async function POST(request: Request) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const url = new URL(request.url);
    const replace = url.searchParams.get('replace') === '1';
    const rows: Record<string, unknown>[] = await request.json();
    if (!Array.isArray(rows) || rows.length > 50) throw new InputError('La tanda de productos no es válida.');

    const tree = await getCategoryTree();
    if (replace) await clearProducts();

    let created = 0;
    let updated = 0;

    for (const raw of rows) {
      const idVal = pick(raw, ['id', 'Id', 'ID', 'codigo', 'Codigo', 'CODIGO', 'código', 'Código', 'sku', 'SKU']);
      const nameVal = pick(raw, ['name', 'Name', 'nombre', 'Nombre', 'NOMBRE', 'producto', 'Producto', 'PRODUCTO']);
      const descVal = pick(raw, ['description', 'Description', 'descripcion', 'Descripcion', 'DESCRIPCION', 'descripción', 'Descripción', 'detalle', 'Detalle', 'DETALLE']);
      const priceVal = pick(raw, ['price', 'Price', 'precio', 'Precio', 'PRECIO', 'precio venta', 'Precio Venta', 'PRECIO VENTA', 'pvp', 'PVP']);
      const costVal = pick(raw, ['cost', 'Cost', 'costo', 'Costo', 'COSTO', 'precio costo', 'Precio Costo', 'PRECIO COSTO', 'precio de compra', 'compra']);
      const discountVal = pick(raw, ['discountPrice', 'precioOferta', 'Precio Oferta', 'PRECIO OFERTA', 'precio oferta', 'oferta', 'Oferta', 'OFERTA', 'descuento', 'Descuento']);
      const stockVal = pick(raw, ['stock', 'Stock', 'STOCK', 'cantidad', 'Cantidad', 'CANTIDAD', 'unidades', 'Unidades', 'UNIDADES']);
      const catVal = pick(raw, ['category', 'Category', 'categoria', 'Categoria', 'CATEGORIA', 'categoría', 'Categoría', 'tipo', 'Tipo', 'TIPO']);
      const imgVal = pick(raw, ['image', 'Image', 'imagen', 'Imagen', 'IMAGEN', 'foto', 'Foto', 'FOTO', 'url imagen', 'URL Imagen', 'url', 'URL', 'link', 'Link']);
      const attributes = normalizeAttributes(raw.attributes);

      const id = String(idVal ?? '').trim().slice(0, 100) || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const existing = replace ? null : await getProductById(id);
      if (!existing && !nameVal) continue; // fila vacía o sin nombre

      const price = priceVal !== undefined ? Math.max(0, parseFormattedNumber(priceVal)) : existing?.price ?? 0;
      const discount = discountVal !== undefined ? parseFormattedNumber(discountVal) : existing?.discountPrice ?? 0;

      const product: Product = settleVariants({
        id,
        name: nameVal !== undefined ? String(nameVal).trim().slice(0, 255) : existing!.name,
        description: descVal !== undefined ? String(descVal).slice(0, 5000) : existing?.description ?? '',
        price,
        cost: costVal !== undefined ? Math.max(0, parseFormattedNumber(costVal)) : existing?.cost ?? 0,
        discountPrice: discount > 0 && discount < price ? discount : undefined,
        stock: stockVal !== undefined ? Math.max(0, Math.floor(parseFormattedNumber(stockVal))) : existing?.stock ?? 0,
        category: catVal !== undefined ? canonicalCategory(tree, String(catVal)).slice(0, 255) : existing?.category ?? '',
        image: '',
        attributes: attributes ?? existing?.attributes,
      });

      // Sin columna de foto se conserva la que el producto ya tenía.
      let image = { image: '', keep: true };
      if (imgVal !== undefined) {
        try {
          image = parseImage(imgVal);
        } catch {
          image = { image: '', keep: true };
        }
      }

      await saveProduct({ ...product, image: image.image }, { keepImage: image.keep });
      if (existing) updated++;
      else created++;
    }

    return NextResponse.json({ created, updated });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('API Error:', error);
    return NextResponse.json({ error: 'No se pudieron importar los productos.' }, { status: 500 });
  }
}
