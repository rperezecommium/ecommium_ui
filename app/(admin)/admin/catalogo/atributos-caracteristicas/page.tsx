import { CatalogSectionPage } from "../../../../../src/modules/catalogo/catalog-section-page";

export default function AtributosCaracteristicasPage() {
  return (
    <CatalogSectionPage
      title="Atributos / Caracteristicas"
      description="Administra atributos para combinaciones y caracteristicas tecnicas visibles en la ficha."
      items={[
        "Atributos como color, talla o material para generar combinaciones.",
        "Valores controlados para ProductVariantOption.",
        "Caracteristicas reutilizables para comparacion y ficha tecnica.",
      ]}
    />
  );
}
