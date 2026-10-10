import Link from "next/link";

export type Pill = { label: string; href: string; active?: boolean };

/** Fila de accesos a categorías; en celular se desplaza de costado. */
export default function CategoryPills({ items, label }: { items: Pill[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 sm:mx-0">
      <ul className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:justify-center sm:px-0">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex min-h-11 items-center whitespace-nowrap rounded-[20px] border px-4 text-sm font-medium uppercase transition-colors duration-150 ${
                item.active ? "border-brand bg-brand text-white" : "border-brand bg-white text-brand hover:bg-brand hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
