"use client";

import Link from "next/link";
import { ArrowLeft, CircleCheck, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/Icons";
import ProductImage from "@/components/ProductImage";
import { DELIVERY_METHODS, PAYMENT_METHODS, formatPrice, whatsappUrl, type DeliveryId, type PaymentId } from "@/lib/site";
import { useHydrated } from "@/lib/useHydrated";
import { useCartStore, type CartItem } from "@/store/cartStore";

type FormData = { name: string; phone: string; address: string; zone: string; notes: string };

function buildMessage(items: CartItem[], total: number, form: FormData, delivery: DeliveryId, payment: PaymentId): string {
  const deliveryMethod = DELIVERY_METHODS.find((method) => method.id === delivery)!;
  const paymentMethod = PAYMENT_METHODS.find((method) => method.id === payment)!;

  const lines = [
    "*¡Hola Librería Bia! Quiero hacer un pedido:*",
    "",
    `*Nombre:* ${form.name.trim()}`,
    `*WhatsApp:* ${form.phone.trim()}`,
    `*Método de pago:* ${paymentMethod.title}`,
    "",
    "*Pedido:*",
    ...items.map((item) => {
      const color = item.selectedColor ? ` (Color: ${item.selectedColor})` : "";
      return `• ${item.quantity} × ${item.name}${color} — ${formatPrice(item.price * item.quantity)}`;
    }),
    "",
    `*Total: ${formatPrice(total)}*${delivery === "envio" ? " + envío según zona" : ""}`,
    "",
    `*Entrega:* ${deliveryMethod.summary}`,
  ];
  if (delivery === "envio") lines.push(`*Dirección:* ${form.address.trim()} — ${form.zone.trim()}`);
  if (form.notes.trim()) lines.push("", `*Nota:* ${form.notes.trim()}`);
  return lines.join("\n");
}

export default function CheckoutPage() {
  const hydrated = useHydrated();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const [delivery, setDelivery] = useState<DeliveryId>("domicilio");
  const [payment, setPayment] = useState<PaymentId>("transferencia");
  const [form, setForm] = useState<FormData>({ name: "", phone: "", address: "", zone: "", notes: "" });
  const [sentUrl, setSentUrl] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const url = whatsappUrl(buildMessage(items, getTotalPrice(), form, delivery, payment));
    window.open(url, "_blank", "noopener");
    setSentUrl(url);
    clearCart();
    window.scrollTo({ top: 0 });
  };

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;

  if (sentUrl) {
    return (
      <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <div className="bg-white px-6 py-12 shadow-card">
          <CircleCheck className="mx-auto size-12 text-whatsapp" strokeWidth={1.5} aria-hidden="true" />
          <h1 className="mt-4 font-serif text-2xl font-bold text-ink-soft">¡Ya casi está!</h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
            Se abrió WhatsApp con el detalle de tu pedido. <strong>Enviá ese mensaje</strong> para confirmarlo y coordinamos el pago y la entrega.
          </p>
          <a href={sentUrl} target="_blank" rel="noopener noreferrer" className="btn-pill mt-7 !bg-whatsapp-dark !normal-case">
            <WhatsAppIcon className="size-5" />
            Abrir WhatsApp de nuevo
          </a>
          <Link href="/" className="mt-5 block text-[15px] font-medium text-brand underline">
            Volver a la tienda
          </Link>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <div className="bg-white px-6 py-12 shadow-card">
          <ShoppingBag className="mx-auto size-10 text-brand" strokeWidth={1.5} aria-hidden="true" />
          <h1 className="mt-4 font-serif text-xl font-medium text-ink-soft">Tu carrito está vacío</h1>
          <Link href="/productos" className="btn-serif mt-6">
            Ver productos
          </Link>
        </div>
      </section>
    );
  }

  const radioCard = (checked: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-[10px] border p-4 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
      checked ? "border-brand bg-brand/[0.07]" : "border-[#cfcfcf] bg-white hover:border-brand"
    }`;

  return (
    <section className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <Link href="/carrito" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-brand">
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver al carrito
      </Link>
      <h1 className="section-title mt-2">Finalizar pedido</h1>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex flex-col gap-6">
          <fieldset className="bg-white p-5 shadow-card sm:p-7">
            <legend className="float-left mb-5 w-full font-serif text-xl font-bold">Tus datos</legend>
            <div className="clear-both grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[15px] font-bold">
                Nombre y apellido
                <input required name="name" autoComplete="name" value={form.name} onChange={handleChange} className="field font-normal" />
              </label>
              <label className="flex flex-col gap-1.5 text-[15px] font-bold">
                Número de WhatsApp
                <input
                  required
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  pattern="[0-9+\(\)\s\-]{8,20}"
                  title="Ingresá tu número con característica, por ejemplo 3794012485"
                  placeholder="Ej: 3794012485"
                  value={form.phone}
                  onChange={handleChange}
                  className="field font-normal"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="bg-white p-5 shadow-card sm:p-7">
            <legend className="float-left mb-5 w-full font-serif text-xl font-bold">¿Cómo retirás tu pedido?</legend>
            <div className="clear-both flex flex-col gap-3">
              {DELIVERY_METHODS.map((method) => (
                <label key={method.id} className={radioCard(delivery === method.id)}>
                  <input type="radio" name="delivery" value={method.id} checked={delivery === method.id} onChange={() => setDelivery(method.id)} className="mt-1 size-4 accent-[#446cb3]" />
                  <span className="text-[15px] leading-snug">
                    <strong className="block">{method.title}</strong>
                    <span className="text-ink-soft">{method.detail}</span>
                  </span>
                </label>
              ))}
            </div>
            {delivery === "envio" && (
              <div className="animate-fade-in mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[15px] font-bold">
                  Dirección
                  <input required name="address" autoComplete="street-address" value={form.address} onChange={handleChange} className="field font-normal" />
                </label>
                <label className="flex flex-col gap-1.5 text-[15px] font-bold">
                  Barrio o zona
                  <input required name="zone" value={form.zone} onChange={handleChange} className="field font-normal" />
                </label>
              </div>
            )}
          </fieldset>

          <fieldset className="bg-white p-5 shadow-card sm:p-7">
            <legend className="float-left mb-5 w-full font-serif text-xl font-bold">Método de pago</legend>
            <div className="clear-both flex flex-col gap-3">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.id} className={radioCard(payment === method.id)}>
                  <input type="radio" name="payment" value={method.id} checked={payment === method.id} onChange={() => setPayment(method.id)} className="mt-1 size-4 accent-[#446cb3]" />
                  <span className="text-[15px] leading-snug">
                    <strong className="block">{method.title}</strong>
                    <span className="text-ink-soft">{method.detail}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-5 flex flex-col gap-1.5 text-[15px] font-bold">
              Nota para el pedido (opcional)
              <textarea name="notes" rows={3} maxLength={300} value={form.notes} onChange={handleChange} className="field font-normal" />
            </label>
          </fieldset>
        </div>

        <aside className="bg-white p-6 shadow-card lg:sticky lg:top-32" aria-label="Tu pedido">
          <h2 className="font-serif text-xl font-bold">Tu pedido</h2>
          <ul className="mt-5 flex max-h-72 flex-col gap-4 overflow-y-auto">
            {items.map((item) => (
              <li key={`${item.id}-${item.selectedColor || ""}`} className="flex gap-3">
                <div className="relative aspect-[3/4] w-12 shrink-0 bg-page">
                  <ProductImage src={item.image} alt="" sizes="48px" />
                </div>
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  <p className="font-medium">{item.name}</p>
                  {item.selectedColor && <p className="text-muted">Color: {item.selectedColor}</p>}
                  <p className="text-ink-soft">
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-3 border-t border-line pt-5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt>Envío</dt>
              <dd className="text-right text-ink-soft">{delivery === "envio" ? "Según la zona" : "Sin costo"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-bold">Total</dt>
              <dd className="text-2xl font-bold">{formatPrice(getTotalPrice())}</dd>
            </div>
          </dl>
          <button type="submit" className="btn-pill mt-6 w-full !min-h-[50px] !bg-whatsapp-dark !px-4 !text-[0.9rem] !normal-case">
            <WhatsAppIcon className="size-5" />
            Enviar pedido por WhatsApp
          </button>
          <p className="mt-3 text-center text-[13px] leading-snug text-muted">
            Se abre WhatsApp con el detalle del pedido para que lo envíes y coordinemos.
          </p>
        </aside>
      </form>
    </section>
  );
}
