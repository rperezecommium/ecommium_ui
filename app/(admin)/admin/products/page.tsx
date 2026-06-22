import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { ProductListPage } from "../../../../src/modules/catalogo/product-list-page";
import { getAdminProducts } from "../../../../src/modules/catalogo/products";
import { listCatalogEntities, toLookupOptions } from "../../../../src/modules/catalogo/catalog-taxonomy";
import type { ProductListFilters } from "../../../../src/modules/catalogo/product-editor-types";

type AdminProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    categoryId?: string;
    limit?: string;
    offset?: string;
    isActive?: string;
  }>;
};

function numberParam(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed), 200) : fallback;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const context = await getAdminContext();
  const params = await searchParams;
  const filters: ProductListFilters = {
    q: params?.q,
    categoryId: params?.categoryId,
    limit: numberParam(params?.limit, 20),
    offset: numberParam(params?.offset, 0),
    isActive: params?.isActive === "true" ? true : undefined,
  };
  const [products, categoriesResult] = await Promise.all([
    getAdminProducts(context, filters),
    listCatalogEntities(context, "categories", { limit: 100, offset: 0, isActive: true }),
  ]);

  return <ProductListPage context={context} products={products} categories={toLookupOptions(categoriesResult)} />;
}
