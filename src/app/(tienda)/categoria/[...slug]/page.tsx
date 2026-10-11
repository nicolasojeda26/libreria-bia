import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb, { type Crumb } from "@/components/Breadcrumb";
import CategoryPills from "@/components/CategoryPills";
import ProductGrid from "@/components/ProductGrid";
import { categoryHref, findCategoryBySlug } from "@/lib/categories";
import { PAGE_SIZE, filterByCategory, getCategoryTree, getStoreProducts, toCardData, visibleCount } from "@/lib/store";

type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ ver?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = findCategoryBySlug(await getCategoryTree(), slug);
  if (!category) return { title: "Categoría no encontrada" };
  return { title: category.child ? `${category.child.name} · ${category.parent.name}` : category.parent.name };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, { ver }, tree] = await Promise.all([params, searchParams, getCategoryTree()]);
  const category = findCategoryBySlug(tree, slug);
  if (!category) notFound();

  const { parent, child } = category;
  const matches = filterByCategory(await getStoreProducts(), tree, category);
  const count = visibleCount(ver, matches.length);
  const visible = matches.slice(0, count).map(toCardData);
  const selfHref = categoryHref(parent, child);

  const crumbs: Crumb[] = [{ label: "Inicio", href: "/" }];
  if (child) {
    crumbs.push({ label: parent.name, href: categoryHref(parent) }, { label: child.name });
  } else {
    crumbs.push({ label: parent.name });
  }

  const pills =
    parent.children.length > 0
      ? [
          { label: "Ver todo", href: categoryHref(parent), active: !child },
          ...parent.children.map((item) => ({ label: item.name, href: categoryHref(parent, item), active: item.slug === child?.slug })),
        ]
      : [];

  return (
    <section className="mx-auto max-w-[1340px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <Breadcrumb items={crumbs} />
      <h1 className="section-title mt-5">{child ? child.name : parent.name}</h1>
      <p className="mt-2 text-center text-sm text-muted">{matches.length === 1 ? "1 producto" : `${matches.length} productos`}</p>

      {pills.length > 0 && (
        <div className="mt-6">
          <CategoryPills items={pills} label={`Subcategorías de ${parent.name}`} />
        </div>
      )}

      <div className="mt-8">
        {visible.length === 0 ? (
          <div className="mx-auto max-w-md bg-white px-6 py-12 text-center shadow-card">
            <p className="font-serif text-xl font-medium text-ink-soft">Todavía no hay productos en esta categoría.</p>
            <p className="mt-2 text-[15px] text-muted">Estamos sumando novedades. Mientras tanto, mirá el resto del catálogo.</p>
            <Link href="/productos" className="btn-serif mt-6">
              Ver todo
            </Link>
          </div>
        ) : (
          <ProductGrid products={visible} moreHref={count < matches.length ? `${selfHref}?ver=${count + PAGE_SIZE}` : undefined} />
        )}
      </div>
    </section>
  );
}
