import Link from "next/link";

export default function ProductNotFound() {
  return <main className="adminPage">
    <div className="adminBreadcrumb">Admin / Catálogo / Productos</div>
    <section className="adminEmptyState">
      <h1>Producto no encontrado</h1>
      <p>Este producto ya no existe o no está disponible en el contexto seleccionado.</p>
      <Link className="adminButton" href="/admin/products">Volver al catálogo</Link>
    </section>
  </main>;
}
