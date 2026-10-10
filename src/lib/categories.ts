// Árbol de categorías de la tienda. Es la única fuente de verdad del menú,
// de las páginas de categoría y del selector del panel de administración.
//
// En la base, cada producto guarda su categoría como texto "Padre > Hijo".
// `resolveCategory` reconoce también los nombres viejos (con guiones, sin
// tildes o con errores de tipeo) para no tener que migrar la base.

export type CategoryChild = {
  name: string;
  slug: string;
  aliases?: string[];
};

export type CategoryNode = {
  name: string;
  slug: string;
  aliases?: string[];
  children: CategoryChild[];
};

export const CATEGORY_SEPARATOR = " > ";

export const CATEGORY_TREE: CategoryNode[] = [
  {
    name: "Tamaño A4 - Oficio",
    slug: "tamano-a4-oficio",
    children: [
      { name: "Blocks", slug: "blocks" },
      { name: "Biblioratos", slug: "biblioratos" },
      { name: "Carpetas", slug: "carpetas" },
      { name: "Cuadernillos", slug: "cuadernillos", aliases: ["Cuadernilos"] },
      { name: "Folios", slug: "folios" },
      { name: "Separadores", slug: "separadores" },
      { name: "Sobres", slug: "sobres" },
      { name: "Resmas", slug: "resmas" },
      { name: "Repuestos", slug: "repuestos" },
    ],
  },
  { name: "Tamaño A5", slug: "tamano-a5", children: [] },
  {
    name: "Tamaño N3",
    slug: "tamano-n3",
    children: [
      { name: "Cuadernos", slug: "cuadernos" },
      { name: "Carpetas", slug: "carpetas" },
      { name: "Mapas", slug: "mapas" },
      { name: "Separadores/Repuestos", slug: "separadores-repuestos" },
    ],
  },
  {
    name: "Tamaño N5 - N6",
    slug: "tamano-n5-n6",
    children: [
      { name: "Carpeta", slug: "carpeta" },
      { name: "Mapas", slug: "mapas" },
      { name: "Block de Dibujo", slug: "block-de-dibujo" },
      { name: "Repuestos", slug: "repuestos" },
    ],
  },
  {
    name: "Escritura",
    slug: "escritura",
    children: [
      { name: "Lápices/Portaminas/Crayones", slug: "lapices-portaminas-crayones" },
      { name: "Borradores/Sacapuntas", slug: "borradores-sacapuntas" },
      { name: "Resaltadores/Microfibras", slug: "resaltadores-microfibras" },
      { name: "Marcadores", slug: "marcadores" },
      { name: "Biromes y Correctores", slug: "biromes-y-correctores" },
    ],
  },
  {
    name: "Combos",
    slug: "combos",
    children: [
      { name: "Combos Simples", slug: "combos-simples", aliases: ["Simples"] },
      { name: "Combos con Cuadernillo", slug: "combos-con-cuadernillo", aliases: ["Con Cuadernillo"] },
      { name: "Combos por Color", slug: "combos-por-color", aliases: ["Por Color"] },
    ],
  },
  { name: "Adhesivos", slug: "adhesivos", children: [] },
  { name: "Set de Geometría", slug: "set-de-geometria", children: [] },
  { name: "Oficina", slug: "oficina", children: [] },
  { name: "Cartucheras/Sobres", slug: "cartucheras-sobres", aliases: ["Cartucheras"], children: [] },
  { name: "Papelería", slug: "papeleria", children: [] },
  { name: "Témperas/Pincel/Plastilinas", slug: "temperas-pincel-plastilinas", children: [] },
  { name: "Notas Adhesivas/Anotadores", slug: "notas-adhesivas-anotadores", children: [] },
];

/** Minúsculas, sin tildes y con cualquier separador convertido en un espacio. */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matches(node: { name: string; aliases?: string[] }, key: string): boolean {
  return normalizeKey(node.name) === key || (node.aliases ?? []).some((alias) => normalizeKey(alias) === key);
}

export type ResolvedCategory = { parent: CategoryNode; child?: CategoryChild };

/** Convierte el texto guardado en un producto en un nodo del árbol. */
export function resolveCategory(raw: string | null | undefined): ResolvedCategory | null {
  if (!raw) return null;
  const [parentRaw, ...rest] = raw.split(">");
  const parentKey = normalizeKey(parentRaw);
  if (!parentKey) return null;
  const parent = CATEGORY_TREE.find((node) => matches(node, parentKey));
  if (!parent) return null;
  const childKey = normalizeKey(rest.join(" "));
  if (!childKey) return { parent };
  const child = parent.children.find((node) => matches(node, childKey));
  return child ? { parent, child } : { parent };
}

export function categoryLabel(resolved: ResolvedCategory): string {
  return resolved.child ? `${resolved.parent.name}${CATEGORY_SEPARATOR}${resolved.child.name}` : resolved.parent.name;
}

/** Nombre canónico de una categoría; si no está en el árbol se deja como vino. */
export function canonicalCategory(raw: string | null | undefined): string {
  const resolved = resolveCategory(raw);
  if (resolved) return categoryLabel(resolved);
  return (raw ?? "").trim();
}

export function categoryHref(parent: CategoryNode, child?: CategoryChild): string {
  return child ? `/categoria/${parent.slug}/${child.slug}` : `/categoria/${parent.slug}`;
}

export function findCategoryBySlug(slugs: string[]): ResolvedCategory | null {
  const [parentSlug, childSlug, ...extra] = slugs;
  if (!parentSlug || extra.length > 0) return null;
  const parent = CATEGORY_TREE.find((node) => node.slug === parentSlug);
  if (!parent) return null;
  if (!childSlug) return { parent };
  const child = parent.children.find((node) => node.slug === childSlug);
  return child ? { parent, child } : null;
}

/** Lista plana de opciones para el selector del panel. */
export function categoryOptions(): { id: string; name: string; slug: string }[] {
  const options: { id: string; name: string; slug: string }[] = [];
  for (const parent of CATEGORY_TREE) {
    options.push({ id: parent.slug, name: parent.name, slug: parent.slug });
    for (const child of parent.children) {
      const slug = `${parent.slug}/${child.slug}`;
      options.push({ id: slug, name: categoryLabel({ parent, child }), slug });
    }
  }
  return options;
}
