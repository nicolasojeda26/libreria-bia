// Árbol de categorías de la tienda: menú, páginas de categoría y selector
// del panel. Se guarda en la base y se edita desde el panel; este archivo
// trae el árbol inicial y las funciones puras para trabajar con él.
//
// Cada producto guarda su categoría como texto "Padre > Hijo". Al renombrar
// una categoría, el nombre anterior queda como alias para que los productos
// sigan apareciendo sin tener que tocarlos uno por uno.

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

export type CategoryTree = CategoryNode[];

export const CATEGORY_SEPARATOR = " > ";
export const CATEGORY_NAME_MAX = 60;
export const MAX_CATEGORIES = 60;
export const MAX_SUBCATEGORIES = 40;

export const DEFAULT_CATEGORY_TREE: CategoryTree = [
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

export function slugify(value: string): string {
  return normalizeKey(value).replace(/ /g, "-");
}

function matches(node: { name: string; aliases?: string[] }, key: string): boolean {
  return normalizeKey(node.name) === key || (node.aliases ?? []).some((alias) => normalizeKey(alias) === key);
}

export type ResolvedCategory = { parent: CategoryNode; child?: CategoryChild };

/** Convierte el texto guardado en un producto en un nodo del árbol. */
export function resolveCategory(tree: CategoryTree, raw: string | null | undefined): ResolvedCategory | null {
  if (!raw) return null;
  const [parentRaw, ...rest] = raw.split(">");
  const parentKey = normalizeKey(parentRaw);
  if (!parentKey) return null;
  const parent = tree.find((node) => matches(node, parentKey));
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
export function canonicalCategory(tree: CategoryTree, raw: string | null | undefined): string {
  const resolved = resolveCategory(tree, raw);
  if (resolved) return categoryLabel(resolved);
  return (raw ?? "").trim();
}

export function categoryHref(parent: CategoryNode, child?: CategoryChild): string {
  return child ? `/categoria/${parent.slug}/${child.slug}` : `/categoria/${parent.slug}`;
}

export function findCategoryBySlug(tree: CategoryTree, slugs: string[]): ResolvedCategory | null {
  const [parentSlug, childSlug, ...extra] = slugs;
  if (!parentSlug || extra.length > 0) return null;
  const parent = tree.find((node) => node.slug === parentSlug);
  if (!parent) return null;
  if (!childSlug) return { parent };
  const child = parent.children.find((node) => node.slug === childSlug);
  return child ? { parent, child } : null;
}

function cleanName(value: unknown): string {
  return String(value ?? "")
    .replace(/[>\s]+/g, " ") // ">" es el separador Padre > Hijo
    .trim()
    .slice(0, CATEGORY_NAME_MAX);
}

function uniqueSlug(base: string, used: Set<string>): string {
  const root = base || "categoria";
  let slug = root;
  let n = 2;
  while (used.has(slug)) slug = `${root}-${n++}`;
  used.add(slug);
  return slug;
}

function mergeAliases(name: string, ...lists: (string[] | undefined)[]): string[] | undefined {
  const own = normalizeKey(name);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const alias of lists.flatMap((list) => list ?? [])) {
    const key = normalizeKey(alias);
    if (!key || key === own || seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }
  return result.length > 0 ? result.slice(0, 12) : undefined;
}

type LooseNode = { name?: unknown; slug?: unknown; children?: unknown };

/**
 * Valida y ordena un árbol que llega del panel. Las categorías se reconocen
 * por su `slug`: si a una ya existente le cambió el nombre, el anterior se
 * guarda como alias. Las nuevas reciben un slug a partir del nombre.
 * Devuelve un mensaje de error en español si algo no es válido.
 */
export function sanitizeTree(input: unknown, previous: CategoryTree): { tree: CategoryTree } | { error: string } {
  if (!Array.isArray(input)) return { error: "El árbol de categorías no es válido." };
  if (input.length > MAX_CATEGORIES) return { error: `No se pueden tener más de ${MAX_CATEGORIES} categorías.` };

  // Los slugs de las categorías que ya existían quedan reservados, para que
  // una categoría nueva nunca le saque la dirección a una existente.
  const keptSlugs = (nodes: LooseNode[], known: { slug: string }[]) =>
    new Set(nodes.map((node) => node?.slug).filter((slug): slug is string => typeof slug === "string" && known.some((item) => item.slug === slug)));

  const usedParentSlugs = keptSlugs(input as LooseNode[], previous);
  const claimedParents = new Set<string>();
  const usedParentNames = new Set<string>();
  const tree: CategoryTree = [];

  for (const rawParent of input as LooseNode[]) {
    const name = cleanName(rawParent?.name);
    if (!name) return { error: "Hay una categoría sin nombre." };
    const key = normalizeKey(name);
    if (!key) return { error: `El nombre “${name}” no es válido.` };
    if (usedParentNames.has(key)) return { error: `Ya existe una categoría llamada “${name}”.` };
    usedParentNames.add(key);

    const found = previous.find((node) => node.slug === rawParent?.slug);
    const before = found && !claimedParents.has(found.slug) ? found : undefined;
    if (before) claimedParents.add(before.slug);
    const slug = before ? before.slug : uniqueSlug(slugify(name), usedParentSlugs);
    const aliases = mergeAliases(name, before?.aliases, before && before.name !== name ? [before.name] : undefined);

    const rawChildren = Array.isArray(rawParent?.children) ? (rawParent.children as LooseNode[]) : [];
    if (rawChildren.length > MAX_SUBCATEGORIES) return { error: `“${name}” no puede tener más de ${MAX_SUBCATEGORIES} subcategorías.` };

    const usedChildSlugs = keptSlugs(rawChildren, before?.children ?? []);
    const claimedChildren = new Set<string>();
    const usedChildNames = new Set<string>();
    const children: CategoryChild[] = [];
    for (const rawChild of rawChildren) {
      const childName = cleanName(rawChild?.name);
      if (!childName) return { error: `Hay una subcategoría sin nombre en “${name}”.` };
      const childKey = normalizeKey(childName);
      if (!childKey) return { error: `El nombre “${childName}” no es válido.` };
      if (usedChildNames.has(childKey)) return { error: `“${name}” ya tiene una subcategoría llamada “${childName}”.` };
      usedChildNames.add(childKey);

      const foundChild = before?.children.find((node) => node.slug === rawChild?.slug);
      const childBefore = foundChild && !claimedChildren.has(foundChild.slug) ? foundChild : undefined;
      if (childBefore) claimedChildren.add(childBefore.slug);
      const childSlug = childBefore ? childBefore.slug : uniqueSlug(slugify(childName), usedChildSlugs);
      const childAliases = mergeAliases(childName, childBefore?.aliases, childBefore && childBefore.name !== childName ? [childBefore.name] : undefined);
      children.push(childAliases ? { name: childName, slug: childSlug, aliases: childAliases } : { name: childName, slug: childSlug });
    }

    tree.push(aliases ? { name, slug, aliases, children } : { name, slug, children });
  }

  // Un nombre nuevo no puede chocar con el alias de otra categoría: los
  // productos viejos quedarían asignados a la categoría equivocada.
  for (const node of tree) {
    for (const other of tree) {
      if (node === other) continue;
      if ((other.aliases ?? []).some((alias) => normalizeKey(alias) === normalizeKey(node.name))) {
        other.aliases = other.aliases!.filter((alias) => normalizeKey(alias) !== normalizeKey(node.name));
        if (other.aliases.length === 0) delete other.aliases;
      }
    }
    for (const child of node.children) {
      for (const sibling of node.children) {
        if (child === sibling || !sibling.aliases) continue;
        sibling.aliases = sibling.aliases.filter((alias) => normalizeKey(alias) !== normalizeKey(child.name));
        if (sibling.aliases.length === 0) delete sibling.aliases;
      }
    }
  }

  return { tree };
}

/** Lee un árbol guardado como texto; null si está vacío o dañado. */
export function parseStoredTree(raw: string): CategoryTree | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as CategoryTree;
    if (!Array.isArray(stored)) return null;
    const aliasesOf = (node: { aliases?: unknown }) =>
      Array.isArray(node.aliases) && node.aliases.length > 0 ? { aliases: node.aliases.map(String) } : {};
    return stored
      .filter((node) => node && typeof node.name === "string" && typeof node.slug === "string")
      .map((node) => ({
        name: node.name,
        slug: node.slug,
        ...aliasesOf(node),
        children: (Array.isArray(node.children) ? node.children : [])
          .filter((child) => child && typeof child.name === "string" && typeof child.slug === "string")
          .map((child) => ({ name: child.name, slug: child.slug, ...aliasesOf(child) })),
      }));
  } catch {
    return null;
  }
}
