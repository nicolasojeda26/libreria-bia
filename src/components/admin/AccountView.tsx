"use client";

import { KeyRound, LogOut, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "./api";
import { Button, Card, Field, Modal, inputClass, useFeedback } from "./ui";

type Props = { user: string; productCount: number; onLogout: () => void; onCleared: () => void; onError: (error: unknown) => void };

export default function AccountView({ user, productCount, onLogout, onCleared, onError }: Props) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ current: "", next: "", repeat: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearBusy, setClearBusy] = useState(false);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.next.length < 8) return setError("La contraseña nueva tiene que tener al menos 8 caracteres.");
    if (form.next !== form.repeat) return setError("Las contraseñas nuevas no coinciden.");
    setSaving(true);
    try {
      await api("/api/auth", { method: "PUT", body: { currentPassword: form.current, newPassword: form.next } });
      setForm({ current: "", next: "", repeat: "" });
      toast("Contraseña actualizada.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const clearCatalog = async () => {
    setClearBusy(true);
    try {
      await api("/api/products", { method: "DELETE" });
      onCleared();
      setClearing(false);
      setConfirmText("");
      toast("Se eliminaron todos los productos.");
    } catch (err) {
      onError(err);
    } finally {
      setClearBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mi cuenta</h1>
          <p className="mt-1 text-[15px] text-[#4b5563]">
            Sesión iniciada como <strong>{user}</strong>.
          </p>
        </div>
        <Button onClick={onLogout}>
          <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
        </Button>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <KeyRound className="size-4 text-brand" aria-hidden="true" /> Cambiar contraseña
        </h2>
        <form onSubmit={changePassword} className="mt-4 max-w-sm space-y-4">
          <Field label="Contraseña actual">
            <input className={inputClass} type="password" required autoComplete="current-password" value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} />
          </Field>
          <Field label="Contraseña nueva" hint="Mínimo 8 caracteres.">
            <input className={inputClass} type="password" required autoComplete="new-password" value={form.next} onChange={(event) => setForm({ ...form, next: event.target.value })} />
          </Field>
          <Field label="Repetir la contraseña nueva">
            <input className={inputClass} type="password" required autoComplete="new-password" value={form.repeat} onChange={(event) => setForm({ ...form, repeat: event.target.value })} />
          </Field>
          {error && (
            <p className="rounded-lg bg-[#fdecea] px-3 py-2.5 text-sm font-medium text-[#8f1d17]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" loading={saving}>
            Guardar contraseña
          </Button>
        </form>
      </Card>

      <Card className="border-[#f3c5c1] p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#8f1d17]">
          <TriangleAlert className="size-4" aria-hidden="true" /> Vaciar el catálogo
        </h2>
        <p className="mt-1 max-w-xl text-[15px] text-[#4b5563]">Elimina los {productCount} productos de la tienda. No se puede deshacer; antes conviene exportar el catálogo a Excel desde Productos.</p>
        <Button variant="danger" className="mt-4" disabled={productCount === 0} onClick={() => setClearing(true)}>
          Eliminar todos los productos
        </Button>
      </Card>

      {clearing && (
        <Modal
          title="Eliminar todos los productos"
          onClose={() => setClearing(false)}
          footer={
            <>
              <Button onClick={() => setClearing(false)}>Cancelar</Button>
              <Button variant="danger" loading={clearBusy} disabled={confirmText.trim().toUpperCase() !== "ELIMINAR"} onClick={clearCatalog}>
                Eliminar {productCount} productos
              </Button>
            </>
          }
        >
          <p className="text-[15px] leading-relaxed text-[#374151]">
            La tienda va a quedar vacía. Para confirmar, escribí <strong>ELIMINAR</strong>.
          </p>
          <input className={`${inputClass} mt-3`} aria-label="Escribí ELIMINAR para confirmar" autoFocus value={confirmText} onChange={(event) => setConfirmText(event.target.value)} />
        </Modal>
      )}
    </div>
  );
}
