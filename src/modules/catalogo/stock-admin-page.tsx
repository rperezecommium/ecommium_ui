import Link from "next/link";
import { Save } from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import type { ProductListResult } from "./product-editor-types";
import type { StockAdminFilters, StockAdminProductDetail, StockAdminRow } from "./stock-admin";

type Action = (formData: FormData) => Promise<void>;

type Props = {
  context: AdminContext;
  filters: StockAdminFilters;
  products: ProductListResult;
  detail?: StockAdminProductDetail;
  detailError?: string;
  updateAction: Action;
};

function stockHref(filters: StockAdminFilters, overrides: Partial<StockAdminFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.status && next.status !== "active") params.set("status", next.status);
  if (next.productId) params.set("productId", next.productId);
  if (next.limit && next.limit !== 25) params.set("limit", String(next.limit));
  if (next.offset) params.set("offset", String(next.offset));
  const query = params.toString();
  return query ? `/admin/catalogo/stock?${query}` : "/admin/catalogo/stock";
}

function quantityText(value: number | undefined) {
  return typeof value === "number" ? String(value) : "0";
}

function valueText(value: string | undefined | null) {
  return value?.trim() ? value : "-";
}

function ResultBanner({ result }: { result: ProductListResult }) {
  if (result.source !== "unavailable") {
    return null;
  }

  return (
    <div className="adminBanner adminBannerError">
      <p>{result.message ?? "Catalog no devolvio productos para stock."}</p>
      {result.failedEndpoint ? <p className="adminContextHint">{result.failedEndpoint}</p> : null}
      {result.correlationId ? <p className="adminContextHint">Correlation: {result.correlationId}</p> : null}
    </div>
  );
}

function ProductRows({
  filters,
  products,
}: {
  filters: StockAdminFilters;
  products: ProductListResult;
}) {
  if (products.items.length === 0) {
    return <div className="adminEmptyState">No hay productos para el filtro actual.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable pricingTable stockAdminProductTable">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Referencia</th>
            <th scope="col">Default variant</th>
            <th scope="col">Disponible</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.items.map((product) => (
            <tr key={product.productId}>
              <td>
                <strong>{product.name}</strong>
                <div className="adminContextHint">{product.productId}</div>
              </td>
              <td>{valueText(product.reference)}</td>
              <td>{valueText(product.defaultVariantId)}</td>
              <td>{quantityText(product.quantity)}</td>
              <td>
                <span className={`adminBadge ${product.isActive && product.isVisible ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                  {product.isActive && product.isVisible ? "Activo" : "No vendible"}
                </span>
              </td>
              <td>
                <Link className="adminButton adminButtonTiny" href={stockHref(filters, { productId: product.productId })}>
                  Gestionar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockRowForm({
  productId,
  row,
  updateAction,
}: {
  productId: string;
  row: StockAdminRow;
  updateAction: Action;
}) {
  return (
    <form action={updateAction} className="stockAdminRowForm">
      <input name="productId" type="hidden" value={productId} />
      <input name="variantId" type="hidden" value={row.variantId} />
      <div className="stockAdminVariantCell">
        <strong>{row.displayLabel || row.name}</strong>
        <span>{row.refId}</span>
        <small>{row.isDefault ? "Default" : row.role}</small>
      </div>
      <label className="adminField">
        <span>Warehouse</span>
        <input name="warehouseId" defaultValue={row.stock.warehouseId || "main-warehouse"} />
      </label>
      <label className="adminField">
        <span>On hand</span>
        <input inputMode="numeric" min="0" name="onHandQuantity" type="number" defaultValue={row.stock.onHandQuantity} />
      </label>
      <label className="adminField">
        <span>Reservado</span>
        <input inputMode="numeric" min="0" name="reservedQuantity" type="number" defaultValue={row.stock.reservedQuantity} />
      </label>
      <label className="adminField">
        <span>Seguridad</span>
        <input inputMode="numeric" min="0" name="safetyStockQuantity" type="number" defaultValue={row.stock.safetyStockQuantity} />
      </label>
      <div className="stockAdminAvailability">
        <span className={`adminBadge ${row.available ? "adminBadgeOk" : "adminBadgeWarn"}`}>
          {row.available ? "Disponible" : "Sin stock"}
        </span>
        <strong>{row.availableQuantity}</strong>
      </div>
      <button className="adminButton adminButtonPrimary" type="submit">
        <Save aria-hidden="true" size={16} />
        Guardar
      </button>
    </form>
  );
}

function StockDetail({
  detail,
  detailError,
  updateAction,
}: {
  detail?: StockAdminProductDetail;
  detailError?: string;
  updateAction: Action;
}) {
  if (detailError) {
    return <div className="adminBanner adminBannerError"><p>{detailError}</p></div>;
  }
  if (!detail) {
    return (
      <section className="pricingPanel">
        <div className="adminEmptyState">Selecciona un producto para ajustar stock por variante.</div>
      </section>
    );
  }

  const totalAvailable = detail.rows.reduce((total, row) => total + row.availableQuantity, 0);
  const stockedRows = detail.rows.filter((row) => row.available).length;

  return (
    <section className="pricingPanel stockAdminDetail">
      <div className="pricingPanelHeader">
        <div>
          <h2>{detail.product.name}</h2>
          <p>{detail.product.productId}</p>
        </div>
        <Link className="adminButton" href={`/admin/products/${encodeURIComponent(detail.product.productId)}`}>
          Abrir ficha
        </Link>
      </div>

      <section className="adminSummaryGrid" aria-label="Resumen de stock">
        <div>
          <span>Disponible total</span>
          <strong>{totalAvailable}</strong>
        </div>
        <div>
          <span>Filas con stock</span>
          <strong>{stockedRows}/{detail.rows.length}</strong>
        </div>
        <div>
          <span>Default variant</span>
          <strong>{detail.product.defaultVariantId ?? "-"}</strong>
        </div>
        <div>
          <span>Correlation IDs</span>
          <strong>{detail.correlationIds.length}</strong>
        </div>
      </section>

      {detail.warnings.length > 0 ? (
        <div className="adminBanner adminBannerInfo">
          {detail.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="stockAdminRows">
        {detail.rows.length === 0 ? (
          <div className="adminEmptyState">El producto no devolvio variantes para stock.</div>
        ) : detail.rows.map((row) => (
          <StockRowForm key={row.variantId} productId={detail.product.productId} row={row} updateAction={updateAction} />
        ))}
      </div>
    </section>
  );
}

export function StockAdminPage({
  context,
  filters,
  products,
  detail,
  detailError,
  updateAction,
}: Props) {
  const limit = filters.limit ?? products.limit ?? 25;
  const offset = filters.offset ?? products.offset ?? 0;
  const nextOffset = offset + limit;
  const previousOffset = Math.max(0, offset - limit);

  return (
    <main className="adminPage stockAdminPage">
      <div className="adminBreadcrumb">Admin / Catalogo / Stock</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Stock</h1>
          <p className="adminPageIntro">Consulta y ajusta existencias por variante, almacen y tienda.</p>
        </div>
        <Link className="adminButton" href="/admin/catalogo/stock">Refrescar</Link>
      </div>

      {filters.stockMessage ? (
        <div className="adminBanner">
          <p>{filters.stockMessage}</p>
        </div>
      ) : null}

      <form aria-label="Filtros stock" className="pricingFilterBar" method="get">
        <label className="adminField">
          <span>Producto</span>
          <input name="q" defaultValue={filters.q ?? ""} placeholder="Nombre, SKU o ID" />
        </label>
        <label className="adminField">
          <span>Estado</span>
          <select name="status" defaultValue={filters.status ?? "active"}>
            <option value="active">Activos</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <label className="adminField">
          <span>Limite</span>
          <select name="limit" defaultValue={String(limit)}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
        <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
        <Link className="adminButton" href="/admin/catalogo/stock">Limpiar</Link>
      </form>

      <ResultBanner result={products} />

      <div className="stockAdminLayout">
        <section className="pricingPanel">
          <div className="pricingPanelHeader">
            <div>
              <h2>Productos</h2>
              <p>{products.total} registros</p>
            </div>
            <span className="adminBadge">{context.organizationId || "Sin organization"} / {context.shopId || "Sin shop"}</span>
          </div>
          <ProductRows filters={filters} products={products} />
          <div className="productListPagination">
            <Link
              aria-disabled={offset === 0}
              className={`adminButton ${offset === 0 ? "adminButtonDisabled" : ""}`}
              href={stockHref(filters, { offset: previousOffset })}
            >
              Anterior
            </Link>
            <span>{offset + 1}-{Math.min(nextOffset, products.total || nextOffset)}</span>
            <Link
              aria-disabled={nextOffset >= products.total}
              className={`adminButton ${nextOffset >= products.total ? "adminButtonDisabled" : ""}`}
              href={stockHref(filters, { offset: nextOffset })}
            >
              Siguiente
            </Link>
          </div>
        </section>

        <StockDetail detail={detail} detailError={detailError} updateAction={updateAction} />
      </div>
    </main>
  );
}
