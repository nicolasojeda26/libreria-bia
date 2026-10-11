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
- `src/lib/categories.ts` — árbol de categorías inicial y funciones para trabajar con él. El árbol vigente se guarda en la base (ajuste `categories`) y se edita desde el panel. Los productos guardan su categoría como `Padre > Hijo`.
- `src/lib/db.ts` — productos, ajustes y fotos. `src/lib/store.ts` — consultas de la tienda.
- `src/app/globals.css` — colores y tipografías (Poppins + Literata, azul `#446CB3`).
- `src/app/(tienda)/` — páginas de la tienda: inicio, `/productos`, `/categoria/...`, `/producto/[id]`, `/carrito`, `/checkout`.
- `src/app/admin/` y `src/components/admin/` — panel de administración.

## Panel de administración (`/admin`)

Se entra con usuario y contraseña. El primer usuario se crea solo la primera vez; la contraseña se cambia desde **Mi cuenta**.

- **Inicio** — resumen: productos sin stock, con stock bajo, sin foto o sin categoría, valor del inventario y aviso publicado.
- **Productos** — búsqueda, filtros y orden. El precio y el stock se editan tocándolos en el listado. Con la selección múltiple se puede cambiar la categoría, ajustar precios por porcentaje o eliminar varios a la vez.
- **Editor de producto** — foto (arrastrar, elegir o pegar; se comprime en el navegador), nombre, categoría, descripción, precio, precio de oferta, costo, stock y colores con stock y precio propios.
- **Categorías** — crear, renombrar, ordenar y eliminar categorías y subcategorías. Al renombrar, el nombre anterior queda como alias y los productos no se tocan. No se puede eliminar una categoría que todavía tiene productos.
- **Mi tienda** — aviso corto que aparece arriba de todo (por ejemplo, “Mañana hago entregas en el Campus Roca”).
- **Importar / Exportar Excel** — la importación puede *agregar y actualizar* (solo las columnas que trae el archivo, por código) o *reemplazar todo*. La exportación usa las mismas columnas.

### Notas técnicas

- Las contraseñas se guardan con hash (scrypt) y la sesión es una cookie firmada. Toda escritura en `/api/*` exige sesión.
- Las fotos subidas desde el panel se guardan en la base y se sirven por `/api/products/<id>/image/<versión>` con caché larga; nunca viajan dentro de los listados.
