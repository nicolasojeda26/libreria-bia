import type { Metadata } from "next";
import Link from "next/link";
import CategoryPills from "@/components/CategoryPills";
import ProductGrid from "@/components/ProductGrid";
import { CATEGORY_TREE, categoryHref } from "@/lib/categories";
import { PAGE_SIZE, getStoreProducts, searchProducts, toCardData, visibleCount } from "@/lib/store";

type Props = { searchParams: Promise<{ q?: string | string[]; ver?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim();
  return { title: query ? `Resultados para “${query}”` : "Todos los productos" };
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = ((Array.isArray(params.q) ? params.q[0] : params.q) ?? "").trim().slice(0, 80);

  const all = await getStoreProducts();
  const matches = query ? searchProducts(all, query) : all;
  const count = visibleCount(params.ver, matches.length);
  const visible = matches.slice(0, count).map(toCardData);

  const more = new URLSearchParams();
  if (query) more.set("q", query);
  more.set("ver", String(count + PAGE_SIZE));

  const pills = [
    { label: "Todo", href: "/productos", active: !query },
    ...CATEGORY_TREE.map((category) => ({ label: category.name, href: categoryHref(category) })),
  ];

  return (
    <section className="mx-auto max-w-[1340px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <h1 className="section-title">{query ? `Resultados para “${query}”` : "Todos los productos"}</h1>
      <p className="mt-2 text-center text-sm text-muted" aria-live="polite">
        {matches.length === 1 ? "1 producto" : `${matches.length} productos`}
      </p>

      <div className="mt-6">
        <CategoryPills items={pills} label="Categorías" />
      </div>

      <div className="mt-8">
        {visible.length === 0 ? (
          <div className="mx-auto max-w-md bg-white px-6 py-12 text-center shadow-card">
            <p className="font-serif text-xl font-medium text-ink-soft">No encontramos productos{query ? ` para “${query}”` : ""}.</p>
            <p className="mt-2 text-[15px] text-muted">Probá con otra palabra o mirá todo el catálogo.</p>
            <Link href="/productos" className="btn-serif mt-6">
              Ver todo
            </Link>
          </div>
        ) : (
          <ProductGrid products={visible} moreHref={count < matches.length ? `/productos?${more.toString()}` : undefined} />
        )}
      </div>
    </section>
  );
}
