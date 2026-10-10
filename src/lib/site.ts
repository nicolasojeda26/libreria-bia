// Datos de la tienda en un solo lugar: contacto, entregas y medios de pago.

export const SITE = {
  name: "Librería Bia",
  welcome: "¡Bienvenidos a nuestra tienda web de librería Bia! Aquí encontrarás todo lo que necesitas.",
  email: "libreriabia@gmail.com",
  whatsappDisplay: "3794012485",
  whatsappNumber: "5493794012485",
  address: "Barrio San Roque Este 228 viv Manzana N Casa 6",
  neighborhood: "Barrio San Roque Este",
  contactMessage: "Ante cualquier duda, escribinos.",
  instagram: "https://instagram.com/libreria.bia",
} as const;

export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${SITE.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export type DeliveryId = "domicilio" | "envio" | "campus";

export const DELIVERY_METHODS: { id: DeliveryId; title: string; detail: string; summary: string }[] = [
  {
    id: "domicilio",
    title: "Retiro en mi domicilio",
    detail: "No cuento con local. Pedí la ubicación por privado.",
    summary: "Retiro en domicilio (ubicación por privado)",
  },
  {
    id: "envio",
    title: "Envío",
    detail: "Tiene un costo que depende de la zona.",
    summary: "Envío a domicilio",
  },
  {
    id: "campus",
    title: "Punto de encuentro en el Campus Roca",
    detail: "Av. Libertad, los días y horarios que curso.",
    summary: "Punto de encuentro en Campus Roca (Av. Libertad)",
  },
];

export type PaymentId = "transferencia" | "mercadopago" | "efectivo";

export const PAYMENT_METHODS: { id: PaymentId; title: string; detail: string }[] = [
  { id: "transferencia", title: "Transferencia bancaria", detail: "Alias: toledobianca2" },
  { id: "mercadopago", title: "Mercado Pago", detail: "Alias: toledobianca2" },
  { id: "efectivo", title: "Efectivo", detail: "Al retirar o recibir el pedido" },
];

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Number(value) || 0)
    .replace(/\s/g, "");
}

/** Los productos sin foto guardan un texto vacío o el viejo marcador de posición. */
export function hasRealImage(image: string | undefined | null): image is string {
  return !!image && !image.includes("via.placeholder.com");
}
