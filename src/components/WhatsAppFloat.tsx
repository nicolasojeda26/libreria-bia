import { WhatsAppIcon } from "./Icons";
import { whatsappUrl } from "@/lib/site";

export default function WhatsAppFloat() {
  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="fixed bottom-4 right-4 z-30 flex size-12 items-center justify-center rounded-full bg-whatsapp text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition-transform duration-150 active:scale-95"
    >
      <WhatsAppIcon className="size-6" />
    </a>
  );
}
