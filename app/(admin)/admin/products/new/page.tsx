import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { ProductEditorPage } from "../../../../../src/modules/catalogo/product-editor-page";

type NewAdminProductPageProps = {
  searchParams?: Promise<{
    duplicateFrom?: string;
  }>;
};

export default async function NewAdminProductPage({ searchParams }: NewAdminProductPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;

  return <ProductEditorPage context={context} duplicateFromProductId={params?.duplicateFrom} />;
}
