// Sesión del panel: una cookie firmada con HMAC-SHA256.
// Usa Web Crypto para funcionar igual en el proxy y en las rutas de la API.

export const SESSION_COOKIE = 'admin_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

const encoder = new TextEncoder();

function getSecret(): string | null {
  // SESSION_SECRET es lo recomendado. Si no está, se usa la URL privada de la
  // base (que ya es secreta) para que el login funcione sin configurar nada.
  const secret = process.env.SESSION_SECRET || process.env.POSTGRES_URL;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'solo-para-desarrollo-local';
  return null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export function sessionsAvailable(): boolean {
  return getSecret() !== null;
}

export async function createSessionToken(username: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const payload = toBase64Url(encoder.encode(JSON.stringify({ u: username, exp: Date.now() + SESSION_MAX_AGE * 1000 })));
  const signature = await crypto.subtle.sign('HMAC', await getKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Devuelve el usuario si la cookie es válida y no venció; si no, null. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length > 0) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await getKey(secret), fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { u?: unknown; exp?: unknown };
    if (typeof data.u !== 'string' || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data.u;
  } catch {
    return null;
  }
}
