import Link from "next/link";
import {
  Columns3,
  Copy,
  Eye,
  ExternalLink,
  Pencil,
  PlusCircle,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { bulkDeactivateProductsAction, deactivateProductAction } from "./product-actions";
import type { ProductListFilters, ProductListResult, ProductLookupOption, ProductSummary } from "./product-editor-types";

type ProductListColumnKey =
  | "id"
  | "image"
  | "reference"
  | "category"
  | "price"
  | "quantity"
  | "visibility"
  | "status"
  | "media";

type ProductListColumnDefinition = {
  key: ProductListColumnKey;
  label: string;
};

const productListOptionalColumns: ProductListColumnDefinition[] = [
  { key: "id", label: "ID" },
  { key: "image", label: "Imagen" },
  { key: "reference", label: "Referencia" },
  { key: "category", label: "Categoria" },
  { key: "price", label: "Precio imp. incl." },
  { key: "quantity", label: "Cantidad" },
  { key: "visibility", label: "Visible" },
  { key: "status", label: "Estado" },
  { key: "media", label: "Media" },
];

const productListDefaultColumnKeys = productListOptionalColumns.map((column) => column.key);

type ProductListPageProps = {
  context: AdminContext;
  products: ProductListResult;
  categories: ProductLookupOption[];
  productMessage?: string;
};

export function normalizeProductListColumns(columns: string[] | undefined): ProductListColumnKey[] {
  const requested = new Set(columns ?? []);
  const selected = productListOptionalColumns
    .map((column) => column.key)
    .filter((key) => requested.has(key));

  return selected.length > 0 ? selected : [...productListDefaultColumnKeys];
}

function sameColumns(left: ProductListColumnKey[], right: ProductListColumnKey[]) {
  return left.length === right.length && left.every((column, index) => column === right[index]);
}

function productListHref(
  filters: ProductListFilters,
  offset: number,
  columns: ProductListColumnKey[] = normalizeProductListColumns(filters.columns),
) {
  const params = new URLSearchParams();
  const limit = filters.limit ?? 100;

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.categoryId?.trim()) {
    params.set("categoryId", filters.categoryId.trim());
  }
  if (filters.isActive) {
    params.set("isActive", "true");
  }

  params.set("limit", String(limit));
  params.set("offset", String(Math.max(0, offset)));

  if (!sameColumns(columns, productListDefaultColumnKeys)) {
    params.set("columns", columns.join(","));
  }

  return `/admin/products?${params.toString()}`;
}

function productListColumnToggleHref(filters: ProductListFilters, key: ProductListColumnKey, columns: ProductListColumnKey[]) {
  const current = new Set(columns);
  if (current.has(key) && columns.length > 1) {
    current.delete(key);
  } else {
    current.add(key);
  }

  const nextColumns = productListOptionalColumns
    .map((column) => column.key)
    .filter((column) => current.has(column));

  return productListHref(filters, 0, nextColumns);
}

function productListResetHref(filters: ProductListFilters, columns: ProductListColumnKey[]) {
  return productListHref({ limit: filters.limit, columns }, 0, columns);
}

function productDeactivateFormId(productId: string) {
  return `product-deactivate-${productId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function paginationPages(currentPage: number, pageCount: number) {
  const pages = new Set<number>([1, pageCount]);
  for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
    if (page >= 1 && page <= pageCount) {
      pages.add(page);
    }
  }

  return Array.from(pages).sort((left, right) => left - right);
}

function displayProductId(productId: string) {
  return productId.length > 10 ? productId.slice(0, 8) : productId;
}

function formatMoney(minor: number | undefined, display: string | undefined, currency: string, locale: string) {
  if (display) {
    return display;
  }
  if (typeof minor !== "number") {
    return "-";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minor / 100);
}

function formatQuantity(product: ProductSummary) {
  return typeof product.quantity === "number" ? String(product.quantity) : "-";
}

function categoryLabelForProduct(product: ProductSummary, categoryLabels: Map<string, string>) {
  return product.categoryName ?? (product.categoryId ? categoryLabels.get(product.categoryId) : undefined) ?? "-";
}

export function ProductListPage({ context, products, categories, productMessage }: ProductListPageProps) {
  const hasContext = hasRequiredAdminContext(context);
  const filters = products.filters ?? {};
  const limit = products.limit || 100;
  const currentPage = Math.floor(products.offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(products.total / limit));
  const firstItem = products.total === 0 ? 0 : products.offset + 1;
  const lastItem = Math.min(products.offset + products.items.length, products.total);
  const hasPreviousPage = products.offset > 0;
  const hasNextPage = products.offset + limit < products.total;
  const pages = paginationPages(currentPage, pageCount);
  const locale = context.locale ?? "es-ES";
  const currency = context.currency ?? "EUR";
  const categoryLabels = new Map(categories.map((category) => [category.id, category.label]));
  const activeColumns = normalizeProductListColumns(filters.columns);
  const isColumnVisible = (column: ProductListColumnKey) => activeColumns.includes(column);
  const currentListHref = productListHref(filters, products.offset, activeColumns);

  return (
    <main className="adminPage productListPage">
      <div className="adminBreadcrumb">Admin / Catalogo / Productos</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Productos</h1>
          <p className="adminPageIntro">
            Gestiona fichas de producto, variantes, imagenes, precio y stock desde un unico editor.
          </p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton adminButtonPrimary" href="/admin/products/new">
            <PlusCircle aria-hidden="true" size={16} />
            Anadir producto
          </Link>
        </div>
      </div>

      {!hasContext ? (
        <div className="adminBanner adminBannerError">
          <p>Selecciona Organization y Shop antes de operar Catalogo.</p>
          <Link className="adminButton" href="/admin/configuracion/contexto">
            Ir a contexto
          </Link>
        </div>
      ) : null}

      {products.source === "unavailable" ? (
        <div className="adminBanner adminBannerError">
          <p>No se pudo conectar con el BFF de Ecommium para productos.</p>
          <p className="adminContextHint">{products.failedEndpoint}: {products.message}</p>
          <code>./scripts/postman-services.sh up</code>
        </div>
      ) : null}

      {productMessage ? (
        <div className="adminBanner">
          <p>{productMessage}</p>
        </div>
      ) : null}

      <section className="adminCard productListGrid">
        <div className="adminCardHeader productListGridHeader">
          <div>
            <h2>Productos ({products.total})</h2>
            <p>
              {context.organizationId} / {context.shopId} · {locale} · {currency}
            </p>
          </div>
          <div className="adminButtonRow" aria-label="Filtros de productos">
            <details className="productListToolbarMenu">
              <summary className="adminButton">
                <Columns3 aria-hidden="true" size={16} />
                Columnas
              </summary>
              <div className="productListToolbarPanel">
                {productListOptionalColumns.map((column) => {
                  const selected = isColumnVisible(column.key);
                  const locked = selected && activeColumns.length === 1;

                  return locked ? (
                    <span className="productListToolbarOption productListToolbarOptionDisabled" key={column.key}>
                      <span aria-hidden="true">✓</span>
                      {column.label}
                    </span>
                  ) : (
                    <Link
                      className="productListToolbarOption"
                      href={productListColumnToggleHref(filters, column.key, activeColumns)}
                      key={column.key}
                    >
                      <span aria-hidden="true">{selected ? "✓" : ""}</span>
                      {column.label}
                    </Link>
                  );
                })}
              </div>
            </details>
            <details className="productListToolbarMenu">
              <summary className="adminButton">
                <Trash2 aria-hidden="true" size={16} />
                Acciones agrupadas
              </summary>
              <div className="productListToolbarPanel productListBulkPanel">
                <strong>Desactivar seleccionados</strong>
                <p>Oculta los productos marcados, los deja fuera de linea e intenta sacar sus rutas SEO del sitemap.</p>
                <label>
                  <input form="product-list-bulk-form" name="confirmBulkDeactivate" type="checkbox" value="yes" />
                  Confirmo la desactivacion agrupada
                </label>
                <button className="adminButton adminButtonDanger" form="product-list-bulk-form" type="submit">
                  Desactivar seleccionados
                </button>
              </div>
            </details>
            <details className="productListToolbarMenu">
              <summary className="adminButton">
                <Settings aria-hidden="true" size={16} />
                Ajustes
              </summary>
              <div className="productListToolbarPanel">
                {[20, 50, 100, 200].map((pageSize) => (
                  <Link
                    className="productListToolbarOption"
                    href={productListHref({ ...filters, limit: pageSize }, 0, activeColumns)}
                    key={pageSize}
                  >
                    <span aria-hidden="true">{limit === pageSize ? "✓" : ""}</span>
                    {pageSize} por pagina
                  </Link>
                ))}
                <Link className="productListToolbarOption" href={productListResetHref(filters, activeColumns)}>
                  <span aria-hidden="true" />
                  Limpiar filtros
                </Link>
              </div>
            </details>
          </div>
        </div>

        {products.items.length === 0 ? (
          <div className="adminEmptyState">
            <h2>No hay productos para este contexto</h2>
            <p>Crea un producto inactivo para completar imagenes, precio y stock antes de publicarlo.</p>
            <Link className="adminButton adminButtonPrimary" href="/admin/products/new">
              Anadir producto
            </Link>
          </div>
        ) : (
          <div className="adminTableScroller productListTableScroller">
            <form id="product-list-filter-form" action="/admin/products" />
            <form action={bulkDeactivateProductsAction} id="product-list-bulk-form">
              <input name="returnTo" type="hidden" value={currentListHref} />
            </form>
            <table className="adminTable productListTable">
                <thead>
                  <tr>
                    <th className="productListSelectCell" scope="col">
                      <span className="adminContextHint">Sel.</span>
                    </th>
                    {isColumnVisible("id") ? <th scope="col">ID</th> : null}
                    {isColumnVisible("image") ? <th scope="col">Imagen</th> : null}
                    <th scope="col">Nombre</th>
                    {isColumnVisible("reference") ? <th scope="col">Referencia</th> : null}
                    {isColumnVisible("category") ? <th scope="col">Categoria</th> : null}
                    {isColumnVisible("price") ? <th scope="col">Precio imp. incl.</th> : null}
                    {isColumnVisible("quantity") ? <th scope="col">Cantidad</th> : null}
                    {isColumnVisible("visibility") ? <th scope="col">Visible</th> : null}
                    {isColumnVisible("status") ? <th scope="col">Estado</th> : null}
                    {isColumnVisible("media") ? <th scope="col">Media</th> : null}
                    <th scope="col">Acciones</th>
                  </tr>
                  <tr className="productListFilterRow">
                    <th />
                    {isColumnVisible("id") ? <th /> : null}
                    {isColumnVisible("image") ? <th /> : null}
                    <th>
                      <input
                        aria-label="Filtrar por nombre"
                        defaultValue={filters.q ?? ""}
                        form="product-list-filter-form"
                        name="q"
                        placeholder="Buscar"
                        type="search"
                      />
                    </th>
                    {isColumnVisible("reference") ? <th /> : null}
                    {isColumnVisible("category") ? (
                      <th>
                      <select aria-label="Filtrar por categoria" defaultValue={filters.categoryId ?? ""} form="product-list-filter-form" name="categoryId">
                        <option value="">Todas</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                      </th>
                    ) : null}
                    {isColumnVisible("price") ? <th /> : null}
                    {isColumnVisible("quantity") ? (
                      <th>
                        <input aria-label="Productos por pagina" defaultValue={filters.limit ?? products.limit} form="product-list-filter-form" max={200} min={1} name="limit" type="number" />
                      </th>
                    ) : null}
                    {isColumnVisible("visibility") ? <th /> : null}
                    {isColumnVisible("status") ? (
                      <th>
                        <label className="productListFilterCheckbox">
                          <input defaultChecked={filters.isActive === true} form="product-list-filter-form" name="isActive" type="checkbox" value="true" />
                          Activo
                        </label>
                      </th>
                    ) : null}
                    {isColumnVisible("media") ? <th /> : null}
                    <th>
                      {!isColumnVisible("category") && filters.categoryId ? (
                        <input form="product-list-filter-form" name="categoryId" type="hidden" value={filters.categoryId} />
                      ) : null}
                      {!isColumnVisible("quantity") ? (
                        <input form="product-list-filter-form" name="limit" type="hidden" value={filters.limit ?? products.limit} />
                      ) : null}
                      {!isColumnVisible("status") && filters.isActive ? (
                        <input form="product-list-filter-form" name="isActive" type="hidden" value="true" />
                      ) : null}
                      {!sameColumns(activeColumns, productListDefaultColumnKeys) ? (
                        <input form="product-list-filter-form" name="columns" type="hidden" value={activeColumns.join(",")} />
                      ) : null}
                      <button className="adminButton adminButtonPrimary productListSearchButton" form="product-list-filter-form" type="submit">
                        <Search aria-hidden="true" size={16} />
                        <span className="adminVisuallyHidden">Buscar</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.items.map((product) => {
                    const hasMedia = Boolean((product.mediaCount ?? 0) > 0 || product.mediaCollectionId);
                    const rowCurrency = product.currency ?? currency;
                    const deactivateFormId = productDeactivateFormId(product.productId);

                    return (
                      <tr key={product.productId}>
                        <td className="productListSelectCell">
                          <input
                            aria-label={`Seleccionar ${product.name}`}
                            form="product-list-bulk-form"
                            name="productIds"
                            type="checkbox"
                            value={product.productId}
                          />
                        </td>
                        {isColumnVisible("id") ? <td className="productListIdCell" title={product.productId}>{displayProductId(product.productId)}</td> : null}
                        {isColumnVisible("image") ? (
                          <td>
                            <div className="productListThumb">
                              {product.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.thumbnailUrl} alt={product.thumbnailAlt ?? product.name} />
                              ) : (
                                <span>Sin imagen</span>
                              )}
                            </div>
                          </td>
                        ) : null}
                        <td className="productListNameCell">
                          <Link href={`/admin/products/${product.productId}`}>{product.name}</Link>
                          <div className="adminContextHint">{product.slug}</div>
                        </td>
                        {isColumnVisible("reference") ? <td>{product.reference ?? product.defaultVariantId ?? "-"}</td> : null}
                        {isColumnVisible("category") ? <td>{categoryLabelForProduct(product, categoryLabels)}</td> : null}
                        {isColumnVisible("price") ? <td className="productListNumericCell">{formatMoney(product.priceTaxIncludedMinor, product.priceTaxIncludedDisplay, rowCurrency, locale)}</td> : null}
                        {isColumnVisible("quantity") ? <td className="productListNumericCell">{formatQuantity(product)}</td> : null}
                        {isColumnVisible("visibility") ? (
                          <td>
                            <span className={`adminBadge ${product.isVisible ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                              {product.isVisible ? "Visible" : "Oculto"}
                            </span>
                          </td>
                        ) : null}
                        {isColumnVisible("status") ? (
                          <td>
                            <span className={`adminBadge ${product.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                              {product.isActive ? "Activo" : "Fuera de linea"}
                            </span>
                          </td>
                        ) : null}
                        {isColumnVisible("media") ? <td>{hasMedia ? product.mediaCount ? `${product.mediaCount} media` : "Coleccion" : "-"}</td> : null}
                        <td>
                          <div className="productListActions">
                            <Link className="adminIconButton" href={`/admin/products/${product.productId}`} title="Editar">
                              <Pencil aria-hidden="true" size={16} />
                              <span className="adminVisuallyHidden">Editar {product.name}</span>
                            </Link>
                            <Link className="adminIconButton" href={`/admin/products/${product.productId}?preview=1`} title="Previsualizar en editor">
                              <Eye aria-hidden="true" size={16} />
                              <span className="adminVisuallyHidden">Previsualizar {product.name}</span>
                            </Link>
                            <Link className="adminIconButton" href={`/admin/products/${product.productId}/storefront-preview`} title="Preview Storefront real">
                              <ExternalLink aria-hidden="true" size={16} />
                              <span className="adminVisuallyHidden">Preview Storefront {product.name}</span>
                            </Link>
                            <Link className="adminIconButton" href={`/admin/products/new?duplicateFrom=${encodeURIComponent(product.productId)}`} title="Duplicar como borrador">
                              <Copy aria-hidden="true" size={16} />
                              <span className="adminVisuallyHidden">Duplicar {product.name}</span>
                            </Link>
                            <details className="productDangerMenu">
                              <summary className="adminIconButton adminIconButtonDanger" title="Desactivar de forma segura">
                                <Trash2 aria-hidden="true" size={16} />
                                <span className="adminVisuallyHidden">Desactivar {product.name}</span>
                              </summary>
                              <div className="productDangerPanel">
                                <strong>Desactivar producto</strong>
                                <p>Lo ocultara, lo dejara fuera de linea e intentara sacar sus rutas SEO del sitemap.</p>
                                <label>
                                  <input form={deactivateFormId} name="confirmDeactivate" type="checkbox" value="yes" />
                                  Confirmo la desactivacion
                                </label>
                                <button className="adminButton adminButtonDanger" form={deactivateFormId} type="submit">
                                  Desactivar
                                </button>
                              </div>
                            </details>
                          </div>
                          <form action={deactivateProductAction} id={deactivateFormId}>
                            <input name="productId" type="hidden" value={product.productId} />
                            <input name="returnTo" type="hidden" value={currentListHref} />
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            <nav className="productListPagination" aria-label="Paginacion de productos">
              <p>
                Mostrando {firstItem}-{lastItem} de {products.total}
              </p>
              <div className="productListPaginationControls">
                {hasPreviousPage ? (
                  <Link className="productListPageLink" href={productListHref(filters, 0)} aria-label="Primera pagina">
                    «
                  </Link>
                ) : (
                  <span className="productListPageLink productListPageLinkDisabled">«</span>
                )}
                {hasPreviousPage ? (
                  <Link className="productListPageLink" href={productListHref(filters, Math.max(0, products.offset - limit))} aria-label="Pagina anterior">
                    ‹
                  </Link>
                ) : (
                  <span className="productListPageLink productListPageLinkDisabled">‹</span>
                )}
                {pages.map((page, index) => {
                  const previousPage = pages[index - 1];
                  const pageOffset = (page - 1) * limit;

                  return (
                    <span className="productListPageCluster" key={page}>
                      {previousPage && page - previousPage > 1 ? <span className="productListPageGap">…</span> : null}
                      {page === currentPage ? (
                        <span className="productListPageLink productListPageLinkActive" aria-current="page">
                          {page}
                        </span>
                      ) : (
                        <Link className="productListPageLink" href={productListHref(filters, pageOffset)}>
                          {page}
                        </Link>
                      )}
                    </span>
                  );
                })}
                {hasNextPage ? (
                  <Link className="productListPageLink" href={productListHref(filters, products.offset + limit)} aria-label="Pagina siguiente">
                    ›
                  </Link>
                ) : (
                  <span className="productListPageLink productListPageLinkDisabled">›</span>
                )}
                {hasNextPage ? (
                  <Link className="productListPageLink" href={productListHref(filters, (pageCount - 1) * limit)} aria-label="Ultima pagina">
                    »
                  </Link>
                ) : (
                  <span className="productListPageLink productListPageLinkDisabled">»</span>
                )}
              </div>
            </nav>
          </div>
        )}
      </section>
    </main>
  );
}
