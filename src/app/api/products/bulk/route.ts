import { NextResponse } from 'next/server';
import { deleteProduct, getProductById, saveProduct } from '@/lib/db';
import { getAdminUser, unauthorized } from '@/lib/auth';
import { InputError, adjustPrices, applyPatch } from '@/lib/product-input';
import { getCategoryTree } from '@/lib/store';

// Acciones sobre varios productos a la vez. El panel las manda en tandas
// chicas para no pasarse del tiempo de respuesta.
const MAX_IDS = 50;
const ROUND_STEPS = new Set([1, 10, 50, 100]);

export async function POST(request: Request) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, MAX_IDS) : [];
    if (ids.length === 0) throw new InputError('No hay productos seleccionados.');

    if (body.action === 'delete') {
      for (const id of ids) await deleteProduct(id);
      return NextResponse.json({ done: ids.length });
    }

    const tree = await getCategoryTree();
    let done = 0;

    if (body.action === 'category') {
      for (const id of ids) {
        const existing = await getProductById(id);
        if (!existing) continue;
        await saveProduct(applyPatch(existing, { category: String(body.category ?? '') }, tree), { keepImage: true });
        done++;
      }
      return NextResponse.json({ done });
    }

    if (body.action === 'price') {
      const percent = Number(body.percent);
      const step = Number(body.round ?? 1);
      if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 500) throw new InputError('El porcentaje tiene que estar entre -90 y 500.');
      if (!ROUND_STEPS.has(step)) throw new InputError('El redondeo no es válido.');
      for (const id of ids) {
        const existing = await getProductById(id);
        if (!existing) continue;
        await saveProduct(adjustPrices(existing, percent, step), { keepImage: true });
        done++;
      }
      return NextResponse.json({ done });
    }

    throw new InputError('Acción desconocida.');
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('API Error:', error);
    return NextResponse.json({ error: 'No se pudo completar la acción.' }, { status: 500 });
  }
}
