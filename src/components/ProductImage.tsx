import { ImageOff } from "lucide-react";
import { hasRealImage } from "@/lib/site";

type Props = { src: string; alt: string; sizes?: string; priority?: boolean; className?: string };

/** Foto del producto, o un marcador neutro si todavía no tiene. Ocupa todo su contenedor. */
export default function ProductImage({ src, alt, priority, className = "object-contain" }: Props) {
  if (!hasRealImage(src)) {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-page text-muted">
        <ImageOff className="size-[38%] max-h-8 max-w-8" strokeWidth={1.5} aria-hidden="true" />
        <span className="sr-only">Sin foto</span>
      </span>
    );
  }
  // Etiqueta <img> común: las fotos pueden venir de cualquier dirección que
  // se cargue en el panel y se sirven tal cual, sin pasar por el optimizador.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`absolute inset-0 size-full ${className}`}
    />
  );
}
