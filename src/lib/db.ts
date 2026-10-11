import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Product, ProductAttribute } from '@/types/product';

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

// --- Fotos ---
// Una foto puede ser un enlace (https://...) o una foto subida desde el
// panel, que se guarda dentro de la base como "data:image/...". Las subidas
// nunca viajan en los listados: se sirven por /api/products/<id>/image/<versión>
// para que el navegador las guarde en caché.

export function isInlineImage(image: string | null | undefined): image is string {
  return !!image && image.startsWith('data:');
}

function imageVersion(image: string): string | null {
  return isInlineImage(image) ? createHash('md5').update(image).digest('hex').slice(0, 12) : null;
}

export function inlineImageUrl(id: string, version: string): string {
  return `/api/products/${encodeURIComponent(id)}/image/${version}`;
}

/** true si el valor es la dirección interna de una foto ya guardada. */
export function isStoredImageUrl(image: string): boolean {
  return image.startsWith('/api/products/');
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
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_version VARCHAR(16)`;
    // Fotos subidas antes de que existiera image_version.
    await sql`
      UPDATE products SET image_version = substr(md5(image), 1, 12)
      WHERE image_version IS NULL AND image LIKE 'data:%'
    `;
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

export function normalizeAttributes(raw: unknown): ProductAttribute[] | undefined {
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
      name: String(attr.name).slice(0, 40),
      values: (attr.values as Record<string, unknown>[])
        .map((item) => ({
          value: String(item?.value ?? '').trim().slice(0, 60),
          stock: Math.max(0, Math.floor(toNumber(item?.stock))),
          price: Math.max(0, toNumber(item?.price)),
        }))
        .filter((item) => item.value),
    }))
    .filter((attr) => attr.values.length > 0);
  return attributes.length > 0 ? attributes : undefined;
}

// Postgres devuelve los NUMERIC como texto: acá se deja todo como número.
// `image` sale lista para usar en una etiqueta <img>.
function normalizeProduct(row: Record<string, unknown>): Product {
  const discount = toNumber(row.discountPrice);
  const id = String(row.id);
  const rawImage = String(row.image ?? '');
  const version = row.image_version ? String(row.image_version) : imageVersion(rawImage);
  return {
    id,
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    price: toNumber(row.price),
    cost: toNumber(row.cost),
    discountPrice: discount > 0 ? discount : undefined,
    stock: Math.floor(toNumber(row.stock)),
    category: String(row.category ?? '').trim(),
    image: version ? inlineImageUrl(id, version) : rawImage,
    attributes: normalizeAttributes(row.attributes),
  };
}

export async function getProducts(): Promise<Product[]> {
  try {
    await createTable();
    if (hasPostgres) {
      // Las fotos subidas (image_version no nulo) no se traen en el listado.
      const { rows } = await sql`
        SELECT id, name, description, price, cost, "discountPrice", stock, category, attributes, image_version,
               CASE WHEN image_version IS NULL THEN image ELSE '' END AS image
        FROM products ORDER BY name ASC
      `;
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
      const { rows } = await sql`
        SELECT id, name, description, price, cost, "discountPrice", stock, category, attributes, image_version,
               CASE WHEN image_version IS NULL THEN image ELSE '' END AS image
        FROM products WHERE id = ${id} LIMIT 1
      `;
      return rows[0] ? normalizeProduct(rows[0]) : null;
    }
    const products = await readJsonFile<Record<string, unknown>[]>(dataFilePath, []);
    const found = products.find((p) => String(p.id) === id);
    return found ? normalizeProduct(found) : null;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

/** Foto tal como está guardada (enlace o data URL); null si el producto no existe. */
export async function getStoredImage(id: string): Promise<string | null> {
  await createTable();
  if (hasPostgres) {
    const { rows } = await sql`SELECT image FROM products WHERE id = ${id} LIMIT 1`;
    return rows[0] ? String(rows[0].image ?? '') : null;
  }
  const products = await readJsonFile<Record<string, unknown>[]>(dataFilePath, []);
  const found = products.find((p) => String(p.id) === id);
  return found ? String(found.image ?? '') : null;
}

export async function clearProducts() {
  await createTable();
  if (hasPostgres) {
    await sql`DELETE FROM products`;
  } else {
    await writeJsonFile(dataFilePath, []);
  }
}

/**
 * Crea o actualiza un producto. Con `keepImage` no se toca la foto que ya
 * tenía (si el producto es nuevo, queda sin foto).
 */
export async function saveProduct(product: Product, options: { keepImage?: boolean } = {}) {
  await createTable();
  const attrsJson = product.attributes ? JSON.stringify(product.attributes) : null;
  const discount = product.discountPrice ?? null;

  if (hasPostgres) {
    if (options.keepImage) {
      const updated = await sql`
        UPDATE products SET
          name = ${product.name}, description = ${product.description}, price = ${product.price}, cost = ${product.cost},
          "discountPrice" = ${discount}, stock = ${product.stock}, category = ${product.category}, attributes = ${attrsJson}::jsonb
        WHERE id = ${product.id}
      `;
      if ((updated.rowCount ?? 0) > 0) return;
    }
    const image = options.keepImage ? '' : product.image;
    await sql`
      INSERT INTO products (id, name, description, price, cost, "discountPrice", stock, category, image, image_version, attributes)
      VALUES (${product.id}, ${product.name}, ${product.description}, ${product.price}, ${product.cost}, ${discount}, ${product.stock}, ${product.category}, ${image}, ${imageVersion(image)}, ${attrsJson}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        cost = EXCLUDED.cost,
        "discountPrice" = EXCLUDED."discountPrice",
        stock = EXCLUDED.stock,
        category = EXCLUDED.category,
        image = EXCLUDED.image,
        image_version = EXCLUDED.image_version,
        attributes = EXCLUDED.attributes;
    `;
    return;
  }

  const products = await readJsonFile<Product[]>(dataFilePath, []);
  const index = products.findIndex((p) => String(p.id) === product.id);
  const image = options.keepImage ? (index >= 0 ? products[index].image : '') : product.image;
  const stored = { ...product, image };
  if (index >= 0) {
    products[index] = stored;
  } else {
    products.push(stored);
  }
  await writeJsonFile(dataFilePath, products);
}

export async function deleteProduct(id: string) {
  await createTable();
  if (hasPostgres) {
    await sql`DELETE FROM products WHERE id = ${id}`;
  } else {
    const products = await readJsonFile<Product[]>(dataFilePath, []);
    await writeJsonFile(dataFilePath, products.filter((p) => String(p.id) !== id));
  }
}

// --- Ajustes de la tienda (aviso de la barra superior, árbol de categorías) ---

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
