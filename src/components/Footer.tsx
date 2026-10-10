import Link from "next/link";
import { Banknote, GraduationCap, House, Landmark, MapPin, Truck, Wallet } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "./Icons";
import { CATEGORY_TREE, categoryHref } from "@/lib/categories";
import { SITE, whatsappUrl } from "@/lib/site";

const highlights = [
  { icon: MapPin, label: SITE.neighborhood },
  { icon: WhatsAppIcon, label: "Ante cualquier duda, escribinos", href: whatsappUrl() },
  { icon: Landmark, label: "Recordá que aceptamos transferencia" },
];

const payments = [
  { icon: Banknote, label: "Efectivo" },
  { icon: Landmark, label: "Transferencia" },
  { icon: Wallet, label: "Mercado Pago" },
];

const deliveries = [
  { icon: House, label: "Retiro en domicilio" },
  { icon: Truck, label: "Envío" },
  { icon: GraduationCap, label: "Campus Roca" },
];

function Chip({ icon: Icon, label }: { icon: typeof Banknote; label: string }) {
  return (
    <li className="flex items-center gap-1.5 rounded-sm bg-white px-2 py-1 text-xs font-medium text-ink-soft">
      <Icon className="size-4 text-brand" aria-hidden="true" />
      {label}
    </li>
  );
}

export default function Footer() {
  const regretUrl = whatsappUrl("Hola Librería Bia, quiero solicitar la cancelación de una compra (botón de arrepentimiento).");

  return (
    <footer>
      {/* Franja rosa */}
      <div className="bg-rosa">
        <ul className="mx-auto grid max-w-[1340px] px-4 py-7 sm:px-6 md:grid-cols-3 md:divide-x md:divide-celeste/60 md:py-9 lg:px-10">
          {highlights.map(({ icon: Icon, label, href }) => {
            const content = (
              <>
                <Icon className="size-6" aria-hidden="true" />
                <span className="text-balance text-base font-bold uppercase leading-snug lg:text-[1.2rem]">{label}</span>
              </>
            );
            return (
              <li key={label} className="py-3 text-celeste md:px-4 md:py-0">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-center">
                    {content}
                  </a>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-center">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Categorías */}
      <div className="bg-brand text-white">
        <div className="mx-auto max-w-[1340px] px-4 py-10 sm:px-6 lg:px-10">
          <h2 className="text-center font-serif text-2xl font-bold uppercase">Productos</h2>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-2.5 gap-y-3">
            {CATEGORY_TREE.map((category) => (
              <li key={category.slug}>
                <Link
                  href={categoryHref(category)}
                  className="flex min-h-11 items-center rounded-[20px] border border-white px-3.5 text-[15px] uppercase transition-colors duration-150 hover:bg-white hover:text-brand"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div id="contacto" className="border-t border-white/20">
          <div className="mx-auto grid max-w-[1340px] gap-10 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-10">
            <div>
              <h2 className="font-serif text-[1.1rem] font-bold">Medios de pago</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {payments.map((item) => (
                  <Chip key={item.label} {...item} />
                ))}
              </ul>
              <h2 className="mt-6 font-serif text-[1.1rem] font-bold">Medios de envío</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {deliveries.map((item) => (
                  <Chip key={item.label} {...item} />
                ))}
              </ul>
            </div>

            <div className="md:justify-self-center">
              <h2 className="font-serif text-[1.1rem] font-bold">Nuestras redes sociales</h2>
              <a
                href={SITE.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 items-center gap-2 text-[0.9rem] font-bold"
              >
                <InstagramIcon className="size-6" />
                @libreria.bia
              </a>
            </div>

            <div className="md:justify-self-end">
              <h2 className="font-serif text-[1.1rem] font-bold">Contacto</h2>
              <ul className="mt-3 space-y-1.5 text-[0.9rem] font-bold">
                <li>
                  <a href={`mailto:${SITE.email}`} className="hover:underline">
                    {SITE.email}
                  </a>
                </li>
                <li>
                  <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    WhatsApp: {SITE.whatsappDisplay}
                  </a>
                </li>
                <li>{SITE.address}</li>
                <li className="pt-2 font-medium">{SITE.contactMessage}</li>
                <li>
                  <a href={regretUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    Botón de arrepentimiento
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-page">
        <p className="mx-auto max-w-[1340px] px-4 py-4 text-sm font-medium sm:px-6 lg:px-10">
          © {new Date().getFullYear()} Librería Bia
        </p>
      </div>
    </footer>
  );
}
