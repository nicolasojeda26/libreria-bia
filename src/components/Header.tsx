"use client";

import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import CartIcon from "./CartIcon";
import { categoryHref, type CategoryTree } from "@/lib/categories";

/** Permite cortar los nombres largos después de cada barra ("Lápices/Portaminas/…"). */
function Breakable({ text }: { text: string }) {
  const parts = text.split("/");
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ));
}

function SearchForm({ id, onSubmit, autoFocus }: { id: string; onSubmit?: () => void; autoFocus?: boolean }) {
  return (
    <Form action="/productos" onSubmit={onSubmit} role="search" className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink" aria-hidden="true" />
      <input
        id={id}
        name="q"
        type="search"
        required
        autoFocus={autoFocus}
        placeholder="¿Qué estás buscando?"
        className="h-11 w-full rounded-[20px] bg-white pl-10 pr-4 text-base font-bold text-ink placeholder:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
    </Form>
  );
}

export default function Header({ categories }: { categories: CategoryTree }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), 260);
  };
  const closeAll = () => {
    cancelClose();
    setMenuOpen(false);
    setDrawerOpen(false);
    setSearchOpen(false);
  };

  // Escape y clic afuera cierran el menú de artículos.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  // Con el menú lateral abierto no se desplaza la página de fondo.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <header className="sticky top-0 z-40 bg-page">
      <div className="mx-auto flex max-w-[1340px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-10 lg:py-3.5">
        <Link href="/" onClick={closeAll} aria-label="Librería Bia, ir al inicio" className="shrink-0">
          <Image src="/logo.jpg" alt="Librería Bia" width={85} height={85} priority className="size-[50px] lg:size-[76px]" />
        </Link>

        {/* Escritorio */}
        <div className="hidden items-center gap-1 lg:flex">
          <nav aria-label="Navegación principal" className="flex items-center">
            <Link href="/" className="px-2.5 py-2 text-base font-bold uppercase text-ink">
              Inicio
            </Link>
            <div ref={menuRef} onMouseEnter={() => { cancelClose(); setMenuOpen(true); }} onMouseLeave={scheduleClose}>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="menu-articulos"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-base font-bold uppercase text-ink"
              >
                Artículos
                <ChevronDown className={`size-4 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  id="menu-articulos"
                  className="animate-panel-in absolute right-10 top-full z-50 w-[min(900px,calc(100vw-5rem))] bg-white px-6 pb-6 pt-7 shadow-panel"
                >
                  <Link href="/productos" onClick={closeAll} className="flex items-baseline gap-2 border-b border-line pb-5 text-ink">
                    <span className="text-xl font-bold uppercase">Artículos</span>
                    <span className="text-xs font-bold uppercase text-muted">(Ver todo)</span>
                  </Link>
                  <div className="mt-6 columns-4 gap-8">
                    {categories.map((parent) => (
                      <div key={parent.slug} className="mb-5 break-inside-avoid">
                        <Link href={categoryHref(parent)} onClick={closeAll} className="block py-1 text-sm font-bold leading-snug text-ink hover:text-brand">
                          <Breakable text={parent.name} />
                        </Link>
                        {parent.children.length > 0 && (
                          <ul className="mt-1">
                            {parent.children.map((child) => (
                              <li key={child.slug}>
                                <Link
                                  href={categoryHref(parent, child)}
                                  onClick={closeAll}
                                  className="block py-1 text-sm font-bold leading-snug text-[#6f6f6f] hover:text-brand"
                                >
                                  <Breakable text={child.name} />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <a href="#contacto" className="px-2.5 py-2 text-base font-bold uppercase text-ink">
              Contacto
            </a>
          </nav>
          <div className="ml-2 w-[285px]">
            <SearchForm id="buscar-escritorio" />
          </div>
          <div className="ml-1">
            <CartIcon />
          </div>
        </div>

        {/* Celular y tablet */}
        <div className="flex items-center lg:hidden">
          <button
            type="button"
            aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar productos"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
            className="flex size-11 items-center justify-center text-ink"
          >
            {searchOpen ? <X className="size-6" aria-hidden="true" /> : <Search className="size-6" strokeWidth={1.9} aria-hidden="true" />}
          </button>
          <CartIcon />
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="flex size-11 items-center justify-center text-ink"
          >
            <Menu className="size-6" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="animate-fade-in px-4 pb-3 sm:px-6 lg:hidden">
          <SearchForm id="buscar-celular" autoFocus onSubmit={() => setSearchOpen(false)} />
        </div>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} className="animate-fade-in absolute inset-0 bg-black/50" />
          <div className="animate-drawer-in absolute inset-y-0 left-0 flex w-[min(86vw,360px)] flex-col overflow-y-auto bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="text-lg font-bold uppercase">Menú</span>
              <button type="button" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} className="flex size-11 items-center justify-center">
                <X className="size-6" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Navegación" className="px-5 py-3">
              <Link href="/" onClick={closeAll} className="flex min-h-12 items-center text-base font-bold uppercase">
                Inicio
              </Link>
              <Link href="/productos" onClick={closeAll} className="flex min-h-12 items-center text-base font-bold uppercase">
                Artículos <span className="ml-2 text-xs text-muted">(Ver todo)</span>
              </Link>
              <ul className="border-y border-line py-2">
                {categories.map((parent) => {
                  const isOpen = expanded === parent.slug;
                  const hasChildren = parent.children.length > 0;
                  return (
                    <li key={parent.slug}>
                      <div className="flex items-center">
                        <Link href={categoryHref(parent)} onClick={closeAll} className="flex min-h-11 flex-1 items-center text-[15px] font-bold">
                          {parent.name}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            aria-label={`${isOpen ? "Ocultar" : "Mostrar"} subcategorías de ${parent.name}`}
                            aria-expanded={isOpen}
                            onClick={() => setExpanded(isOpen ? null : parent.slug)}
                            className="flex size-11 items-center justify-center"
                          >
                            <ChevronDown className={`size-5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {hasChildren && isOpen && (
                        <ul className="mb-2 border-l-2 border-brand pl-4">
                          {parent.children.map((child) => (
                            <li key={child.slug}>
                              <Link href={categoryHref(parent, child)} onClick={closeAll} className="flex min-h-11 items-center text-[15px] font-medium text-[#555555]">
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
              <a href="#contacto" onClick={closeAll} className="flex min-h-12 items-center text-base font-bold uppercase">
                Contacto
              </a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
