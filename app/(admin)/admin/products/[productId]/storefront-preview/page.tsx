import type { Metadata } from "next";
import { getAdminContext } from "../../../../../../src/shared/config/admin-context";
import { ProductStorefrontPreviewPage } from "../../../../../../src/modules/catalogo/product-storefront-preview-page";

export const metadata: Metadata = {
  title: "Preview Storefront de producto",
  robots: {
    index: false,
    follow: false,
  },
};

type ProductStorefrontPreviewRouteProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function AdminProductStorefrontPreviewRoute({ params }: ProductStorefrontPreviewRouteProps) {
  const context = await getAdminContext();
  const { productId } = await params;

  return <ProductStorefrontPreviewPage context={context} productId={productId} />;
}
