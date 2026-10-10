# Librería Bia — tienda online

Tienda de Librería Bia hecha con Next.js 16 (App Router), Tailwind 4 y Postgres (Vercel).
Los pedidos se arman en el carrito y se envían por WhatsApp.

## Cómo correrla

```bash
npm install
npm run dev
```

Sin `POSTGRES_URL` usa archivos locales en `data/` (útil para probar). En producción usa la base de Vercel.

### Variables de entorno

| Variable | Para qué sirve |
| --- | --- |
| `POSTGRES_URL` | Base de datos (la define Vercel al conectar Postgres). |
| `SESSION_SECRET` | Opcional pero recomendado: texto largo y aleatorio para firmar la sesión del panel. Si falta, se usa `POSTGRES_URL`. |
| `GOOGLE_SHEET_ID` | Opcional: planilla de respaldo si la base está vacía. |

## Dónde está cada cosa

- `src/lib/site.ts` — contacto, WhatsApp, formas de retiro y medios de pago.
- `src/lib/categories.ts` — árbol de categorías (menú, páginas y selector del panel). Los productos guardan su categoría como `Padre > Hijo`.
- `src/app/globals.css` — colores y tipografías (Poppins + Literata, azul `#446CB3`).
- `src/app/(tienda)/` — páginas de la tienda: inicio, `/productos`, `/categoria/...`, `/producto/[id]`, `/carrito`, `/checkout`.
- `src/app/admin/` — panel de administración.

## Panel de administración (`/admin`)

- Se entra con usuario y contraseña. El primer usuario se crea solo la primera vez; la contraseña se cambia desde **Ajustes → Cambiar contraseña**.
- **Ajustes → Aviso de la tienda**: texto corto que aparece arriba de todo (por ejemplo, “Mañana hago entregas en el Campus Roca”).
- Las contraseñas se guardan con hash (scrypt) y la sesión es una cookie firmada. Toda escritura en `/api/*` exige sesión.
