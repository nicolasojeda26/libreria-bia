import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

// Toda escritura en la API exige una sesión válida del panel.
// La única excepción es /api/auth, que es donde se inicia sesión.
// (Cada ruta vuelve a comprobar la sesión por su cuenta.)
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRead = request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS';
  if (isRead || pathname === '/api/auth') return NextResponse.next();

  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
