"use client";

import Image from "next/image";
import { ExternalLink, FolderTree, LayoutDashboard, LogOut, Package, Store, UserRound } from "lucide-react";
import type { Section } from "./types";

const NAV: { id: Section; label: string; short: string; icon: typeof Package }[] = [
  { id: "inicio", label: "Inicio", short: "Inicio", icon: LayoutDashboard },
  { id: "productos", label: "Productos", short: "Productos", icon: Package },
  { id: "categorias", label: "Categorías", short: "Categorías", icon: FolderTree },
  { id: "tienda", label: "Mi tienda", short: "Tienda", icon: Store },
  { id: "cuenta", label: "Mi cuenta", short: "Cuenta", icon: UserRound },
];

type Props = {
  section: Section;
  onNavigate: (section: Section) => void;
  user: string;
  productCount: number;
  onLogout: () => void;
  children: React.ReactNode;
};

export default function Shell({ section, onNavigate, user, productCount, onLogout, children }: Props) {
  return (
    <div className="lg:pl-60">
      {/* Menú lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#dfe4ee] bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-[#e5e9f2] px-5 py-4">
          <Image src="/logo.jpg" alt="" width={40} height={40} className="size-10" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-bold">Librería Bia</p>
            <p className="text-xs text-[#6b7280]">Panel de administración</p>
          </div>
        </div>

        <nav aria-label="Secciones del panel" className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors duration-150 ${
                  active ? "bg-brand text-white" : "text-[#374151] hover:bg-[#eef1f7]"
                }`}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {id === "productos" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-[#eef1f7] text-[#4b5563]"}`}>{productCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-[#e5e9f2] p-3">
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-brand hover:bg-[#eef1f7]">
            <ExternalLink className="size-[18px]" aria-hidden="true" />
            Ver mi tienda
          </a>
          <div className="flex items-center justify-between gap-2 px-3 py-1">
            <span className="truncate text-sm text-[#4b5563]">{user}</span>
            <button type="button" onClick={onLogout} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-[#4b5563] hover:bg-[#eef1f7]">
              <LogOut className="size-4" aria-hidden="true" />
              Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#dfe4ee] bg-white px-4 py-2.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image src="/logo.jpg" alt="" width={36} height={36} className="size-9" />
          <p className="truncate text-[15px] font-bold">{NAV.find((item) => item.id === section)?.label}</p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-brand">
          <ExternalLink className="size-4" aria-hidden="true" />
          Ver tienda
        </a>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>

      {/* Barra inferior (celular) */}
      <nav aria-label="Secciones del panel" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#dfe4ee] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(({ id, short, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-brand" : "text-[#6b7280]"}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {short}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
