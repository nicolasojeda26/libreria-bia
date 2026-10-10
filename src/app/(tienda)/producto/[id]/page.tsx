import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GraduationCap, House, Landmark, Truck } from "lucide-react";
import AddToCartButton from "@/components/AddToCartButton";
import Breadcrumb, { type Crumb } from "@/components/Breadcrumb";
import { WhatsAppIcon } from "@/components/Icons";
import ProductImage from "@/components/ProductImage";
import { categoryHref, resolveCategory } from "@/lib/categories";
import { getProductById } from "@/lib/db";
import { DELIVERY_METHODS, formatPrice, hasRealImage, whatsappUrl } from "@/lib/site";
import { toPublicProduct } from "@/types/product";

type Props = { params: Promise<{ id: string }> };

const deliveryIcons = { domicilio: House, envio: Truck, campus: GraduationCap } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return { title: "Producto no encontrado" };
  const image = hasRealImage(product.image) && !product.image.startsWith("data:") ? [product.image] : undefined;
  return {
    title: product.name,
    description: product.description || `${product.name} en Librería Bia.`,
    openGraph: { title: product.name, images: image },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const found = await getProductById(id);
  if (!found) notFound();
  // El costo se queda en el servidor: no se envía al navegador.
  const product = toPublicProduct(found);

  const price = product.discountPrice ?? product.price;
  const hasDiscount = product.discountPrice != null;
  const consultUrl = whatsappUrl(`¡Hola! Me interesa este producto: ${product.name} (${formatPrice(price)}). ¿Está disponible?`);

  const crumbs: Crumb[] = [{ label: "Inicio", href: "/" }];
  const category = resolveCategory(product.category);
  if (category) {
    crumbs.push({ label: category.parent.name, href: categoryHref(category.parent) });
    if (category.child) crumbs.push({ label: category.child.name, href: categoryHref(category.parent, category.child) });
  }
  crumbs.push({ label: product.name });

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6 lg:pt-10">
      <Breadcrumb items={crumbs} />

      <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="mx-auto w-full max-w-[480px] self-start bg-white p-2.5 shadow-card">
          <div className="relative aspect-[3/4]">
            <ProductImage src={product.image} alt={product.name} sizes="(max-width: 768px) 100vw, 480px" priority />
            {product.stock <= 0 && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-xl font-medium text-muted">SIN STOCK</span>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <h1 className="text-balance font-serif text-[2rem] font-normal leading-[1.15] tracking-[-0.01em] text-ink-soft sm:text-[2.6rem]">{product.name}</h1>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-[1.6rem] font-bold leading-none">
            <span>{formatPrice(price)}</span>
            {hasDiscount && <s className="text-lg font-normal text-muted">{formatPrice(product.price)}</s>}
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <AddToCartButton product={product} />
            <a href={consultUrl} target="_blank" rel="noopener noreferrer" className="btn-outline w-full !normal-case">
              <WhatsAppIcon className="size-5 text-whatsapp" />
              Consultar por WhatsApp
            </a>
          </div>

          {product.description && (
            <section className="mt-8 border-t border-line pt-6">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em]">Descripción</h2>
              <p className="mt-2 max-w-[65ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{product.description}</p>
            </section>
          )}

          <section className="mt-8 border-t border-line pt-6">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em]">Cómo recibís tu pedido</h2>
            <ul className="mt-4 space-y-4">
              {DELIVERY_METHODS.map((method) => {
                const Icon = deliveryIcons[method.id];
                return (
                  <li key={method.id} className="flex gap-3">
                    <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                    <p className="text-[15px] leading-snug">
                      <strong className="block">{method.title}</strong>
                      <span className="text-ink-soft">{method.detail}</span>
                    </p>
                  </li>
                );
              })}
              <li className="flex gap-3">
                <Landmark className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                <p className="text-[15px] leading-snug">
                  <strong className="block">Medios de pago</strong>
                  <span className="text-ink-soft">Transferencia, Mercado Pago o efectivo.</span>
                </p>
              </li>
            </ul>
          </section>

          <p className="mt-8 text-xs text-muted">Código: {product.id}</p>
        </div>
      </div>
    </div>
  );
}
