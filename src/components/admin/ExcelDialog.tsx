"use client";

import { FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { api, errorMessage, UnauthorizedError } from "./api";
import { Button, Modal, useFeedback } from "./ui";

const CHUNK = 10; // tandas chicas: las filas pueden traer fotos

type Mode = "merge" | "replace";

export default function ExcelDialog({ productCount, onClose, onDone, onError }: { productCount: number; onClose: () => void; onDone: () => Promise<void>; onError: (error: unknown) => void }) {
  const { toast } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const busy = progress !== null || status !== "";

  const run = async () => {
    if (!file) return;
    setError("");
    setStatus("Leyendo el archivo…");
    let imported = 0;
    try {
      const { readWorkbook } = await import("@/lib/excel");
      const { rows, photos } = await readWorkbook(file);
      setStatus("");
      setProgress({ done: 0, total: rows.length });

      let created = 0;
      let updated = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const replace = mode === "replace" && i === 0;
        const result = await api<{ created: number; updated: number }>(`/api/products${replace ? "?replace=1" : ""}`, { method: "POST", body: rows.slice(i, i + CHUNK) });
        created += result.created;
        updated += result.updated;
        imported = Math.min(i + CHUNK, rows.length);
        setProgress({ done: imported, total: rows.length });
      }

      await onDone();
      const parts = [created > 0 ? `${created} nuevos` : "", updated > 0 ? `${updated} actualizados` : "", photos > 0 ? `${photos} fotos` : ""].filter(Boolean);
      toast(parts.length > 0 ? `Importación lista: ${parts.join(", ")}.` : "El archivo no tenía productos para importar.");
      onClose();
    } catch (err) {
      if (imported > 0) await onDone().catch(() => {});
      if (err instanceof UnauthorizedError) return onError(err);
      setError(imported > 0 ? `${errorMessage(err)} Se llegaron a importar ${imported} filas; podés volver a subir el mismo archivo.` : errorMessage(err));
      setProgress(null);
      setStatus("");
    }
  };

  const option = (value: Mode, title: string, detail: string) => (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 ${mode === value ? "border-brand bg-[#eef3fb]" : "border-[#cdd5e3]"} ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <input type="radio" name="import-mode" checked={mode === value} onChange={() => setMode(value)} className="mt-1 size-4 accent-[#446cb3]" />
      <span className="text-sm leading-snug">
        <strong className="block">{title}</strong>
        <span className="text-[#4b5563]">{detail}</span>
      </span>
    </label>
  );

  return (
    <Modal
      title="Importar productos desde Excel"
      width="max-w-lg"
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant={mode === "replace" ? "danger" : "primary"} disabled={!file} loading={busy} onClick={run}>
            {mode === "replace" ? "Reemplazar catálogo" : "Importar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError("");
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files[0];
            if (dropped) {
              setFile(dropped);
              setError("");
            }
          }}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors duration-150 ${dragging ? "border-brand bg-[#eef3fb]" : "border-[#cdd5e3] hover:border-brand"}`}
        >
          <FileSpreadsheet className="size-8 text-brand" strokeWidth={1.5} aria-hidden="true" />
          {file ? (
            <>
              <span className="max-w-full truncate text-[15px] font-semibold">{file.name}</span>
              <span className="text-[13px] text-[#6b7280]">Tocá para elegir otro archivo</span>
            </>
          ) : (
            <>
              <span className="text-[15px] font-semibold">Elegí el archivo o arrastralo acá</span>
              <span className="text-[13px] text-[#6b7280]">Excel (.xlsx, .xls) o CSV</span>
            </>
          )}
        </button>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-semibold text-[#374151]">¿Qué hacemos con los productos que ya están?</legend>
          {option("merge", "Agregar y actualizar", "Los códigos que ya existen se actualizan solo con las columnas del archivo; el resto se crea. No se borra nada.")}
          {option("replace", "Reemplazar todo el catálogo", `Se eliminan los ${productCount} productos actuales y queda solo lo que trae el archivo.`)}
        </fieldset>

        <p className="text-[13px] leading-relaxed text-[#6b7280]">
          Columnas que se reconocen: Código, Producto, Descripción, Categoría, Precio, Oferta, Costo, Stock e Imagen. Para cambiar solo precios alcanza con Código y Precio. Las fotos pegadas en las celdas de un .xlsx también se importan.
        </p>

        {(progress || status) && (
          <div role="status">
            <div className="h-2 overflow-hidden rounded-full bg-[#e5e9f2]">
              <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: progress ? `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` : "4%" }} />
            </div>
            <p className="mt-1.5 text-[13px] font-medium text-[#374151]">{progress ? `Importando ${progress.done} de ${progress.total}…` : status}</p>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-[#fdecea] px-3 py-2.5 text-sm font-medium text-[#8f1d17]" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
