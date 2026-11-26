import {getCurrentAdminSession} from "../../../../src/modules/auth/current-admin-session";
import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { ProductListPage } from "../../../../src/modules/catalogo/product-list-page";
import { getAdminProducts } from "../../../../src/modules/catalogo/products";
import { getCatalogEntity, listCatalogEntities, toLookupOptions } from "../../../../src/modules/catalogo/catalog-taxonomy";
import type { ProductListFilters } from "../../../../src/modules/catalogo/product-editor-types";
import { getPinnedProductListView } from "../../../../src/modules/catalogo/product-list-view-cookie";

type AdminProductsPageProps = {
  searchParams?: Promise<{
    q?: string;
    categoryId?: string;
    limit?: string;
    offset?: string;
    isActive?: string;
    columns?: string;
    productMessage?: string;
  }>;
};

function limitParam(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed), 200) : fallback;
}

function offsetParam(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.round(parsed), 10_000_000) : fallback;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const context = await getAdminContext();
  const session=await getCurrentAdminSession();
  const canDeleteProducts=Boolean(session?.permissions.some(p=>["*","system.admin","catalog.products.delete"].includes(p)));
  const params = await searchParams;
  const pinnedView = await getPinnedProductListView();
  const filters: ProductListFilters = {
    q: params?.q,
    categoryId: params?.categoryId,
    limit: limitParam(params?.limit, pinnedView?.limit ?? 20),
    offset: offsetParam(params?.offset, 0),
    isActive: params?.isActive === "true" ? true : undefined,
    columns: params?.columns?.split(",").map((column) => column.trim()).filter(Boolean) ?? pinnedView?.columns,
  };
  const [products, categoriesResult] = await Promise.all([
    getAdminProducts(context, filters),
    listCatalogEntities(context, "categories", { limit: 100, offset: 0, isActive: true }),
  ]);

  // Resolve only categories used on this page that the active lookup omitted
  // (inactive categories or categories beyond its first 100 results).
  const knownCategories = new Map(categoriesResult.items.map(category => [category.id, category]));
  const missingCategoryIds = [...new Set(products.items.map(product => product.categoryId))]
    .filter((id): id is string => typeof id === "string" && id.length > 0 && (!knownCategories.has(id) || knownCategories.get(id)?.label === id));
  const resolvedCategories = await Promise.all(missingCategoryIds.map(id => getCatalogEntity(context, "categories", id)));
  for (const result of resolvedCategories) {
    if (result.ok && result.data.label !== result.data.id) knownCategories.set(result.data.id, result.data);
  }
  const displayProducts = {
    ...products,
    items: products.items.map(product => {
      const category = product.categoryId ? knownCategories.get(product.categoryId) : undefined;
      return category && category.label !== category.id ? {...product, categoryName: category.label} : product;
    }),
  };

  return (
    <ProductListPage
      canDeleteProducts={canDeleteProducts}
      context={context}
      products={displayProducts}
      categories={toLookupOptions(categoriesResult)}
      productMessage={params?.productMessage}
      pinnedView={pinnedView}
    />
  );
}
