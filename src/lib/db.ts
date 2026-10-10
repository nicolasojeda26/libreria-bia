import { sql } from '@vercel/postgres';
import fs from 'fs/promises';
import path from 'path';
import type { Product, ProductAttribute } from '@/types/product';
import { canonicalCategory } from '@/lib/categories';

export type { Product } from '@/types/product';

export const hasPostgres = !!process.env.POSTGRES_URL;
const dataDir = path.join(process.cwd(), 'data');
const dataFilePath = path.join(dataDir, 'products.json');
const settingsFilePath = path.join(dataDir, 'settings.json');

async function ensureDataDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

// El esquema se revisa una sola vez por proceso, no en cada visita.
let schemaReady: Promise<void> | null = null;

async function initSchema() {
  if (hasPostgres) {
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC NOT NULL,
        cost NUMERIC DEFAULT 0,
        "discountPrice" NUMERIC,
        stock INTEGER NOT NULL,
        category VARCHAR(255),
        image TEXT
      );
    `;
    // La tabla puede existir de antes sin algunas columnas:
    // ADD COLUMN IF NOT EXISTS no falla y completa el esquema.
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS "discountPrice" NUMERIC`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(255)`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`;
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );
    `;
  } else {
    await ensureDataDir();
    try {
      await fs.access(dataFilePath);
    } catch {
      await fs.writeFile(dataFilePath, JSON.stringify([]));
    }
  }
}

export function createTable(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAttributes(raw: unknown): ProductAttribute[] | undefined {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const attributes = value
    .filter((attr) => attr && typeof attr.name === 'string' && Array.isArray(attr.values))
    .map((attr) => ({
      name: String(attr.name),
      values: (attr.values as Record<string, unknown>[]).map((item) => ({
        value: String(item.value ?? ''),
        stock: Math.floor(toNumber(item.stock)),
        price: toNumber(item.price),
      })),
    }));
  return attributes.length > 0 ? attributes : undefined;
}

// Postgres devuelve los NUMERIC como texto y la categoría puede venir con
// un nombre viejo: acá se deja todo en un formato único.
function normalizeProduct(row: Record<string, unknown>): Product {
  const discount = toNumber(row.discountPrice);
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    price: toNumber(row.price),
    cost: toNumber(row.cost),
    discountPrice: discount > 0 ? discount : undefined,
    stock: Math.floor(toNumber(row.stock)),
    category: canonicalCategory(row.category as string | null),
    image: String(row.image ?? ''),
    attributes: normalizeAttributes(row.attributes),
  };
}

export async function getProducts(): Promise<Product[]> {
  try {
    await createTable();
    if (hasPostgres) {
      const { rows } = await sql`SELECT * FROM products ORDER BY name ASC`;
      return rows.map(normalizeProduct);
    }
    const products = await readJsonFile<Record<string, unknown>[]>(dataFilePath, []);
    return products.map(normalizeProduct).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    await createTable();
    if (hasPostgres) {
      const { rows } = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
      return rows[0] ? normalizeProduct(rows[0]) : null;
    }
    const products = await getProducts();
    return products.find((p) => p.id === id) ?? null;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

export async function clearProducts() {
  await createTable();
  if (hasPostgres) {
    await sql`DELETE FROM products`;
  } else {
    await writeJsonFile(dataFilePath, []);
  }
}

export async function insertProduct(product: Product) {
  await createTable();
  const category = canonicalCategory(product.category);
  if (hasPostgres) {
    const attrsJson = product.attributes ? JSON.stringify(product.attributes) : null;
    await sql`
      INSERT INTO products (id, name, description, price, cost, "discountPrice", stock, category, image, attributes)
      VALUES (${product.id}, ${product.name}, ${product.description}, ${product.price}, ${product.cost}, ${product.discountPrice ?? null}, ${product.stock}, ${category}, ${product.image}, ${attrsJson}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        cost = EXCLUDED.cost,
        "discountPrice" = EXCLUDED."discountPrice",
        stock = EXCLUDED.stock,
        category = EXCLUDED.category,
        image = EXCLUDED.image,
        attributes = EXCLUDED.attributes;
    `;
  } else {
    const products = await readJsonFile<Product[]>(dataFilePath, []);
    const stored = { ...product, category };
    const index = products.findIndex((p) => p.id === product.id);
    if (index >= 0) {
      products[index] = stored;
    } else {
      products.push(stored);
    }
    await writeJsonFile(dataFilePath, products);
  }
}

export async function deleteProduct(id: string) {
  await createTable();
  if (hasPostgres) {
    await sql`DELETE FROM products WHERE id = ${id}`;
  } else {
    const products = await readJsonFile<Product[]>(dataFilePath, []);
    await writeJsonFile(dataFilePath, products.filter((p) => p.id !== id));
  }
}

// --- Ajustes de la tienda (por ahora, el aviso de la barra superior) ---

export async function getSetting(key: string): Promise<string> {
  try {
    await createTable();
    if (hasPostgres) {
      const { rows } = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
      return rows[0] ? String(rows[0].value ?? '') : '';
    }
    const settings = await readJsonFile<Record<string, string>>(settingsFilePath, {});
    return settings[key] ?? '';
  } catch (error) {
    console.error('Error fetching setting:', error);
    return '';
  }
}

export async function setSetting(key: string, value: string) {
  await createTable();
  if (hasPostgres) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `;
  } else {
    const settings = await readJsonFile<Record<string, string>>(settingsFilePath, {});
    settings[key] = value;
    await writeJsonFile(settingsFilePath, settings);
  }
}
