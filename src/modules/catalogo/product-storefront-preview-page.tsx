import Link from "next/link";
import { AlertTriangle, ArrowLeft, ExternalLink, MonitorSmartphone } from "lucide-react";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { getAdminProductEditorData } from "./products";
import { getProductStorefrontPreview } from "./product-storefront-preview";
import type { ProductEditorData } from "./product-editor-types";

type ProductStorefrontPreviewPageProps = {
  context: AdminContext;
  productId: string;
};

function canonicalPath(editorData: ProductEditorData) {
  return editorData.routingSeo?.canonicalRoute?.path || `/${editorData.product.slug}/p`;
}

function routeStatus(editorData: ProductEditorData) {
  const route = editorData.routingSeo?.canonicalRoute;
  if (!route) {
    return "Sin canonical persistido";
  }

  return `${route.status}${route.includeInSitemap ? " / sitemap" : " / fuera de sitemap"}`;
}

function previewWarningList(editorData: ProductEditorData) {
  const warnings: string[] = [];
  if (!editorData.product.isActive) {
    warnings.push("Producto fuera de linea en Catalog.");
  }
  if (!editorData.product.isVisible) {
    warnings.push("Producto oculto para Storefront.");
  }
  if (editorData.routingSeo?.canonicalRoute?.status === "INACTIVE") {
    warnings.push("Canonical inactivo en Routing/SEO.");
  }
  if (editorData.routingSeo?.canonicalRoute && !editorData.routingSeo.canonicalRoute.includeInSitemap) {
    warnings.push("Canonical excluido del sitemap.");
  }

  return warnings;
}

export async function ProductStorefrontPreviewPage({ context, productId }: ProductStorefrontPreviewPageProps) {
  if (!hasRequiredAdminContext(context)) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / Catalogo / Productos / Preview Storefront</div>
        <div className="adminBanner adminBannerError">
          <p>Selecciona Organization y Shop antes de previsualizar Storefront.</p>
          <Link className="adminButton" href="/admin/configuracion/contexto">
            Ir a contexto
          </Link>
        </div>
      </main>
    );
  }

  const editorState = await getAdminProductEditorData(context, productId);
  if (!editorState.ok) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / Catalogo / Productos / Preview Storefront</div>
        <div className="adminBanner adminBannerError">
          <p>No se pudo cargar el producto Admin antes de consultar Storefront.</p>
          <p className="adminContextHint">{editorState.error}</p>
          {editorState.correlationId ? <p className="adminContextHint">Correlation: {editorState.correlationId}</p> : null}
        </div>
        <Link className="adminButton" href="/admin/products">
          Volver al catalogo
        </Link>
      </main>
    );
  }

  const storefrontPreview = await getProductStorefrontPreview(context, editorState.data);
  const warnings = previewWarningList(editorState.data);
  const product = editorState.data.product;
  const canonical = canonicalPath(editorState.data);
  const preview = storefrontPreview.data;

  return (
    <main className="adminPage productStorefrontPreviewPage">
      <div className="adminBreadcrumb">Admin / Catalogo / Productos / Preview Storefront</div>
      <div className="adminPageHeader">
        <div>
          <h1 className="adminPageTitle">Preview Storefront</h1>
          <p className="adminPageIntro">
            Lectura real desde Storefront BFF para validar PDP, canonical y disponibilidad sin generar una URL publica de preview.
          </p>
        </div>
        <div className="adminButtonRow">
          <Link className="adminButton" href={`/admin/products/${encodeURIComponent(productId)}`}>
            <ArrowLeft aria-hidden="true" size={16} />
            Volver al editor
          </Link>
          <Link className="adminButton" href="/admin/products">
            Ir al catalogo
          </Link>
        </div>
      </div>

      <div className="adminBanner">
        <p>Esta pantalla Admin declara `noindex, nofollow` y consulta Storefront desde servidor. No crea rutas publicas indexables.</p>
      </div>

      {warnings.length > 0 ? (
        <div className="adminBanner adminBannerWarn">
          <p>El producto puede no estar disponible en Storefront publico:</p>
          {warnings.map((warning) => <p className="adminContextHint" key={warning}>{warning}</p>)}
        </div>
      ) : null}

      {!storefrontPreview.ok ? (
        <div className="adminBanner adminBannerError">
          <p>Storefront BFF no devolvio un PDP renderizable para este producto.</p>
          <p className="adminContextHint">{storefrontPreview.error}</p>
          <code>{storefrontPreview.requestedPath}</code>
          {storefrontPreview.correlationId ? <p className="adminContextHint">Correlation: {storefrontPreview.correlationId}</p> : null}
        </div>
      ) : null}

      <section className="adminSummaryGrid productStorefrontPreviewSummary" aria-label="Estado de preview">
        <div>
          <span>Producto Admin</span>
          <strong>{product.isActive && product.isVisible ? "Activo y visible" : "No publico"}</strong>
        </div>
        <div>
          <span>Canonical</span>
          <strong>{canonical}</strong>
        </div>
        <div>
          <span>Routing/SEO</span>
          <strong>{routeStatus(editorState.data)}</strong>
        </div>
        <div>
          <span>Storefront BFF</span>
          <strong>{storefrontPreview.ok ? "PDP encontrado" : `No renderizable${storefrontPreview.status ? ` (${storefrontPreview.status})` : ""}`}</strong>
        </div>
      </section>

      <section className="adminCard productStorefrontPreviewCard">
        <div className="adminCardHeader">
          <div>
            <h2>PDP desde Storefront</h2>
            <p>{storefrontPreview.requestedPath}</p>
          </div>
          <span className={`adminBadge ${storefrontPreview.ok ? "adminBadgeOk" : "adminBadgeWarn"}`}>
            <MonitorSmartphone aria-hidden="true" size={14} />
            {storefrontPreview.ok ? "Respuesta real" : "Sin PDP"}
          </span>
        </div>

        {preview ? (
          <div className="productStorefrontPreviewLayout">
            <section className="productStorefrontPreviewMedia" aria-label="Imagen Storefront">
              {preview.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.imageUrl} alt={preview.imageAlt ?? preview.title} />
              ) : (
                <div>
                  <AlertTriangle aria-hidden="true" size={24} />
                  <span>Storefront no devolvio imagen principal.</span>
                </div>
              )}
            </section>

            <section className="productStorefrontPreviewInfo">
              {preview.breadcrumbs.length > 0 ? (
                <p className="productStorefrontPreviewBreadcrumb">{preview.breadcrumbs.join(" / ")}</p>
              ) : null}
              <p className="productPreviewBrandRow">
                <span>{preview.brand ?? product.brandName ?? "Sin marca"}</span>
                <span>{preview.category ?? product.categoryName ?? "Sin categoria"}</span>
              </p>
              <h2>{preview.title}</h2>
              {preview.shortDescription ? <p className="productStorefrontPreviewLead">{preview.shortDescription}</p> : null}
              <div className="productPreviewPriceBlock">
                <strong>{preview.priceDisplay ?? "Sin precio Storefront"}</strong>
                <span>{preview.availability}</span>
              </div>
              <dl className="productPreviewMetaGrid">
                <div><dt>Slug</dt><dd>{preview.slug || product.slug}</dd></div>
                <div><dt>Variantes</dt><dd>{preview.variantsCount}</dd></div>
                <div><dt>Producto</dt><dd>{preview.productId ?? product.productId}</dd></div>
                <div><dt>Canonical Admin</dt><dd>{canonical}</dd></div>
              </dl>
              <section className="productPreviewSection">
                <h4>Descripcion Storefront</h4>
                <p>{preview.description ?? "Storefront no devolvio descripcion extendida."}</p>
              </section>
            </section>
          </div>
        ) : (
          <div className="adminEmptyState productStorefrontPreviewEmpty">
            <h2>PDP no disponible en Storefront</h2>
            <p>Revisa publicacion, visibilidad, canonical activo, proyecciones e indexacion antes de considerar esta ficha lista para publico.</p>
            <Link className="adminButton" href={`/admin/products/${encodeURIComponent(productId)}`}>
              <ExternalLink aria-hidden="true" size={16} />
              Abrir editor
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
