"use client";

import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { CategoryTree } from "@/lib/categories";
import { CATEGORY_SEPARATOR } from "@/lib/categories";

// Piezas compartidas del panel: botones, campos, avisos y diálogos.

export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(value) || 0).replace(/\s/g, "");

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  loading?: boolean;
};

const buttonStyles = {
  primary: "bg-brand text-white hover:bg-brand-dark disabled:bg-brand/50",
  secondary: "border border-[#cdd5e3] bg-white text-[#1f2937] hover:bg-[#f4f6fb] disabled:opacity-50",
  ghost: "text-[#4b5563] hover:bg-[#eef1f7] disabled:opacity-50",
  danger: "bg-[#b3261e] text-white hover:bg-[#8f1d17] disabled:opacity-50",
};

export function Button({ variant = "secondary", size = "md", loading, className = "", children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${
        size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-11 px-4 text-sm"
      } ${buttonStyles[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({ label, className = "", children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[#4b5563] transition-colors duration-150 hover:bg-[#eef1f7] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-lg border border-[#cdd5e3] bg-white px-3 text-[15px] text-[#111827] placeholder:text-[#9aa3b2] transition-shadow duration-150 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/20 disabled:bg-[#f4f6fb] disabled:text-[#6b7280]";

export function Field({ label, hint, error, children, className = "" }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-[#374151]">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] font-medium text-[#b3261e]" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px] text-[#6b7280]">{hint}</span>
      ) : null}
    </label>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-[#dfe4ee] bg-white ${className}`}>{children}</div>;
}

/** Selector de categoría agrupado por categoría principal. */
export function CategorySelect({
  tree,
  value,
  onChange,
  emptyLabel = "Sin categoría",
  extra,
  id,
  className = "",
}: {
  tree: CategoryTree;
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  extra?: { value: string; label: string }[];
  id?: string;
  className?: string;
}) {
  const known = new Set<string>(["", ...(extra ?? []).map((item) => item.value)]);
  for (const parent of tree) {
    known.add(parent.name);
    for (const child of parent.children) known.add(`${parent.name}${CATEGORY_SEPARATOR}${child.name}`);
  }
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} ${className}`}>
      <option value="">{emptyLabel}</option>
      {(extra ?? []).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
      {!known.has(value) && <option value={value}>{value} (no está en el menú)</option>}
      {tree.map((parent) =>
        parent.children.length === 0 ? (
          <option key={parent.slug} value={parent.name}>
            {parent.name}
          </option>
        ) : (
          <optgroup key={parent.slug} label={parent.name}>
            <option value={parent.name}>{parent.name} (general)</option>
            {parent.children.map((child) => (
              <option key={child.slug} value={`${parent.name}${CATEGORY_SEPARATOR}${child.name}`}>
                {child.name}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}

// --- Ventanas ---

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={onClose} className="animate-fade-in absolute inset-0 cursor-default bg-[#0f172a]/50" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`animate-panel-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-panel outline-none sm:rounded-2xl ${width}`}
        style={{ transformOrigin: "center" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#e5e9f2] px-5 py-3.5">
          <h2 id={titleId} className="text-base font-bold text-[#111827]">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[#e5e9f2] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

// --- Avisos breves (toasts) y confirmaciones ---

type Toast = { id: number; text: string; kind: "ok" | "error" };
type ConfirmOptions = { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean };
type Feedback = {
  toast: (text: string, kind?: "ok" | "error") => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback necesita FeedbackProvider");
  return value;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const toast = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = ++counter.current;
    // Un mismo aviso repetido reemplaza al anterior en vez de apilarse.
    setToasts((current) => [...current.filter((item) => item.text !== text).slice(-1), { id, text, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);

  const answer = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className={`animate-panel-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-panel ${
              item.kind === "error" ? "bg-[#8f1d17]" : "bg-[#111827]"
            }`}
            style={{ transformOrigin: "top center" }}
          >
            {item.kind === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#7ee2a8]" aria-hidden="true" />}
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {pending && (
        <Modal
          title={pending.title}
          onClose={() => answer(false)}
          footer={
            <>
              <Button onClick={() => answer(false)}>Cancelar</Button>
              <Button variant={pending.danger ? "danger" : "primary"} onClick={() => answer(true)} autoFocus>
                {pending.confirmLabel ?? "Confirmar"}
              </Button>
            </>
          }
        >
          <div className="text-[15px] leading-relaxed text-[#374151]">{pending.message}</div>
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
}
