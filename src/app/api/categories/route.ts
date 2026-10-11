import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/db';
import { getAdminUser, unauthorized } from '@/lib/auth';
import { resolveCategory, sanitizeTree } from '@/lib/categories';
import { getCategoryTree, saveCategoryTree } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ tree: await getCategoryTree() });
}

// Guarda el árbol completo tal como quedó en el panel.
export async function PUT(request: Request) {
  if (!(await getAdminUser())) return unauthorized();
  try {
    const body = await request.json();
    const previous = await getCategoryTree();
    const result = sanitizeTree(body.tree, previous);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
    const { tree } = result;

    // No se puede borrar una categoría que todavía tiene productos.
    const products = await getProducts();
    for (const parent of previous) {
      const kept = tree.find((node) => node.slug === parent.slug);
      const inParent = products.filter((product) => resolveCategory(previous, product.category)?.parent.slug === parent.slug);
      if (!kept) {
        if (inParent.length > 0) {
          return NextResponse.json(
            { error: `“${parent.name}” tiene ${inParent.length} ${inParent.length === 1 ? 'producto' : 'productos'}. Movelos a otra categoría antes de eliminarla.` },
            { status: 409 },
          );
        }
        continue;
      }
      for (const child of parent.children) {
        if (kept.children.some((node) => node.slug === child.slug)) continue;
        const inChild = inParent.filter((product) => resolveCategory(previous, product.category)?.child?.slug === child.slug);
        if (inChild.length > 0) {
          return NextResponse.json(
            { error: `“${child.name}” tiene ${inChild.length} ${inChild.length === 1 ? 'producto' : 'productos'}. Movelos a otra categoría antes de eliminarla.` },
            { status: 409 },
          );
        }
      }
    }

    await saveCategoryTree(tree);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'No se pudieron guardar las categorías.' }, { status: 500 });
  }
}
