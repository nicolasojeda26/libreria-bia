import { NextResponse } from 'next/server';
import { clearProducts, insertProduct, getProducts, Product } from '@/lib/db';
import { getAdminUser, unauthorized } from '@/lib/auth';
import { parseFormattedNumber } from '@/lib/numbers';
import { ProductAttribute, toPublicProduct } from '@/types/product';

function pick(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export async function GET() {
  try {
    const products = await getProducts();
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
    return NextResponse.json({ message: 'All products deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to clear products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const url = new URL(request.url);
    // ?replace=1 borra todo antes de insertar (primer lote de la importación).
    // Sin el parámetro solo hace upsert (lotes siguientes).
    const replace = url.searchParams.get('replace') === '1';

    const rawProducts: Record<string, unknown>[] = await request.json();

    if (replace) {
      await clearProducts();
    }
    
    for (let i = 0; i < rawProducts.length; i++) {
      const raw = rawProducts[i];

      const idVal = pick(raw, ['id', 'Id', 'ID', 'codigo', 'Codigo', 'CODIGO', 'código', 'Código', 'sku', 'SKU']);
      const nameVal = pick(raw, ['name', 'Name', 'nombre', 'Nombre', 'NOMBRE', 'producto', 'Producto', 'PRODUCTO']);
      const descVal = pick(raw, ['description', 'Description', 'descripcion', 'Descripcion', 'DESCRIPCION', 'detalle', 'Detalle', 'DETALLE']);
      const priceVal = parseFormattedNumber(pick(raw, ['price', 'Price', 'precio', 'Precio', 'PRECIO', 'precio venta', 'Precio Venta', 'PRECIO VENTA', 'pvp', 'PVP']));
      const costVal = parseFormattedNumber(pick(raw, ['cost', 'Cost', 'costo', 'Costo', 'COSTO', 'precio costo', 'Precio Costo', 'PRECIO COSTO', 'precio de compra', 'compra']));
      const discountVal = pick(raw, ['discountPrice', 'precioOferta', 'Precio Oferta', 'PRECIO OFERTA', 'precio oferta', 'oferta', 'Oferta', 'OFERTA', 'descuento', 'Descuento']);
      const stockVal = Math.floor(parseFormattedNumber(pick(raw, ['stock', 'Stock', 'STOCK', 'cantidad', 'Cantidad', 'CANTIDAD', 'unidades', 'Unidades', 'UNIDADES'])));
      const catVal = pick(raw, ['category', 'Category', 'categoria', 'Categoria', 'CATEGORIA', 'categoría', 'Categoría', 'tipo', 'Tipo', 'TIPO']);
      const imgVal = pick(raw, ['image', 'Image', 'imagen', 'Imagen', 'IMAGEN', 'foto', 'Foto', 'FOTO', 'url imagen', 'URL Imagen', 'url', 'URL', 'link', 'Link']);
      const attrsVal = raw.attributes as ProductAttribute[] | undefined;

      const product: Product = {
        id: String(idVal || (i + 1)),
        name: String(nameVal || "Sin Nombre"),
        description: String(descVal || ""),
        price: priceVal,
        cost: costVal,
        discountPrice: discountVal ? parseFormattedNumber(discountVal) : undefined,
        stock: stockVal,
        category: String(catVal || "General"),
        image: String(imgVal || ""),
        attributes: Array.isArray(attrsVal) && attrsVal.length > 0 ? attrsVal : undefined,
      };

      if (product.discountPrice !== undefined && product.discountPrice <= 0) {
        product.discountPrice = undefined;
      }

      await insertProduct(product);
    }
    
    return NextResponse.json({ message: 'Products synced successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to sync products', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
