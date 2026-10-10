import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="section-title">No encontramos esa página</h1>
      <p className="mt-4 text-muted">Puede que el producto ya no esté disponible o que el enlace haya cambiado.</p>
      <Link href="/productos" className="btn-serif mt-8">
        Ver todos los productos
      </Link>
    </section>
  );
}
