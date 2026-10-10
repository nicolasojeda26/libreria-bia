import { sql } from '@vercel/postgres';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import path from 'path';
import { hasPostgres, readJsonFile, writeJsonFile } from '@/lib/db';

// Usuarios del panel de administración. Las contraseñas se guardan con scrypt
// (nunca en texto plano) y se pueden cambiar desde el propio panel.

type AdminUser = { username: string; passwordHash: string };

const usersFilePath = path.join(process.cwd(), 'data', 'admin-users.json');

// Usuario inicial: se crea solo si todavía no existe ningún usuario.
const DEFAULT_ADMIN: AdminUser = {
  username: 'Bianca',
  passwordHash: 'scrypt$16384$WqwfJ_s1_DOm5ZE3J280lg$FYfqwxxqUXvqrMWfe1tOQkvVnkr5zhnTG6wtIqdER5urC_p3r6oBBOeZYIqqo8CLXnGPNA6m8UT4hmxN1RusMA',
};

const KEY_LENGTH = 64;
const COST = 16384;

function scryptAsync(password: string, salt: Buffer, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: cost, r: 8, p: 1 }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, COST);
  return `scrypt$${COST}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !cost || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), Number(cost));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let usersReady: Promise<void> | null = null;

async function initUsers() {
  if (hasPostgres) {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        username VARCHAR(100) PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    const { rows } = await sql`SELECT COUNT(*)::int AS total FROM admin_users`;
    if (Number(rows[0]?.total ?? 0) === 0) {
      await sql`
        INSERT INTO admin_users (username, password_hash)
        VALUES (${DEFAULT_ADMIN.username}, ${DEFAULT_ADMIN.passwordHash})
        ON CONFLICT (username) DO NOTHING;
      `;
    }
  } else {
    const users = await readJsonFile<AdminUser[]>(usersFilePath, []);
    if (users.length === 0) await writeJsonFile(usersFilePath, [DEFAULT_ADMIN]);
  }
}

function ensureUsers(): Promise<void> {
  if (!usersReady) {
    usersReady = initUsers().catch((error) => {
      usersReady = null;
      throw error;
    });
  }
  return usersReady;
}

async function findUser(username: string): Promise<AdminUser | null> {
  await ensureUsers();
  const wanted = username.trim().toLowerCase();
  if (!wanted) return null;
  if (hasPostgres) {
    const { rows } = await sql`SELECT username, password_hash FROM admin_users WHERE LOWER(username) = ${wanted} LIMIT 1`;
    return rows[0] ? { username: String(rows[0].username), passwordHash: String(rows[0].password_hash) } : null;
  }
  const users = await readJsonFile<AdminUser[]>(usersFilePath, []);
  return users.find((user) => user.username.toLowerCase() === wanted) ?? null;
}

/** Devuelve el nombre de usuario tal como está guardado, o null si no coincide. */
export async function verifyLogin(username: string, password: string): Promise<string | null> {
  const user = await findUser(username);
  // Si el usuario no existe igual se calcula un hash, para no delatarlo por el tiempo de respuesta.
  const valid = await verifyPassword(password, user?.passwordHash ?? DEFAULT_ADMIN.passwordHash);
  return user && valid ? user.username : null;
}

export async function changePassword(username: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const verified = await verifyLogin(username, currentPassword);
  if (!verified) return false;
  const passwordHash = await hashPassword(newPassword);
  if (hasPostgres) {
    await sql`UPDATE admin_users SET password_hash = ${passwordHash} WHERE username = ${verified}`;
  } else {
    const users = await readJsonFile<AdminUser[]>(usersFilePath, []);
    await writeJsonFile(usersFilePath, users.map((user) => (user.username === verified ? { ...user, passwordHash } : user)));
  }
  return true;
}
