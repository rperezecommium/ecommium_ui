import Link from "next/link";

type CatalogSectionPageProps = {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  items: string[];
};

export function CatalogSectionPage({
  title,
  description,
  primaryHref = "/admin/products",
  primaryLabel = "Volver a productos",
  items,
}: CatalogSectionPageProps) {
  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">Admin / Catalogo / {title}</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">{title}</h1>
          <p className="adminPageIntro">{description}</p>
        </div>
        <Link className="adminButton" href={primaryHref}>
          {primaryLabel}
        </Link>
      </div>

      <section className="adminCard">
        <div className="adminCardHeader">
          <div>
            <h2>Gestion comercial</h2>
            <p>Entrada preparada para conectar el contrato BFF correspondiente sin exponer servicios internos.</p>
          </div>
        </div>
        <ul className="adminPlainList">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
