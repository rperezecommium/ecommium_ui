import { CatalogSectionPage } from "../../../../../src/modules/catalogo/catalog-section-page";

export default function OfferingsPage() {
  return (
    <CatalogSectionPage
      title="Offerings / Servicios adicionales"
      description="Configura servicios vendibles asociados al producto, packs, garantias o add-ons comerciales."
      items={[
        "Servicios adicionales seleccionables en la compra.",
        "Relacion comercial con producto o combinacion.",
        "Preparado para reglas de disponibilidad y precio.",
      ]}
    />
  );
}
