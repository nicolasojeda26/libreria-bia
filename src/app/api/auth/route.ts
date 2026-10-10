import { NextResponse } from 'next/server';
import { changePassword, verifyLogin } from '@/lib/admin-users';
import { getAdminUser, unauthorized } from '@/lib/auth';
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from '@/lib/session';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, username: user });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const user = username && password ? await verifyLogin(username, password) : null;
    if (!user) {
      await wait(600); // frena los intentos a ciegas
      return NextResponse.json({ success: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const token = await createSessionToken(user);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Falta configurar SESSION_SECRET en el servidor' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, username: user });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ success: false, error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}

// Cambiar la contraseña del usuario que tiene la sesión abierta.
export async function PUT(request: Request) {
  const user = await getAdminUser();
  if (!user) return unauthorized();
  try {
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'La contraseña nueva debe tener al menos 8 caracteres' }, { status: 400 });
    }
    const changed = await changePassword(user, currentPassword, newPassword);
    if (!changed) {
      await wait(600);
      return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'No se pudo cambiar la contraseña' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  // Cookie de la versión anterior del panel
  response.cookies.delete('admin_auth');
  return response;
}
