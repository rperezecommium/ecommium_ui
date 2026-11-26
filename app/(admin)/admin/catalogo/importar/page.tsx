import Link from "next/link";
import { CatalogCsvImportClient } from "../../../../../src/modules/catalogo/catalog-csv-import-client";
import { listCatalogEntities, toLookupOptions } from "../../../../../src/modules/catalogo/catalog-taxonomy";
import { getAdminContext, hasRequiredAdminContext } from "../../../../../src/shared/config/admin-context";

export default async function CatalogImportPage() {
  const context = await getAdminContext();
  const hasContext = hasRequiredAdminContext(context);
  const categories = hasContext
    ? await listCatalogEntities(context, "categories", { limit: 100, offset: 0, isActive: true })
    : null;

  return (
    <main className="adminPage">
      <div className="adminBreadcrumb">Admin / Catalogo / Importar</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Importar</h1>
          <p className="adminPageIntro">Carga tu archivo, asigna las categorías y revisa las opciones de importación.</p>
        </div>
      </div>
      {hasContext && categories ? (
        <CatalogCsvImportClient context={context} categories={toLookupOptions(categories)} />
      ) : (
        <div className="adminBanner adminBannerError">
          <p>Selecciona una organización y una tienda antes de importar productos.</p>
          <Link className="adminButton" href="/admin/configuracion/contexto">Ir a contexto</Link>
        </div>
      )}
    </main>
  );
}
