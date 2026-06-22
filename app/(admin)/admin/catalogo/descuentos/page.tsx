import { CatalogSectionPage } from "../../../../../src/modules/catalogo/catalog-section-page";

export default function DescuentosPage() {
  return (
    <CatalogSectionPage
      title="Descuentos"
      description="Administra reducciones, promociones y reglas comerciales aplicables al catalogo."
      items={[
        "Descuentos por producto, categoria o combinacion.",
        "Reglas de vigencia y prioridad.",
        "Revision de impacto antes de activar promociones masivas.",
      ]}
    />
  );
}
