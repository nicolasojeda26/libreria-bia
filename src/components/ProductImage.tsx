import Image from "next/image";
import { ImageOff } from "lucide-react";
import { hasRealImage } from "@/lib/site";

type Props = { src: string; alt: string; sizes: string; priority?: boolean; className?: string };

/** Foto del producto, o un marcador neutro si todavía no tiene. */
export default function ProductImage({ src, alt, sizes, priority, className = "object-contain" }: Props) {
  if (!hasRealImage(src)) {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-page text-muted">
        <ImageOff className="size-8" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs">Sin foto</span>
      </span>
    );
  }
  // Las fotos se sirven tal cual (sin pasar por el optimizador de Vercel).
  return <Image src={src} alt={alt} fill unoptimized sizes={sizes} priority={priority} className={className} />;
}
