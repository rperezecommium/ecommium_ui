import Link from "next/link";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { createEmptyProductDraft, draftFromEditorData, duplicateDraftFromEditorData } from "./product-editor-draft";
import { ProductEditorClient } from "./product-editor-client";
import { getAdminProductEditorData, getProductEditorLookups } from "./products";

type ProductEditorPageProps = {
  context: AdminContext;
  productId?: string;
  duplicateFromProductId?: string;
  initialPreviewOpen?: boolean;
};

function productEditorContextIdentity(context: AdminContext) {
  return [
    context.organizationId,
    context.shopId,
    context.locale,
    context.currency,
    context.country,
    context.channel,
  ].join(":");
}

export async function ProductEditorPage({
  context,
  productId,
  duplicateFromProductId,
  initialPreviewOpen = false,
}: ProductEditorPageProps) {
  if (!hasRequiredAdminContext(context)) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / Catalogo / Productos</div>
        <div className="adminBanner adminBannerError">
          <p>Selecciona Organization y Shop antes de crear o editar productos.</p>
          <Link className="adminButton" href="/admin/configuracion/contexto">
            Ir a contexto
          </Link>
        </div>
      </main>
    );
  }

  if (!productId && duplicateFromProductId) {
    const [result, lookups] = await Promise.all([
      getAdminProductEditorData(context, duplicateFromProductId),
      getProductEditorLookups(context),
    ]);

    if (!result.ok) {
      return (
        <main className="adminPage">
          <div className="adminBreadcrumb">Admin / Catalogo / Productos / Duplicar</div>
          <div className="adminBanner adminBannerError">
            <p>No se pudo preparar la copia del producto.</p>
            <p className="adminContextHint">{result.error}</p>
            {result.correlationId ? <p className="adminContextHint">Correlation: {result.correlationId}</p> : null}
          </div>
          <Link className="adminButton" href="/admin/products">
            Volver al catalogo
          </Link>
        </main>
      );
    }

    return (
      <ProductEditorClient
        contextIdentity={productEditorContextIdentity(context)}
        initialDraft={duplicateDraftFromEditorData(result.data, context.locale, context.currency)}
        locale={context.locale}
        currency={context.currency}
        lookups={lookups}
        storageScope={`duplicate:${duplicateFromProductId}`}
        initialNotice={`Copia creada desde ${result.data.product.name}. Se mantiene fuera de linea, sin sitemap, sin stock vendible y sin media compartida hasta que la revises.`}
      />
    );
  }

  if (!productId) {
    const lookups = await getProductEditorLookups(context);

    return (
      <ProductEditorClient
        contextIdentity={productEditorContextIdentity(context)}
        initialDraft={createEmptyProductDraft(context.locale, context.currency)}
        locale={context.locale}
        currency={context.currency}
        lookups={lookups}
        initialPreviewOpen={initialPreviewOpen}
      />
    );
  }

  const [result, lookups] = await Promise.all([
    getAdminProductEditorData(context, productId),
    getProductEditorLookups(context),
  ]);

  if (!result.ok) {
    return (
      <main className="adminPage">
        <div className="adminBreadcrumb">Admin / Catalogo / Productos / Editar</div>
        <div className="adminBanner adminBannerError">
          <p>No se pudo cargar el producto.</p>
          <p className="adminContextHint">{result.error}</p>
          {result.correlationId ? <p className="adminContextHint">Correlation: {result.correlationId}</p> : null}
        </div>
        <Link className="adminButton" href="/admin/products">
          Volver al catalogo
        </Link>
      </main>
    );
  }

  return (
    <>
      {result.data.warnings.length > 0 ? (
        <div className="adminBanner adminBannerInfo">
          {result.data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}
      <ProductEditorClient
        contextIdentity={productEditorContextIdentity(context)}
        initialDraft={draftFromEditorData(result.data, context.locale, context.currency)}
        initialVariantRows={result.data.variantRows}
        locale={context.locale}
        currency={context.currency}
        lookups={lookups}
        initialPreviewOpen={initialPreviewOpen}
      />
    </>
  );
}
