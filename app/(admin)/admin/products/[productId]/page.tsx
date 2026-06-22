import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { ProductEditorPage } from "../../../../../src/modules/catalogo/product-editor-page";

type ProductDetailRouteProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function EditAdminProductPage({ params }: ProductDetailRouteProps) {
  const context = await getAdminContext();
  const { productId } = await params;

  return <ProductEditorPage context={context} productId={productId} />;
}
