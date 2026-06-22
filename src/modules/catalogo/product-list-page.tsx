import Link from "next/link";
import {
  Columns3,
  Copy,
  Eye,
  MoreVertical,
  Pencil,
  PlusCircle,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import type { ProductListFilters, ProductListResult, ProductLookupOption, ProductSummary } from "./product-editor-types";

type ProductListPageProps = {
  context: AdminContext;
  products: ProductListResult;
  categories: ProductLookupOption[];
};

function productListHref(filters: ProductListFilters, offset: number) {
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

  return `/admin/products?${params.toString()}`;
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

export function ProductListPage({ context, products, categories }: ProductListPageProps) {
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

      <section className="adminCard productListGrid">
        <div className="adminCardHeader productListGridHeader">
          <div>
            <h2>Productos ({products.total})</h2>
            <p>
              {context.organizationId} / {context.shopId} · {locale} · {currency}
            </p>
          </div>
          <div className="adminButtonRow" aria-label="Filtros de productos">
            <button className="adminButton" type="button">
              <Columns3 aria-hidden="true" size={16} />
              Columnas
            </button>
            <button className="adminButton" disabled type="button">
              Acciones agrupadas
            </button>
            <button className="adminButton" type="button">
              <Settings aria-hidden="true" size={16} />
              Ajustes
            </button>
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
            <form action="/admin/products">
              <table className="adminTable productListTable">
                <thead>
                  <tr>
                    <th className="productListSelectCell" scope="col">
                      <input aria-label="Seleccionar todos los productos" disabled type="checkbox" />
                    </th>
                    <th scope="col">ID</th>
                    <th scope="col">Imagen</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Referencia</th>
                    <th scope="col">Categoria</th>
                    <th scope="col">Precio imp. incl.</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Visible</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Media</th>
                    <th scope="col">Acciones</th>
                  </tr>
                  <tr className="productListFilterRow">
                    <th />
                    <th />
                    <th />
                    <th>
                      <input
                        aria-label="Filtrar por nombre"
                        defaultValue={filters.q ?? ""}
                        name="q"
                        placeholder="Buscar"
                        type="search"
                      />
                    </th>
                    <th />
                    <th>
                      <select aria-label="Filtrar por categoria" defaultValue={filters.categoryId ?? ""} name="categoryId">
                        <option value="">Todas</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </th>
                    <th />
                    <th>
                      <input aria-label="Productos por pagina" defaultValue={filters.limit ?? products.limit} max={200} min={1} name="limit" type="number" />
                    </th>
                    <th />
                    <th>
                      <label className="productListFilterCheckbox">
                        <input defaultChecked={filters.isActive === true} name="isActive" type="checkbox" value="true" />
                        Activo
                      </label>
                    </th>
                    <th />
                    <th>
                      <button className="adminButton adminButtonPrimary productListSearchButton" type="submit">
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

                    return (
                      <tr key={product.productId}>
                        <td className="productListSelectCell">
                          <input aria-label={`Seleccionar ${product.name}`} disabled type="checkbox" />
                        </td>
                        <td className="productListIdCell" title={product.productId}>{displayProductId(product.productId)}</td>
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
                        <td className="productListNameCell">
                          <Link href={`/admin/products/${product.productId}`}>{product.name}</Link>
                          <div className="adminContextHint">{product.slug}</div>
                        </td>
                        <td>{product.reference ?? product.defaultVariantId ?? "-"}</td>
                        <td>{categoryLabelForProduct(product, categoryLabels)}</td>
                        <td className="productListNumericCell">{formatMoney(product.priceTaxIncludedMinor, product.priceTaxIncludedDisplay, rowCurrency, locale)}</td>
                        <td className="productListNumericCell">{formatQuantity(product)}</td>
                        <td>
                          <span className={`adminBadge ${product.isVisible ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                            {product.isVisible ? "Visible" : "Oculto"}
                          </span>
                        </td>
                        <td>
                          <span className={`adminBadge ${product.isActive ? "adminBadgeOk" : "adminBadgeWarn"}`}>
                            {product.isActive ? "Activo" : "Fuera de linea"}
                          </span>
                        </td>
                        <td>{hasMedia ? product.mediaCount ? `${product.mediaCount} media` : "Coleccion" : "-"}</td>
                        <td>
                          <div className="productListActions">
                            <Link className="adminIconButton" href={`/admin/products/${product.productId}`} title="Editar">
                              <Pencil aria-hidden="true" size={16} />
                              <span className="adminVisuallyHidden">Editar {product.name}</span>
                            </Link>
                            <button className="adminIconButton" disabled title="Previsualizar requiere contrato Storefront" type="button">
                              <Eye aria-hidden="true" size={16} />
                            </button>
                            <button className="adminIconButton" disabled title="Duplicar requiere mutacion BFF" type="button">
                              <Copy aria-hidden="true" size={16} />
                            </button>
                            <button className="adminIconButton adminIconButtonDanger" disabled title="Eliminar requiere confirmacion y contrato BFF" type="button">
                              <Trash2 aria-hidden="true" size={16} />
                            </button>
                            <button className="adminIconButton" disabled title="Mas acciones" type="button">
                              <MoreVertical aria-hidden="true" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </form>
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
