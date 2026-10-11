"use client";

import { Megaphone } from "lucide-react";
import { useState } from "react";
import { SITE } from "@/lib/site";
import { api } from "./api";
import { Button, Card, Field, inputClass, useFeedback } from "./ui";

const MAX = 160;

export default function StoreView({ notice, onNoticeChange, onError }: { notice: string; onNoticeChange: (notice: string) => void; onError: (error: unknown) => void }) {
  const { toast } = useFeedback();
  const [draft, setDraft] = useState(notice);
  const [saving, setSaving] = useState(false);
  const preview = draft.replace(/\s+/g, " ").trim();

  const save = async (value: string) => {
    setSaving(true);
    try {
      const data = await api<{ notice: string }>("/api/settings", { method: "PUT", body: { notice: value } });
      onNoticeChange(data.notice);
      setDraft(data.notice);
      toast(data.notice ? "Aviso publicado en la tienda." : "Aviso quitado de la tienda.");
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mi tienda</h1>
        <p className="mt-1 text-[15px] text-[#4b5563]">Lo que ven tus clientes arriba de todo.</p>
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Megaphone className="size-4 text-brand" aria-hidden="true" /> Aviso del día
        </h2>
        <p className="mt-1 text-[15px] text-[#4b5563]">Un mensaje corto que aparece debajo de la bienvenida. Por ejemplo: “Mañana hago entregas en el Campus Roca”.</p>

        <Field label="Texto del aviso" hint={`${draft.length} de ${MAX} caracteres. Dejalo vacío para no mostrar ningún aviso.`} className="mt-4">
          <textarea className={`${inputClass} py-2.5`} rows={2} maxLength={MAX} value={draft} onChange={(event) => setDraft(event.target.value)} />
        </Field>

        <p className="mb-1.5 mt-5 text-[13px] font-semibold text-[#374151]">Así se ve en la tienda</p>
        <div className="overflow-hidden rounded-lg border border-[#dfe4ee]">
          <p className="bg-brand px-4 py-2.5 text-center text-sm text-white">{SITE.welcome}</p>
          {preview ? (
            <p className="flex items-center justify-center gap-2 bg-rosa px-4 py-2 text-center text-sm font-bold">
              <Megaphone className="size-4 shrink-0" aria-hidden="true" />
              {preview}
            </p>
          ) : (
            <p className="bg-white px-4 py-2 text-center text-[13px] text-[#6b7280]">Sin aviso</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" loading={saving} disabled={preview === notice} onClick={() => save(draft)}>
            {preview ? "Publicar aviso" : "Guardar"}
          </Button>
          {notice && (
            <Button disabled={saving} onClick={() => save("")}>
              Quitar aviso
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-bold">Datos de contacto</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[auto_1fr]">
          <dt className="text-[#6b7280]">Email</dt>
          <dd>{SITE.email}</dd>
          <dt className="text-[#6b7280]">WhatsApp</dt>
          <dd>{SITE.whatsappDisplay}</dd>
          <dt className="text-[#6b7280]">Dirección</dt>
          <dd>{SITE.address}</dd>
          <dt className="text-[#6b7280]">Instagram</dt>
          <dd>@libreria.bia</dd>
        </dl>
        <p className="mt-3 text-[13px] text-[#6b7280]">Estos datos, las formas de retiro y los medios de pago todavía se cambian desde el código de la tienda.</p>
      </Card>
    </div>
  );
}
