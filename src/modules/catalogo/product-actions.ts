"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { requestBff } from "../../shared/bff/client";
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

  return requestBff(`/admin/routing-seo/routes/${encodeURIComponent(routeId)}?${params.toString()}`, {
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

  const result = await requestBff<ProductDraftMediaUploadReport>(
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
  const result = await requestBff<ProductDraftMediaStateReport>(
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
        currency: input.currency ?? context.currency ?? "EUR",
        country: input.country ?? context.country ?? "ES",
        tradePolicy: input.tradePolicy ?? "default",
        channel: input.channel ?? context.channel ?? "web",
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
    status: "NOT_APPLIED",
    reason: `No se pudo simular el precio. ${result.error}`,
    requested: {
      productId: input.productId ?? null,
      variantId: input.variantId ?? null,
      defaultVariantId: input.defaultVariantId ?? null,
      currency: input.currency ?? context.currency ?? "EUR",
      country: input.country ?? context.country ?? "ES",
      tradePolicy: input.tradePolicy ?? "default",
      channel: input.channel ?? context.channel ?? "web",
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

  const result = await requestBff<ProductSaveReport>(`/admin/product-save-operations?${params.toString()}`, {
    context,
    init: {
      method: "POST",
      headers: {
        "idempotency-key": idempotencyKey,
      },
      body: formData,
    },
    parse: (value) => value as ProductSaveReport,
  });

  if (result.ok) {
    return {
      ...result.data,
      blocks: {
        ...defaultProductSaveBlocks,
        ...result.data.blocks,
      },
      recoveryActions: result.data.recoveryActions ?? [],
      correlationIds: Array.from(new Set([...(result.data.correlationIds ?? []), result.correlationId])),
    };
  }

  return {
    ok: false,
    blocks: {
      ...defaultProductSaveBlocks,
      catalog: "failed",
    },
    messages: [`No se pudo guardar el producto. ${result.error}`],
    fieldErrors: {
      operation: result.error,
    },
    recoveryActions: [{
      code: "retry_operation",
      label: "Reintentar guardado",
      targetBlock: "catalog",
      retryable: true,
    }],
    correlationIds: [result.correlationId],
  };
}

type LookupActionResult = {
  ok: boolean;
  options: ProductLookupOption[];
  option?: ProductLookupOption;
  message?: string;
};

async function searchCatalogEntityOptions(kind: CatalogEntityKind, q: string): Promise<LookupActionResult> {
  const context = await getAdminContext();
  const result = await listCatalogEntities(context, kind, {
    q,
    isActive: true,
    limit: 100,
    offset: 0,
  });

  return {
    ok: result.source === "bff",
    options: toLookupOptions(result),
    message: result.message,
  };
}

async function createCatalogEntityOption(kind: CatalogEntityKind, name: string): Promise<LookupActionResult> {
  const context = await getAdminContext();
  const created = await createCatalogEntity(context, kind, {
    name,
    isActive: true,
  });

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

export async function searchProductCategoriesAction(q: string) {
  return searchCatalogEntityOptions("categories", q);
}

export async function searchProductBrandsAction(q: string) {
  return searchCatalogEntityOptions("brands", q);
}

export async function createProductCategoryInlineAction(name: string) {
  return createCatalogEntityOption("categories", name);
}

export async function createProductBrandInlineAction(name: string) {
  return createCatalogEntityOption("brands", name);
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

  const refreshed = await gateway.listOfferingsByVariant(input.variantId);

  return {
    ok: refreshed.ok,
    offerings: refreshed.ok ? refreshed.data : [],
    message: refreshed.ok ? attached.data.message : refreshed.error,
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

  const refreshed = await gateway.listOfferingsByVariant(input.variantId);

  return {
    ok: refreshed.ok,
    offerings: refreshed.ok ? refreshed.data : [],
    message: refreshed.ok ? detached.data.message : refreshed.error,
    correlationId: refreshed.correlationId ?? detached.correlationId,
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

  const refreshed = await gateway.listOfferingsByVariant(input.variantId);

  return {
    ok: refreshed.ok,
    offerings: refreshed.ok ? refreshed.data : [],
    message: refreshed.ok ? updated.data.message : refreshed.error,
    correlationId: refreshed.correlationId ?? updated.correlationId,
  };
}
