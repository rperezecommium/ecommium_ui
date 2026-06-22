import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { ProductEditorPage } from "../../../../../src/modules/catalogo/product-editor-page";

export default async function NewAdminProductPage() {
  const context = await getAdminContext();

  return <ProductEditorPage context={context} />;
}
