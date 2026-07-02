import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import type {
  ProductEditorData,
  ProductEditorVariantRow,
  ProductVariantRecord,
  ProductListResult,
  StockDraft,
} from "./product-editor-types";
import { getAdminProductEditorData, getAdminProducts, makeProductGateway } from "./products";

export type StockAdminFilters = {
  q?: string;
  status?: "active" | "all";
  productId?: string;
  stockMessage?: string;
  limit?: number;
  offset?: number;
};

export type StockAdminRow = ProductEditorVariantRow & {
  stock: StockDraft;
  availableQuantity: number;
  available: boolean;
};

export type StockAdminProductDetail = {
  product: ProductEditorData["product"];
  rows: StockAdminRow[];
  warnings: string[];
  correlationIds: string[];
};

function availableQuantity(stock: StockDraft) {
  return stock.availableQuantity ?? Math.max(0, stock.onHandQuantity - stock.reservedQuantity - stock.safetyStockQuantity);
}

function defaultStock(warehouseId = "main-warehouse"): StockDraft {
  return {
    warehouseId,
    onHandQuantity: 0,
    reservedQuantity: 0,
    safetyStockQuantity: 0,
    availableQuantity: 0,
    available: false,
  };
}

function stockForRow(data: ProductEditorData, row: ProductEditorVariantRow) {
  return (
    data.stockByVariant[row.variantId] ??
    data.stockByVariant[row.refId] ??
    (row.isDefault ? data.stockByVariant.default : undefined) ??
    defaultStock()
  );
}

function variantToRow(variant: ProductVariantRecord): ProductEditorVariantRow {
  const label = variant.name || variant.refId || variant.variantId;

  return {
    variantId: variant.variantId,
    role: variant.isDefault ? "PRODUCT_DEFAULT" : "VARIANT",
    isDefault: Boolean(variant.isDefault),
    isVisible: variant.isVisible,
    isActive: variant.isActive,
    refId: variant.refId,
    name: variant.name,
    displayLabel: label,
    selectorLabel: label,
    directMediaCount: 0,
    effectiveMediaSource: "NONE",
  };
}

function mapDetail(data: ProductEditorData): StockAdminProductDetail {
  const sourceRows = data.variantRows.length > 0
    ? data.variantRows
    : data.variants.map(variantToRow);
  const rows = sourceRows
    .filter((row) => row.variantId)
    .map((row) => {
      const stock = stockForRow(data, row);
      const available = availableQuantity(stock);

      return {
        ...row,
        stock,
        availableQuantity: available,
        available: stock.available ?? available > 0,
      };
    });

  return {
    product: data.product,
    rows,
    warnings: data.warnings,
    correlationIds: data.correlationIds,
  };
}

export async function getStockAdminProducts(
  context: AdminContext,
  filters: StockAdminFilters = {},
): Promise<ProductListResult> {
  return getAdminProducts(context, {
    q: filters.q,
    isActive: filters.status === "all" ? undefined : true,
    limit: filters.limit ?? 25,
    offset: filters.offset ?? 0,
  });
}

export async function getStockAdminProductDetail(
  context: AdminContext,
  productId: string,
): Promise<BffResult<StockAdminProductDetail>> {
  const result = await getAdminProductEditorData(context, productId);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      correlationId: result.correlationId,
    };
  }

  return {
    ok: true,
    data: mapDetail(result.data),
    status: 200,
    correlationId: result.correlationId ?? result.data.correlationIds[0] ?? "stock-admin-editor-state",
  };
}

export async function updateStockLevel(
  context: AdminContext,
  input: {
    variantId: string;
    stock: StockDraft;
  },
) {
  return makeProductGateway(context).putStockLevel(input);
}
