import { updateStockLevelAction } from "../../../../../src/modules/catalogo/stock-admin-actions";
import { StockAdminPage } from "../../../../../src/modules/catalogo/stock-admin-page";
import { getStockAdminProductDetail, getStockAdminProducts } from "../../../../../src/modules/catalogo/stock-admin";
import { getAdminContext } from "../../../../../src/shared/config/admin-context";

type StockPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    productId?: string;
    stockMessage?: string;
    limit?: string;
    offset?: string;
  }>;
};

function numberParam(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

export default async function StockPage({ searchParams }: StockPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const filters = {
    q: params?.q ?? "",
    status: params?.status === "all" ? "all" as const : "active" as const,
    productId: params?.productId ?? "",
    stockMessage: params?.stockMessage ?? "",
    limit: numberParam(params?.limit, 25),
    offset: numberParam(params?.offset, 0),
  };
  const products = await getStockAdminProducts(context, filters);
  const detailResult = filters.productId
    ? await getStockAdminProductDetail(context, filters.productId)
    : undefined;

  return (
    <StockAdminPage
      context={context}
      detail={detailResult?.ok ? detailResult.data : undefined}
      detailError={detailResult && !detailResult.ok ? detailResult.error : undefined}
      filters={filters}
      products={products}
      updateAction={updateStockLevelAction}
    />
  );
}
