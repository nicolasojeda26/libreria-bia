import { NextResponse } from 'next/server';
import { deleteProduct, getProductById, saveProduct } from '@/lib/db';
import { getAdminUser, unauthorized } from '@/lib/auth';
import { InputError, applyPatch, buildProduct, parseImage } from '@/lib/product-input';
import { getCategoryTree } from '@/lib/store';

type Context = { params: Promise<{ id: string }> };

function fail(error: unknown, fallback: string) {
  if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error('API Error:', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function validId(id: string): boolean {
  return id.length > 0 && id.length <= 100 && !/[\s/\\?#]/.test(id);
}

// Crear o guardar un producto completo (formulario del panel).
export async function PUT(request: Request, { params }: Context) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const { id } = await params;
    if (!validId(id)) throw new InputError('El código del producto no es válido.');
    const raw = await request.json();
    const [tree, existing] = await Promise.all([getCategoryTree(), getProductById(id)]);

    const { image, keep } = parseImage(raw.image);
    const product = buildProduct(id, raw, tree, existing);
    await saveProduct({ ...product, image }, { keepImage: keep });

    return NextResponse.json({ product: await getProductById(id) });
  } catch (error) {
    return fail(error, 'No se pudo guardar el producto.');
  }
}

// Edición rápida desde el listado: solo los campos que llegan.
export async function PATCH(request: Request, { params }: Context) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const { id } = await params;
    const [tree, existing] = await Promise.all([getCategoryTree(), getProductById(id)]);
    if (!existing) return NextResponse.json({ error: 'El producto ya no existe.' }, { status: 404 });

    const product = applyPatch(existing, await request.json(), tree);
    await saveProduct(product, { keepImage: true });
    return NextResponse.json({ product: await getProductById(id) });
  } catch (error) {
    return fail(error, 'No se pudo guardar el cambio.');
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const { id } = await params;
    await deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error, 'No se pudo eliminar el producto.');
  }
}
