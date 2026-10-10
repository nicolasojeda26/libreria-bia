import { NextResponse } from 'next/server';
import { insertProduct, deleteProduct, getProductById, Product } from '@/lib/db';
import { getAdminUser, unauthorized } from '@/lib/auth';
import { parseFormattedNumber } from '@/lib/numbers';
import type { ProductAttribute } from '@/types/product';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const raw = await request.json();
    const { id } = await params;

    const discountVal = raw.discountPrice ? parseFormattedNumber(raw.discountPrice) : undefined;

    // El formulario del panel no edita las variantes (colores): si no vienen
    // en el pedido se conservan las que el producto ya tenía.
    const existing = await getProductById(id);
    const attributes: ProductAttribute[] | undefined =
      Array.isArray(raw.attributes) && raw.attributes.length > 0 ? raw.attributes : existing?.attributes;

    const product: Product = {
      id,
      name: String(raw.name || "Sin Nombre"),
      description: String(raw.description || ""),
      price: parseFormattedNumber(raw.price),
      cost: parseFormattedNumber(raw.cost),
      discountPrice: discountVal && discountVal > 0 ? discountVal : undefined,
      stock: Math.floor(parseFormattedNumber(raw.stock)),
      category: String(raw.category || ""),
      image: String(raw.image || ""),
      attributes,
    };

    await insertProduct(product);
    return NextResponse.json({ message: 'Product updated successfully', product });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const { id } = await params;
    await deleteProduct(id);
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
