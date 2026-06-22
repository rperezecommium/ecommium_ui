import { CatalogSectionPage } from "../../../../../src/modules/catalogo/catalog-section-page";

export default function CatalogoMediaPage() {
  return (
    <CatalogSectionPage
      title="Media / Archivos"
      description="Biblioteca operativa de imagenes, documentos y assets usados por productos y combinaciones."
      items={[
        "Colecciones de imagenes por producto.",
        "Portadas, orden, captions localizados y estado activo.",
        "Asignacion de imagenes a combinaciones desde el editor.",
      ]}
    />
  );
}
