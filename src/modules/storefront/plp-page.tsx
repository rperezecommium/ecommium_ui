import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { StorefrontCategoryLink, StorefrontPlpBlock, StorefrontPlpData, StorefrontPlpProduct, StorefrontPlpResult } from "./plp";
import { StorefrontAddToCartButton } from "./cart-client";
import { StorefrontSearchEventsClient } from "./search-events-client";
import { StorefrontCmsBlockRenderer } from "./storefront-cms-page";
import { StorefrontHeader } from "./storefront-header";

export { StorefrontHeader } from "./storefront-header";

type Props = {
  result: StorefrontPlpResult;
  categorySlug: string;
  searchQuery?: string;
  openCustomerLogin?: boolean;
};

const titleFromSlug = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Categoria";

export function StorefrontPlpPage({ result, categorySlug, searchQuery, openCustomerLogin }: Props) {
  const activeSearchQuery = searchQuery ?? result.data?.searchQuery;
  const title = activeSearchQuery
    ? "Resultados de busqueda"
    : result.data
      ? titleFromSlug(result.data.categorySlug)
      : titleFromSlug(categorySlug);
  const description = activeSearchQuery
    ? `Resultados para "${activeSearchQuery}".`
    : "Descubre una seleccion preparada para navegar categorias, filtros y bloques editoriales.";

  return (
    <main className="storefrontPage">
      <StorefrontHeader initialQuery={activeSearchQuery} openCustomerLogin={openCustomerLogin} />
      <div className="storefrontShell">
        <nav className="storefrontBreadcrumb">
          <Link href="/">Inicio</Link>
          <span>/</span>
          <span>{activeSearchQuery ? "Busqueda" : title}</span>
        </nav>
        <div className="storefrontPlpLayout">
          <StorefrontFacets
            categories={result.data?.categories ?? []}
            currentCategorySlug={result.data?.categorySlug ?? categorySlug}
          />
          {result.ok && result.data ? (
            <StorefrontListing data={result.data} title={title} />
          ) : (
            <section className="storefrontListing">
              <CategoryIntro description={description} title={title} />
              <div className="storefrontUnavailable">
                <span>PLP</span>
                <h1>No se pudo cargar el listado</h1>
                <p>{result.error ?? "BFF no disponible para Storefront."}</p>
                <code>{categorySlug === "bike-brakes" ? "/" : `/plp/${categorySlug}`}</code>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function StorefrontListing({ data, title }: { data: StorefrontPlpData; title: string }) {
  const description = data.searchQuery
    ? `Resultados para "${data.searchQuery}".`
    : "Descubre una seleccion preparada para navegar categorias, filtros y bloques editoriales.";

  return (
    <section className="storefrontListing">
      <CategoryIntro description={description} title={title} />
      <BlockStack blocks={data.cmsBlocks.beforeList} />
      {data.searchEvent ? (
        <StorefrontSearchEventsClient
          event={data.searchEvent}
          products={data.products.map((product) => ({
            productId: product.productId,
            variantId: product.variantId,
          }))}
        />
      ) : null}
      <div className="storefrontProductsTopbar">
        <span>{data.total} productos.</span>
        <label>
          Ordenar por:
          <select defaultValue="relevance">
            <option value="relevance">Relevancia</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
          </select>
        </label>
      </div>
      {data.products.length > 0 ? (
        <div className="storefrontProductGrid">
          {data.products.map((product) => (
            <ProductCard
              key={product.productId}
              product={product}
            />
          ))}
        </div>
      ) : (
        <div className="storefrontUnavailable">
          <span>{data.searchQuery ? "Busqueda" : "Categoria"}</span>
          <h1>{data.searchQuery ? "No encontramos resultados" : "No hay productos visibles"}</h1>
          <p>
            {data.searchQuery
              ? "Prueba con otros terminos o revisa sinonimos desde Admin Search."
              : "El BFF respondio correctamente, pero el listado no contiene items para esta categoria."}
          </p>
        </div>
      )}
      <StorefrontPagination data={data} />
      <BlockStack blocks={data.cmsBlocks.afterList} />
    </section>
  );
}

function CategoryIntro({ description, title }: { description: string; title: string }) {
  return (
    <section className="storefrontCategoryIntro">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="storefrontCategoryImage" />
    </section>
  );
}

function StorefrontFacets({
  categories,
  currentCategorySlug,
}: {
  categories: StorefrontCategoryLink[];
  currentCategorySlug: string;
}) {
  return (
    <aside className="storefrontFacets">
      <section>
        <strong>Categorias</strong>
        {categories.length > 0 ? categories.map((category) => (
          <Link
            aria-current={category.active ? "page" : undefined}
            className={category.active ? "storefrontFacetActive" : undefined}
            href={category.href}
            key={category.id}
            style={{ paddingLeft: `${category.depth * 12}px` }}
          >
            {category.name}
          </Link>
        )) : <Link className="storefrontFacetActive" href={`/plp/${currentCategorySlug}`}>{titleFromSlug(currentCategorySlug)}</Link>}
      </section>
      <section>
        <strong>Filtrar por</strong>
        <label><input type="checkbox" /> Disponible</label>
        <label><input type="checkbox" /> En oferta</label>
        <label><input type="checkbox" /> Nuevo</label>
      </section>
      <section>
        <strong>Precio</strong>
        <label><input type="checkbox" /> 0,00 EUR - 25,00 EUR</label>
        <label><input type="checkbox" /> 25,00 EUR - 50,00 EUR</label>
      </section>
    </aside>
  );
}

function ProductCard({
  product,
}: {
  product: StorefrontPlpProduct;
}) {
  const productHref = product.productUrlPath?.startsWith("/") && !product.productUrlPath.startsWith("//")
    ? product.productUrlPath
    : `/pdp/${encodeURIComponent(product.slug)}`;

  return (
    <article className="storefrontProductCard">
      <Link
        className="storefrontProductImage"
        data-search-product-id={product.productId}
        data-search-variant-id={product.variantId}
        href={productHref}
      >
        <span className={product.available ? "storefrontAvailabilityRibbon" : "storefrontAvailabilityRibbon storefrontAvailabilityRibbonMuted"}>
          {product.available ? "Disponible" : "No disponible"}
        </span>
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.name}
            fill
            sizes="(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 255px"
            unoptimized
          />
        ) : <span>Vista rapida</span>}
        <span className="storefrontQuickView">Vista rapida</span>
      </Link>
      <div className="storefrontProductInfo">
        {product.brand ? <span>{product.brand}</span> : null}
        <Link
          data-search-product-id={product.productId}
          data-search-variant-id={product.variantId}
          href={productHref}
        >
          {product.name}
        </Link>
        <div>
          {product.previousPriceDisplay ? <s>{product.previousPriceDisplay}</s> : null}
          <b>{product.priceDisplay ?? "Precio pendiente"}</b>
        </div>
        <StorefrontAddToCartButton
          className="storefrontProductCartButton"
          compact
          disabled={!product.available || !product.variantId}
          quantity={1}
          variantId={product.variantId}
        />
      </div>
    </article>
  );
}

function StorefrontPagination({ data }: { data: StorefrontPlpData }) {
  const firstItem = data.products.length > 0 ? data.offset + 1 : 0;
  const lastItem = Math.min(data.offset + data.products.length, data.total);
  const pages = visiblePages(data.currentPage, data.totalPages);

  return (
    <nav className="storefrontPagination" aria-label="Paginacion">
      <span>Mostrando {firstItem}-{lastItem} de {data.total} articulo(s)</span>
      <div>
        <PaginationLink data={data} page={Math.max(1, data.currentPage - 1)} disabled={data.currentPage <= 1}>
          Anterior
        </PaginationLink>
        {pages.map((page) => (
          <PaginationLink active={page === data.currentPage} data={data} key={page} page={page}>
            {page}
          </PaginationLink>
        ))}
        <PaginationLink data={data} page={Math.min(data.totalPages, data.currentPage + 1)} disabled={data.currentPage >= data.totalPages}>
          Siguiente
        </PaginationLink>
      </div>
    </nav>
  );
}

function PaginationLink({
  active,
  children,
  data,
  disabled,
  page,
}: {
  active?: boolean;
  children: ReactNode;
  data: StorefrontPlpData;
  disabled?: boolean;
  page: number;
}) {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set("page", String(page));
  }

  if (data.limit !== 16) {
    params.set("limit", String(data.limit));
  }
  if (data.searchQuery) {
    params.set("q", data.searchQuery);
  }

  const queryString = params.toString();
  const href = queryString ? `${data.publicPath}?${queryString}` : data.publicPath;

  if (disabled) {
    return <span className="storefrontPageDisabled">{children}</span>;
  }

  return (
    <Link aria-current={active ? "page" : undefined} className={active ? "storefrontPageActive" : undefined} href={href}>
      {children}
    </Link>
  );
}

function visiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function BlockStack({ blocks }: { blocks: StorefrontPlpBlock[] }) {
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="storefrontBlockStack">
      {blocks.map((block) => <StorefrontCmsBlockRenderer key={block.blockId} block={block} />)}
    </div>
  );
}
