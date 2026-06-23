"use server";

import { getAdminContext } from "../../shared/config/admin-context";
import { createCatalogEntity, listCatalogEntities, toLookupOptions, type CatalogEntityKind } from "./catalog-taxonomy";
import { makeProductGateway } from "./products";
import { saveProductDraft } from "./product-save-orchestrator";
import type { ProductDraft, ProductDraftMediaFile, ProductLookupOption, ProductOfferingRecord, ProductSaveReport } from "./product-editor-types";

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

function formDataFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function formDataMediaFiles(formData: FormData): ProductDraftMediaFile[] {
  const files = formDataFiles(formData);
  const localIds = formData
    .getAll("fileLocalIds")
    .map((value) => typeof value === "string" ? value.trim() : "")
    .filter(Boolean);

  return files
    .map((file, index) => ({
      file,
      localId: localIds[index] ?? "",
    }))
    .filter((item): item is ProductDraftMediaFile => Boolean(item.localId));
}

export async function saveProductDraftAction(formData: FormData): Promise<ProductSaveReport> {
  const draft = parseDraft(formData.get("draft"));

  if (!draft) {
    return {
      ok: false,
      blocks: {
        catalog: "failed",
        variants: "pending",
        media: "pending",
        variantMedia: "pending",
        pricing: "pending",
        inventory: "pending",
      },
      messages: ["No se pudo leer el borrador de producto."],
      fieldErrors: {
        draft: "Borrador invalido.",
      },
      correlationIds: [],
    };
  }

  const context = await getAdminContext();
  return saveProductDraft({
    draft,
    context,
    gateway: makeProductGateway(context),
    files: formDataFiles(formData),
    mediaFiles: formDataMediaFiles(formData),
  });
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

export async function createAndAttachOfferingAction(input: {
  variantId?: string;
  name: string;
  type: string;
  priceMinor: number;
  currency: string;
  active: boolean;
}): Promise<OfferingActionResult> {
  if (!input.variantId) {
    return {
      ok: false,
      offerings: [],
      message: "Guarda el producto y la variante antes de asignar offerings.",
    };
  }

  const context = await getAdminContext();
  const gateway = makeProductGateway(context);
  const created = await gateway.createOffering({
    type: input.type.trim() || "service",
    priceMinor: input.priceMinor,
    currency: input.currency,
    localizedName: [{ locale: context.locale, value: input.name.trim() }],
    active: input.active,
  });

  if (!created.ok) {
    return {
      ok: false,
      offerings: [],
      message: created.error,
      correlationId: created.correlationId,
    };
  }

  const attached = await gateway.attachOfferingToVariant({
    offeringId: created.data.offering.offeringId,
    variantId: input.variantId,
  });

  if (!attached.ok) {
    return {
      ok: false,
      offerings: [created.data.offering],
      offering: created.data.offering,
      message: attached.error,
      correlationId: attached.correlationId,
    };
  }

  const refreshed = await gateway.listOfferingsByVariant(input.variantId);

  return {
    ok: refreshed.ok,
    offerings: refreshed.ok ? refreshed.data : [created.data.offering],
    offering: created.data.offering,
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
