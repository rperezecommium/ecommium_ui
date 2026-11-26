"use server";

import { normalizeVariantMedia } from "./product-variant-media";
import { getCurrentAdminSession as getAdminSession } from "../auth/current-admin-session";
import type { CatalogCreateInput } from "./catalog-taxonomy-schema";
import { formFailure } from "../../shared/validation/admin-form-state";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import { createCatalogEntity, listCatalogEntities, toLookupOptions, type CatalogEntityKind } from "./catalog-taxonomy";
import { getAdminProductEditorData, makeProductGateway } from "./products";
import type {
  ProductAppliedPricePreview,
  ProductAppliedPricePreviewInput,
  ProductDraft,
  ProductDraftMediaStateReport,
  ProductDraftMediaUploadReport,
  ProductLookupOption,
  ProductOfferingRecord,
  ProductSaveBlocks,
  ProductSaveReport,
} from "./product-editor-types";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function productListReturnUrl(value: FormDataEntryValue | null) {
  const fallback = "/admin/products";
  const raw = asString(value);
  if (!raw || !raw.startsWith("/admin/products")) {
    return fallback;
  }

  return raw.startsWith("/admin/products/new") ? fallback : raw;
}

function redirectWithProductMessage(returnTo: string, message: string): never {
  const [path, query = ""] = returnTo.split("?");
  const params = new URLSearchParams(query);
  params.set("productMessage", message);

  revalidatePath("/admin/products");
  redirect(`${path}?${params.toString()}`);
}

async function patchProductRouteInactive(
  context: Awaited<ReturnType<typeof getAdminContext>>,
  routeId: string,
  locale: string,
) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale,
  });

  return requestAdminBff(`/admin/routing-seo/routes/${encodeURIComponent(routeId)}?${params.toString()}`, {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "INACTIVE",
        includeInSitemap: false,
      }),
    },
    parse: (value) => value as Record<string, unknown>,
  });
}

type ProductDeactivationResult = {
  ok: boolean;
  message: string;
  routeFailures: number;
};

async function deactivateProductById(
  context: Awaited<ReturnType<typeof getAdminContext>>,
  productId: string,
): Promise<ProductDeactivationResult> {
  const editorState = await getAdminProductEditorData(context, productId);
  if (!editorState.ok) {
    return {
      ok: false,
      message: `No se pudo cargar el producto antes de desactivarlo. ${editorState.error}`,
      routeFailures: 0,
    };
  }

  const product = editorState.data.product;
  const result = await makeProductGateway(context).updateProduct(productId, {
    name: product.name,
    refId: product.reference ?? product.defaultVariantId,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId,
    isVisible: false,
    isActive: false,
    keywords: product.keywords,
    title: product.metaTitle || product.name,
    taxCode: product.taxCode,
    metaTagDescription: product.metaDescription,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.status === 403 ? "Falta permiso catalog.products.write." : result.error,
      routeFailures: 0,
    };
  }

  const locale = context.locale ?? "es-ES";
  const routes = [
    editorState.data.routingSeo?.canonicalRoute,
    ...(editorState.data.routingSeo?.aliases ?? []),
  ].filter((route): route is NonNullable<typeof route> => Boolean(route?.routeId));
  const routeResults = await Promise.all(routes.map((route) => patchProductRouteInactive(context, route.routeId as string, locale)));
  const routeFailures = routeResults.filter((routeResult) => !routeResult.ok).length;
  const routeMessage = routeFailures > 0
    ? " Producto desactivado; revisa Routing/SEO porque alguna ruta no se pudo inactivar."
    : " Rutas SEO inactivadas fuera de sitemap.";

  return {
    ok: true,
    message: `Producto desactivado y oculto.${routes.length > 0 ? routeMessage : ""}`,
    routeFailures,
  };
}

const defaultProductSaveBlocks: ProductSaveBlocks = {
  catalog: "pending",
  variants: "pending",
  media: "pending",
  variantMedia: "pending",
  specifications: "pending",
  pricing: "pending",
  inventory: "pending",
  shipping: "pending",
  routingSeo: "pending",
  publish: "pending",
};

function parseDraft(value: FormDataEntryValue | null): ProductDraft | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as ProductDraft;
  } catch {
    return null;
  }
}

function sanitizeDraftForBff(draft: ProductDraft): ProductDraft {
  draft = normalizeVariantMedia(draft);
  const routingSeo = draft.routingSeo;
  if (!routingSeo) {
    return draft;
  }

  return {
    ...draft,
    routingSeo: {
      canonicalPath: routingSeo.canonicalPath,
      status: routingSeo.status,
      includeInSitemap: routingSeo.includeInSitemap,
      createRedirectFromPreviousPath: routingSeo.createRedirectFromPreviousPath,
      aliases: routingSeo.aliases.map((alias) => ({
        routeId: alias.routeId,
        path: alias.path,
        routeKind: "ALIAS",
        status: alias.status,
        includeInSitemap: false,
        markedForDeletion: alias.markedForDeletion,
      })),
    },
  };
}

function parseProductSaveReport(value: unknown): ProductSaveReport {
  if (!value || typeof value !== "object" || typeof (value as { ok?: unknown }).ok !== "boolean") {
    throw new Error("Invalid product save report");
  }
  const report = value as ProductSaveReport;
  return {
    ...report,
    recoveryActions: (report.recoveryActions ?? []).map((action) => {
      const wire = action as typeof action & { actionId?: string; block?: string; kind?: string };
      return {
        code: wire.code ?? wire.actionId ?? "continue_editing",
        label: wire.label,
        targetBlock: wire.targetBlock ?? wire.block,
        retryable: wire.retryable ?? wire.kind === "retry",
      };
    }),
  };
}

export async function uploadProductDraftMediaAction(
  clientDraftId: string,
  formData: FormData,
): Promise<ProductDraftMediaUploadReport> {
  const normalizedClientDraftId = clientDraftId.trim();
  if (!normalizedClientDraftId) {
    return {
      ok: false,
      messages: ["No se pudo identificar el borrador de producto."],
      fieldErrors: {
        clientDraftId: "Borrador invalido.",
      },
      correlationIds: [],
    };
  }

  const context = await getAdminContext();
  if (!context.organizationId || !context.shopId) {
    return {
      ok: false,
      messages: ["Falta contexto Admin canonico."],
      fieldErrors: {
        context: "Selecciona Organization y Shop antes de subir imagenes.",
      },
      correlationIds: [],
    };
  }

  const idempotencyKeyEntry = formData.get("idempotencyKey");
  const idempotencyKey =
    typeof idempotencyKeyEntry === "string" && idempotencyKeyEntry.trim()
      ? idempotencyKeyEntry.trim()
      : crypto.randomUUID();
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: context.locale,
  });

  const result = await requestAdminBff<ProductDraftMediaUploadReport>(
    `/admin/product-drafts/${encodeURIComponent(normalizedClientDraftId)}/media?${params.toString()}`,
    {
      context,
      init: {
        method: "POST",
        headers: {
          "idempotency-key": idempotencyKey,
        },
        body: formData,
      },
      parse: (value) => value as ProductDraftMediaUploadReport,
    },
  );

  if (result.ok) {
    return {
      ...result.data,
      correlationIds: Array.from(new Set([...(result.data.correlationIds ?? []), result.correlationId])),
    };
  }

  return {
    ok: false,
    messages: [`No se pudo subir la imagen. ${result.error}`],
    fieldErrors: {
      media: result.error,
    },
    correlationIds: [result.correlationId],
  };
}

export async function readProductDraftMediaStateAction(clientDraftId: string): Promise<ProductDraftMediaStateReport> {
  const normalizedClientDraftId = clientDraftId.trim();
  if (!normalizedClientDraftId) {
    return {
      ok: false,
      mediaItems: [],
      warnings: [],
      messages: ["No se pudo identificar el borrador de producto."],
      fieldErrors: {
        clientDraftId: "Borrador invalido.",
      },
      correlationIds: [],
    };
  }

  const context = await getAdminContext();
  if (!context.organizationId || !context.shopId) {
    return {
      ok: false,
      mediaItems: [],
      warnings: [],
      messages: ["Falta contexto Admin canonico."],
      fieldErrors: {
        context: "Selecciona Organization y Shop antes de recuperar imagenes.",
      },
      correlationIds: [],
    };
  }

  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: context.locale,
  });
  const result = await requestAdminBff<ProductDraftMediaStateReport>(
    `/admin/product-drafts/${encodeURIComponent(normalizedClientDraftId)}?${params.toString()}`,
    {
      context,
      init: {
        method: "GET",
      },
      parse: (value) => value as ProductDraftMediaStateReport,
    },
  );

  if (result.ok) {
    return {
      ...result.data,
      mediaItems: result.data.mediaItems ?? [],
      warnings: result.data.warnings ?? [],
      correlationIds: Array.from(new Set([...(result.data.correlationIds ?? []), result.correlationId])),
    };
  }

  return {
    ok: false,
    mediaItems: [],
    warnings: [],
    messages: [`No se pudieron recuperar imagenes del borrador. ${result.error}`],
    fieldErrors: {
      media: result.error,
    },
    correlationIds: [result.correlationId],
  };
}

export async function previewAppliedProductPriceAction(
  input: ProductAppliedPricePreviewInput,
): Promise<ProductAppliedPricePreview> {
  const context = await getAdminContext();
  if (!context.organizationId || !context.shopId) {
    return {
      ok: false,
      status: "NOT_APPLIED",
      reason: "Selecciona Organization y Shop antes de simular precios.",
      requested: {
        productId: input.productId ?? null,
        variantId: input.variantId ?? null,
        defaultVariantId: input.defaultVariantId ?? null,
        currency: input.currency || context.currency || null,
        country: input.country || context.country || null,
        tradePolicy: input.tradePolicy ?? null,
        channel: input.channel || context.channel || null,
        customerGroup: input.customerGroup ?? null,
        priceTableId: input.priceTableId ?? null,
        quantity: Number(input.quantity ?? 1),
        at: input.at ?? null,
      },
      resolution: {
        source: "NONE",
        usedFallback: false,
      },
      price: null,
      conditions: [],
      correlationIds: [],
    };
  }

  const result = await makeProductGateway(context).previewAppliedPrice(input);
  if (result.ok) {
    return {
      ...result.data,
      correlationIds: Array.from(new Set([...(result.data.correlationIds ?? []), result.correlationId])),
    };
  }

  return {
    ok: false,
    status: "ERROR",
    reason: `No se pudo simular el precio. ${result.error}`,
    requested: {
      productId: input.productId ?? null,
      variantId: input.variantId ?? null,
      defaultVariantId: input.defaultVariantId ?? null,
      currency: input.currency || context.currency || null,
      country: input.country || context.country || null,
      tradePolicy: input.tradePolicy ?? null,
      channel: input.channel || context.channel || null,
      customerGroup: input.customerGroup ?? null,
      priceTableId: input.priceTableId ?? null,
      quantity: Number(input.quantity ?? 1),
      at: input.at ?? null,
    },
    resolution: {
      source: "NONE",
      usedFallback: false,
    },
    price: null,
    conditions: [],
    correlationIds: [result.correlationId],
  };
}

export async function deactivateProductAction(formData: FormData) {
  const context = await getAdminContext();
  const productId = asString(formData.get("productId"));
  const returnTo = productListReturnUrl(formData.get("returnTo"));
  const confirmed = formData.get("confirmDeactivate") === "yes";

  if (!context.organizationId || !context.shopId) {
    redirectWithProductMessage(returnTo, "Selecciona Organization y Shop antes de desactivar productos.");
  }
  if (!productId) {
    redirectWithProductMessage(returnTo, "No se pudo identificar el producto.");
  }
  if (!confirmed) {
    redirectWithProductMessage(returnTo, "Marca la confirmacion antes de desactivar el producto.");
  }

  const result = await deactivateProductById(context, productId);
  redirectWithProductMessage(returnTo, result.message);
}

export async function bulkDeactivateProductsAction(formData: FormData) {
  const context = await getAdminContext();
  const returnTo = productListReturnUrl(formData.get("returnTo"));
  const confirmed = formData.get("confirmBulkDeactivate") === "yes";
  const productIds = Array.from(new Set(
    formData.getAll("productIds")
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean),
  ));

  if (!context.organizationId || !context.shopId) {
    redirectWithProductMessage(returnTo, "Selecciona Organization y Shop antes de desactivar productos.");
  }
  if (productIds.length === 0) {
    redirectWithProductMessage(returnTo, "Selecciona al menos un producto.");
  }
  if (!confirmed) {
    redirectWithProductMessage(returnTo, "Marca la confirmacion antes de desactivar productos seleccionados.");
  }

  const results: ProductDeactivationResult[] = [];
  for (const productId of productIds) {
    results.push(await deactivateProductById(context, productId));
  }

  const okCount = results.filter((result) => result.ok).length;
  const failedCount = results.length - okCount;
  const routeFailureCount = results.reduce((total, result) => total + result.routeFailures, 0);
  const okLabel = okCount === 1 ? "1 producto desactivado y oculto" : `${okCount} productos desactivados y ocultos`;
  const failedLabel = failedCount === 1 ? "1 no se pudo desactivar" : `${failedCount} no se pudieron desactivar`;
  const messageParts = [
    okCount > 0 ? okLabel : "No se pudo desactivar ningun producto",
    failedCount > 0 ? failedLabel : undefined,
    routeFailureCount > 0 ? "Revisa Routing/SEO: alguna ruta no se pudo inactivar." : undefined,
  ].filter(Boolean);

  redirectWithProductMessage(returnTo, messageParts.join(". "));
}

export async function saveProductDraftAction(formData: FormData): Promise<ProductSaveReport> {
  const draft = parseDraft(formData.get("draft"));

  if (!draft) {
    return {
      ok: false,
      blocks: {
        ...defaultProductSaveBlocks,
        catalog: "failed",
      },
      messages: ["No se pudo leer el borrador de producto."],
      fieldErrors: {
        draft: "Borrador invalido.",
      },
      recoveryActions: [],
      correlationIds: [],
    };
  }

  const context = await getAdminContext();
  if (!context.organizationId || !context.shopId) {
    return {
      ok: false,
      blocks: {
        ...defaultProductSaveBlocks,
        catalog: "failed",
      },
      messages: ["Falta contexto Admin canonico."],
      fieldErrors: {
        context: "Selecciona Organization y Shop antes de guardar productos.",
      },
      recoveryActions: [],
      correlationIds: [],
    };
  }

  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: context.locale,
  });

  const idempotencyKeyEntry = formData.get("idempotencyKey");
  const idempotencyKey =
    typeof idempotencyKeyEntry === "string" && idempotencyKeyEntry.trim()
      ? idempotencyKeyEntry.trim()
      : crypto.randomUUID();
  formData.set("draft", JSON.stringify(sanitizeDraftForBff(draft)));

  const result = await requestAdminBff<ProductSaveReport>(`/admin/product-save-operations?${params.toString()}`, {
    context,
    timeoutMs: 60_000,
    init: {
      method: "POST",
      headers: {
        "idempotency-key": idempotencyKey,
      },
      body: formData,
    },
    parse: parseProductSaveReport,
  });

  if (result.ok) {
    return {
      ...result.data,
      blocks: {
        ...defaultProductSaveBlocks,
        ...result.data.blocks,
      },
      recoveryActions: parseProductSaveReport(result.data).recoveryActions,
      draftPatch: result.data.draftPatch ? {
        ...result.data.draftPatch,
        specifications: result.data.draftPatch.specifications ? {
          ...result.data.draftPatch.specifications,
          selections: result.data.draftPatch.specifications.selections.map((selection) => {
            const previous = draft.specifications.selections.find((item) =>
              item.fieldId === selection.fieldId && item.fieldValueId === selection.fieldValueId);
            return {
              ...selection,
              fieldName: selection.fieldName || previous?.fieldName,
              valueName: selection.valueName || previous?.valueName,
            };
          }),
        } : undefined,
      } : undefined,
      correlationIds: Array.from(new Set([...(result.data.correlationIds ?? []), result.correlationId])),
    };
  }

  const uncertain = !result.status || result.status < 400 || result.status === 408 || result.status === 429 || result.status >= 500;
  return {
    ok: false,
    retryable: uncertain,
    status: uncertain ? "unconfirmed" : "rejected",
    blocks: { ...defaultProductSaveBlocks },
    messages: [uncertain
      ? `No se pudo confirmar el resultado del guardado. ${result.error}`
      : `El guardado fue rechazado. ${result.error}`],
    fieldErrors: {
      operation: result.error,
    },
    recoveryActions: uncertain ? [{
      code: "retry_operation",
      label: "Reintentar guardado",
      targetBlock: "catalog",
      retryable: true,
    }] : [{ code: "continue_editing", label: "Revisar datos del guardado", targetBlock: "catalog", retryable: false }],
    correlationIds: [result.correlationId],
  };
}

type LookupActionResult = {
  ok: boolean;
  options: ProductLookupOption[];
  option?: ProductLookupOption;
  message?: string;
  total?: number;
  offset?: number;
  limit?: number;
};

async function searchCatalogEntityOptions(kind: CatalogEntityKind, q: string, offset = 0, includeInactive = false): Promise<LookupActionResult> {
  if (!Number.isSafeInteger(offset) || offset < 0 || typeof q !== "string" || q.length > 200) return { ok: false, options: [], message: "Búsqueda de categorías no válida." };
  const context = await getAdminContext();
  const result = await listCatalogEntities(context, kind, {
    q,
    isActive: includeInactive ? undefined : true,
    limit: 100,
    offset,
  });

  return {
    ok: result.source === "bff",
    options: toLookupOptions(result),
    message: result.message,
    total: result.total,
    offset: result.offset,
    limit: result.limit,
  };
}

async function createCatalogEntityOption(kind: CatalogEntityKind, input: CatalogCreateInput): Promise<LookupActionResult> {
  const session = await getAdminSession();
  if (!session?.permissions.some(permission => ["*", "admin:*", "system.admin", `catalog.${kind}.write`].includes(permission))) {
    return {ok: false, options: [], message: "No tienes permiso para crear este registro."};
  }
  const context = await getAdminContext();
  const created = await createCatalogEntity(context, kind, input);

  if (!created.ok) {
    return {
      ok: false,
      options: [],
      message: created.error,
    };
  }

  const refreshed = await listCatalogEntities(context, kind, {
    q: created.data.label,
    isActive: true,
    limit: 100,
    offset: 0,
  });
  const option = {
    id: created.data.id,
    label: created.data.label,
    slug: created.data.slug,
  };

  return {
    ok: true,
    option,
    options: refreshed.source === "bff" ? toLookupOptions(refreshed) : [option],
  };
}

export async function searchProductCategoriesAction(q: string, offset = 0, includeInactive = false) {
  return searchCatalogEntityOptions("categories", q, offset, includeInactive === true);
}

export async function searchProductBrandsAction(q: string, offset = 0) {
  return searchCatalogEntityOptions("brands", q, offset);
}


export async function createProductCategoryInlineAction(input: CatalogCreateInput) {
  try { return await createCatalogEntityOption("categories", input); }
  catch (error) { const failure = formFailure(error); return { ok: false, options: [], message: failure.error, fieldErrors: failure.fieldErrors }; }
}

export async function createProductBrandInlineAction(input: CatalogCreateInput) {
  try { return await createCatalogEntityOption("brands", input); }
  catch (error) { const failure = formFailure(error); return { ok: false, options: [], message: failure.error, fieldErrors: failure.fieldErrors }; }
}

export async function deleteProductVariantAction(variantId: string) {
  if (!variantId.trim()) {
    return {
      ok: false,
      message: "La variante no esta persistida en Catalog.",
    };
  }

  const context = await getAdminContext();
  const result = await makeProductGateway(context).deleteVariant(variantId);

  return {
    ok: result.ok,
    message: result.ok ? "Variante eliminada." : result.error,
    correlationId: result.correlationId,
  };
}

type OfferingActionResult = {
  ok: boolean;
  offerings: ProductOfferingRecord[];
  offering?: ProductOfferingRecord;
  message?: string;
  correlationId?: string;
};

export async function attachExistingOfferingToVariantAction(input: {
  variantId?: string;
  offeringId: string;
}): Promise<OfferingActionResult> {
  if (!input.variantId) {
    return {
      ok: false,
      offerings: [],
      message: "Guarda el producto y la variante antes de asignar offerings.",
    };
  }

  if (!input.offeringId) {
    return {
      ok: false,
      offerings: [],
      message: "Selecciona un offering existente.",
    };
  }

  const context = await getAdminContext();
  const gateway = makeProductGateway(context);
  const attached = await gateway.attachOfferingToVariant({
    offeringId: input.offeringId,
    variantId: input.variantId,
  });

  if (!attached.ok) {
    return {
      ok: false,
      offerings: [],
      message: attached.error,
      correlationId: attached.correlationId,
    };
  }

  if (attached.data.offerings?.some((offering) => offering.offeringId === input.offeringId)) {
    return { ok: true, offerings: attached.data.offerings, message: "Servicio agregado.", correlationId: attached.correlationId };
  }

  const refreshed = await gateway.resolveOfferingsBatchByVariants([input.variantId]);

  const offerings = refreshed.ok ? refreshed.data[input.variantId] ?? [] : [];
  const confirmed = refreshed.ok && offerings.some((offering) => offering.offeringId === input.offeringId);

  return {
    ok: confirmed,
    offerings,
    message: confirmed ? "Servicio agregado." : refreshed.ok ? "El servicio se ha asociado, pero no se pudo confirmar en el listado. Recarga antes de volver a agregarlo." : refreshed.error,
    correlationId: refreshed.correlationId ?? attached.correlationId,
  };
}

export async function detachOfferingFromVariantAction(input: {
  variantId?: string;
  offeringId: string;
}): Promise<OfferingActionResult> {
  if (!input.variantId) {
    return {
      ok: false,
      offerings: [],
      message: "La variante no esta persistida en Catalog.",
    };
  }

  const context = await getAdminContext();
  const gateway = makeProductGateway(context);
  const detached = await gateway.detachOfferingFromVariant({
    offeringId: input.offeringId,
    variantId: input.variantId,
  });

  if (!detached.ok) {
    return {
      ok: false,
      offerings: [],
      message: detached.error,
      correlationId: detached.correlationId,
    };
  }

  const offerings = detached.data.offerings;
  const confirmed = Boolean(offerings && !offerings.some(item => item.offeringId === input.offeringId));
  return {
    ok: confirmed,
    offerings: confirmed ? offerings! : [],
    message: confirmed ? detached.data.message : "Retirada aceptada, pero falta confirmar el estado de los servicios. No repitas la operación.",
    correlationId: detached.correlationId,
  };
}

export async function setOfferingVariantActivationAction(input: {
  variantId?: string;
  offeringId: string;
  active: boolean;
}): Promise<OfferingActionResult> {
  if (!input.variantId) {
    return {
      ok: false,
      offerings: [],
      message: "La variante no esta persistida en Catalog.",
    };
  }

  const context = await getAdminContext();
  const gateway = makeProductGateway(context);
  const updated = await gateway.setOfferingVariantActivation({
    offeringId: input.offeringId,
    variantId: input.variantId,
    active: input.active,
  });

  if (!updated.ok) {
    return {
      ok: false,
      offerings: [],
      message: updated.error,
      correlationId: updated.correlationId,
    };
  }

  const offerings = updated.data.offerings;
  const confirmed = updated.data.updated !== false && Boolean(offerings?.some(item => item.offeringId === input.offeringId && item.active === input.active));
  return {
    ok: confirmed,
    offerings: confirmed ? offerings! : [],
    message: confirmed ? updated.data.message : updated.data.updated === false ? "No existe la relación con este servicio." : "Cambio aceptado, pero falta confirmar el estado de los servicios. No repitas la operación.",
    correlationId: updated.correlationId,
  };
}
