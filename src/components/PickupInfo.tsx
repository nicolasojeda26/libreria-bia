import { DELIVERY_METHODS } from "@/lib/site";

/** Recordatorio de las tres formas de retirar un pedido. */
export default function PickupInfo({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="formas-de-retiro" className={compact ? "" : "mx-auto max-w-[1340px] px-4 pb-16 sm:px-6 lg:px-10"}>
      <div className="bg-white px-5 py-8 shadow-card sm:px-10 sm:py-10">
        <p className="text-center text-xs font-bold uppercase tracking-[0.32em] text-brand">Recordatorio</p>
        <h2 id="formas-de-retiro" className="mx-auto mt-3 max-w-xl text-balance text-center text-xl font-bold uppercase tracking-[0.06em] sm:text-2xl">
          Tenés 3 formas de retirar un pedido
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          {DELIVERY_METHODS.map((method, index) => (
            <li key={method.id} className="flex gap-4 md:flex-col md:items-center md:gap-3 md:px-6 md:text-center">
              <span className="font-serif text-4xl font-bold leading-none text-brand" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-bold uppercase leading-snug">{method.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{method.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
