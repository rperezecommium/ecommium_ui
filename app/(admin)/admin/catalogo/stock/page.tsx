import { CatalogSectionPage } from "../../../../../src/modules/catalogo/catalog-section-page";

export default function StockPage() {
  return (
    <CatalogSectionPage
      title="Stock"
      description="Consulta y ajusta existencias por combinacion, almacen y tienda."
      items={[
        "Stock por variante y almacen.",
        "Cantidad disponible, reservada y stock de seguridad.",
        "Sin mezclar reglas logisticas de transporte con disponibilidad comercial.",
      ]}
    />
  );
}
