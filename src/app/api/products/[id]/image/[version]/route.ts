import { getStoredImage } from '@/lib/db';

// Sirve las fotos subidas desde el panel. La dirección incluye una versión,
// así que el navegador puede guardarlas en caché sin riesgo de ver una vieja.

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id } = await params;
  const image = await getStoredImage(id).catch(() => null);
  const match = image ? /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(image) : null;
  if (!match || !ALLOWED.has(match[1].toLowerCase())) return new Response('No encontrada', { status: 404 });

  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1].toLowerCase(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
