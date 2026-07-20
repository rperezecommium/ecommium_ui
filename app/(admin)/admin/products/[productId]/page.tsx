import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { ProductEditorPage } from "../../../../../src/modules/catalogo/product-editor-page";

type ProductDetailRouteProps = {
  params: Promise<{
    productId: string;
  }>;
  searchParams?: Promise<{
    preview?: string;
  }>;
};

export default async function EditAdminProductPage({ params, searchParams }: ProductDetailRouteProps) {
  const context = await getAdminContext();
  const { productId } = await params;
  const query = await searchParams;

  return <ProductEditorPage context={context} productId={productId} initialPreviewOpen={query?.preview === "1"} />;
}
