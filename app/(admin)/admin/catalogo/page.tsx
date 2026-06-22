import Link from "next/link";

export default function CatalogoPage() {
  const catalogAreas = [
    { href: "/admin/products", label: "Productos", description: "Ficha, combinaciones, imagenes, precio y stock." },
    { href: "/admin/catalogo/categorias", label: "Categorias", description: "Arbol comercial y breadcrumbs." },
    { href: "/admin/catalogo/atributos-caracteristicas", label: "Atributos / Caracteristicas", description: "Opciones de combinacion y ficha tecnica." },
    { href: "/admin/catalogo/marcas", label: "Marcas / Proveedores", description: "Fabricantes, proveedores y colecciones." },
    { href: "/admin/catalogo/media", label: "Media / Archivos", description: "Imagenes, documentos y portadas." },
    { href: "/admin/catalogo/precios", label: "Precios", description: "Precio base y overrides por variante." },
    { href: "/admin/catalogo/offerings", label: "Offerings / Servicios adicionales", description: "Servicios vendibles y add-ons." },
    { href: "/admin/catalogo/stock", label: "Stock", description: "Existencias por variante y almacen." },
    { href: "/admin/catalogo/descuentos", label: "Descuentos", description: "Promociones y reducciones comerciales." },
  ];

  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">Admin / Catalogo</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Catalogo</h1>
          <p className="adminPageIntro">
            Gestiona productos, variantes, imagenes y atributos comerciales desde el backoffice.
          </p>
        </div>
        <Link className="adminButton adminButtonPrimary" href="/admin/products/new">
          Anadir producto
        </Link>
      </div>

      <section className="adminCatalogAreaGrid">
        {catalogAreas.map((area) => (
          <Link className="adminCatalogArea" href={area.href} key={area.href}>
            <strong>{area.label}</strong>
            <span>{area.description}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
