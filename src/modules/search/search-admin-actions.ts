"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import { mutateSearch } from "./search-admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseJsonObject(raw: string | undefined, label: string): Record<string, unknown> {
  if (!raw) {
    throw new Error(`${label} requerido.`);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} debe ser un objeto JSON.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} no es JSON valido: ${error.message}`);
    }
    throw error;
  }
}

function parseJsonObjectArray(raw: string | undefined, label: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(raw ?? "[]") as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} debe ser un array JSON.`);
  }

  const invalidIndex = parsed.findIndex((entry) => !isRecord(entry));
  if (invalidIndex >= 0) {
    throw new Error(`${label}[${invalidIndex}] debe ser un objeto JSON.`);
  }

  return parsed as Array<Record<string, unknown>>;
}

function normalizeSynonyms(raw: string | undefined) {
  const synonyms = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(synonyms));
}

function buildGuidedTwowaySynonymControl(displayName: string | undefined, synonymsText: string | undefined) {
  if (!displayName) {
    throw new Error("Display name requerido.");
  }

  const rawCount = (synonymsText ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).length;
  const synonyms = normalizeSynonyms(synonymsText);

  if (synonyms.length < 2) {
    throw new Error("Synonyms debe tener minimo 2 terminos.");
  }
  if (rawCount !== synonyms.length) {
    throw new Error("Synonyms no permite duplicados.");
  }

  return {
    displayName,
    solutionTypes: ["SOLUTION_TYPE_SEARCH"],
    rule: {
      condition: {},
      twowaySynonymsAction: { synonyms },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateControlPayload(control: Record<string, unknown>) {
  const legacyKeys = ["useCase", "conditions", "synonymsAction"].filter((key) => key in control);
  if (legacyKeys.length) {
    throw new Error(`Payload legacy no soportado para Vertex controls: elimina ${legacyKeys.join(", ")}.`);
  }

  if (!isRecord(control.rule)) {
    throw new Error("control.rule es requerido.");
  }
  if (!isRecord(control.rule.condition)) {
    throw new Error("control.rule.condition debe ser un objeto.");
  }
  if ("queryTerms" in control.rule.condition && isRecord(control.rule.twowaySynonymsAction)) {
    throw new Error("No envies rule.condition.queryTerms para twowaySynonymsAction; usa condition: {}.");
  }

  const twoway = control.rule.twowaySynonymsAction;
  if (isRecord(twoway) && Array.isArray(twoway.synonyms)) {
    const synonyms = twoway.synonyms
      .map((entry) => typeof entry === "string" ? entry.trim() : "")
      .filter(Boolean);
    if (synonyms.length < 2) {
      throw new Error("control.rule.twowaySynonymsAction.synonyms requiere minimo 2 terminos.");
    }
    if (new Set(synonyms).size !== synonyms.length) {
      throw new Error("control.rule.twowaySynonymsAction.synonyms no permite duplicados.");
    }
  }
}

function scopedPath(path: string, organizationId: string, shopId: string, locale: string, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({ organizationId, shopId, locale });
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return `${path}?${params.toString()}`;
}

function httpUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function gcsNdjsonUri(value: string | undefined) {
  return Boolean(value?.startsWith("gs://") && value.endsWith(".ndjson"));
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function productsFromForm(formData: FormData) {
  const file = formData.get("productsFile");
  if (typeof File !== "undefined" && file instanceof File && file.size > 0) {
    return parseJsonObjectArray(await file.text(), "productsFile");
  }

  return parseJsonObjectArray(asString(formData.get("productsJson")), "products");
}

async function indexSourcePayload(formData: FormData, context: Awaited<ReturnType<typeof getAdminContext>>) {
  const sourceMode = asString(formData.get("sourceMode")) ?? "inline";
  if (sourceMode !== "catalogSource") {
    return { products: await productsFromForm(formData) };
  }

  return {
    catalogSource: {
      organizationId: context.organizationId,
      shopId: context.shopId,
      locale: context.locale,
      publicBaseUrl: asString(formData.get("publicBaseUrl")) ?? undefined,
      pageSize: positiveInteger(asString(formData.get("pageSize")), 100),
      maxProducts: positiveInteger(asString(formData.get("maxProducts")), 1000),
      includeInactive: formData.get("includeInactive") === "true",
      pricing: {
        currency: asString(formData.get("currency")) ?? context.currency,
        country: asString(formData.get("country")) ?? context.country,
        tradePolicy: asString(formData.get("tradePolicy")) ?? "default",
        channel: asString(formData.get("channel")) ?? context.channel,
        customerGroup: asString(formData.get("customerGroup")),
        priceTableId: asString(formData.get("priceTableId")),
      },
      inventory: {
        warehouseId: asString(formData.get("warehouseId")) ?? "warehouse-default",
      },
    },
  };
}

function routingSeoPayload(formData: FormData, context: Awaited<ReturnType<typeof getAdminContext>>) {
  const publicBaseUrl = asString(formData.get("publicBaseUrl"));
  const includeAliases = formData.get("includeAliases") === "true";

  if (includeAliases && !httpUrl(publicBaseUrl)) {
    throw new Error("publicBaseUrl debe ser una URL http(s) para includeAliases.");
  }

  return includeAliases && publicBaseUrl
    ? {
        routingSeo: {
          organizationId: context.organizationId,
          shopId: context.shopId,
          locale: context.locale,
          publicBaseUrl,
          includeAliases: true,
        },
      }
    : {};
}

function summarizeRecord(record: Record<string, unknown>): string {
  const preferred = [
    "provider",
    "acceptedProductCount",
    "importedProductCount",
    "importedVariantCount",
    "productCount",
    "variantCount",
    "lineCount",
    "status",
    "jobId",
    "operationName",
    "reconciliationMode",
    "fileName",
    "contentType",
  ];
  const parts = preferred
    .filter((key) => typeof record[key] !== "undefined" && record[key] !== null)
    .map((key) => `${key}: ${String(record[key])}`);

  const result = isRecord(record.result) ? summarizeRecord(record.result) : "";
  return [parts.join(" / "), result].filter(Boolean).join(" / ");
}

function mutationMessage(result: Awaited<ReturnType<typeof mutateSearch>>, success: string) {
  if (result.ok) {
    const summary = summarizeRecord(result.data);
    return summary ? `${success} ${summary}` : success;
  }

  return result.status === 403 ? "Falta permiso search.admin.write." : result.error;
}

function finish(tab: "lab" | "controls" | "index" | "feed", message?: string): never {
  revalidatePath("/admin/catalogo/search");
  const params = new URLSearchParams({ tab });
  if (message) {
    params.set("searchMessage", message);
  }
  redirect(`/admin/catalogo/search?${params.toString()}`);
}

export async function createSearchControlAction(formData: FormData) {
  const context = await getAdminContext();
  const controlId = asString(formData.get("controlId"));
  const servingConfigId = asString(formData.get("servingConfigId"));
  const shouldAssociate = formData.get("associateAfterCreate") === "true";
  let control: Record<string, unknown>;

  try {
    if (!controlId) {
      throw new Error("Control ID requerido.");
    }

    const mode = asString(formData.get("controlMode")) ?? "guided";
    control = mode === "advanced"
      ? (() => {
          const parsed = parseJsonObject(asString(formData.get("controlJson")), "payload control");
          return isRecord(parsed.control) ? parsed.control : parsed;
        })()
      : buildGuidedTwowaySynonymControl(
          asString(formData.get("displayName")),
          asString(formData.get("synonyms")),
        );

    validateControlPayload(control);
  } catch (error) {
    finish("controls", error instanceof Error ? error.message : "No se pudo crear el control.");
  }

  const createPath = scopedPath(
    "/admin/search/controls",
    context.organizationId,
    context.shopId,
    context.locale,
    { controlId },
  );
  const createResult = await mutateSearch(context, createPath, "POST", { control });
  if (!createResult.ok) {
    finish("controls", mutationMessage(createResult, "Control creado."));
  }

  if (!shouldAssociate) {
    finish("controls", "Control creado.");
  }

  if (!servingConfigId) {
    finish("controls", "Control creado. Falta serving config para asociar.");
  }

  const associatePath = scopedPath(
    `/admin/search/serving-configs/${encodeURIComponent(servingConfigId)}/controls`,
    context.organizationId,
    context.shopId,
    context.locale,
  );
  const associateResult = await mutateSearch(context, associatePath, "POST", { controlId });
  finish("controls", mutationMessage(associateResult, "Control creado y asociado."));
}

export async function updateSearchControlAction(formData: FormData) {
  const context = await getAdminContext();
  const controlId = asString(formData.get("controlId"));
  const updateMask = asString(formData.get("updateMask"));
  let message = "Control actualizado.";

  try {
    if (!controlId) {
      throw new Error("Control ID requerido.");
    }
    const parsed = parseJsonObject(asString(formData.get("controlJson")), "payload control");
    const control = isRecord(parsed.control) ? parsed.control : parsed;
    validateControlPayload(control);
    const path = scopedPath(
      `/admin/search/controls/${encodeURIComponent(controlId)}`,
      context.organizationId,
      context.shopId,
      context.locale,
    );
    const result = await mutateSearch(context, path, "PATCH", { control, updateMask });
    message = mutationMessage(result, "Control actualizado.");
  } catch (error) {
    message = error instanceof Error ? error.message : "No se pudo actualizar el control.";
  }

  finish("controls", message);
}

export async function deleteSearchControlAction(formData: FormData) {
  const context = await getAdminContext();
  const controlId = asString(formData.get("controlId"));

  if (!controlId) {
    finish("controls", "Control ID requerido.");
  }

  const path = scopedPath(
    `/admin/search/controls/${encodeURIComponent(controlId)}`,
    context.organizationId,
    context.shopId,
    context.locale,
  );
  const result = await mutateSearch(context, path, "DELETE");
  finish("controls", mutationMessage(result, "Control eliminado."));
}

export async function associateSearchControlAction(formData: FormData) {
  const context = await getAdminContext();
  const controlId = asString(formData.get("controlId"));
  const servingConfigId = asString(formData.get("servingConfigId"));

  if (!controlId || !servingConfigId) {
    finish("controls", "Falta controlId o servingConfigId.");
  }

  const path = scopedPath(
    `/admin/search/serving-configs/${encodeURIComponent(servingConfigId)}/controls`,
    context.organizationId,
    context.shopId,
    context.locale,
  );
  const result = await mutateSearch(context, path, "POST", { controlId });
  finish("controls", mutationMessage(result, "Control asociado."));
}

export async function removeSearchControlAssociationAction(formData: FormData) {
  const context = await getAdminContext();
  const controlId = asString(formData.get("controlId"));
  const servingConfigId = asString(formData.get("servingConfigId"));

  if (!controlId || !servingConfigId) {
    finish("controls", "Falta controlId o servingConfigId.");
  }

  const path = scopedPath(
    `/admin/search/serving-configs/${encodeURIComponent(servingConfigId)}/controls/${encodeURIComponent(controlId)}`,
    context.organizationId,
    context.shopId,
    context.locale,
  );
  const result = await mutateSearch(context, path, "DELETE");
  finish("controls", mutationMessage(result, "Control desasociado."));
}

export async function previewSearchIndexAction(formData: FormData) {
  const context = await getAdminContext();
  let message = "Preview index ejecutado.";

  try {
    const body = parseJsonObject(asString(formData.get("indexJson")), "payload index");
    const path = scopedPath("/admin/search/index/preview", context.organizationId, context.shopId, context.locale);
    const result = await mutateSearch(context, path, "POST", body);
    message = mutationMessage(result, "Preview index ejecutado.");
  } catch (error) {
    message = error instanceof Error ? error.message : "No se pudo ejecutar preview index.";
  }

  finish("index", message);
}

export async function createSearchImportJobAction(formData: FormData) {
  const context = await getAdminContext();
  let message = "Import job creado.";

  try {
    const body = parseJsonObject(asString(formData.get("indexJson")), "payload index");
    const path = scopedPath("/admin/search/index/import-jobs", context.organizationId, context.shopId, context.locale);
    const result = await mutateSearch(context, path, "POST", body);
    message = mutationMessage(result, "Import job creado.");
  } catch (error) {
    message = error instanceof Error ? error.message : "No se pudo crear import job.";
  }

  finish("index", message);
}

export async function generateSearchNdjsonAction(formData: FormData) {
  const context = await getAdminContext();
  let message = "NDJSON generado.";

  try {
    const fileName = asString(formData.get("fileName"));

    if (!fileName) {
      throw new Error("fileName requerido.");
    }

    const body = {
      fileName,
      ...routingSeoPayload(formData, context),
      ...(await indexSourcePayload(formData, context)),
    };
    const path = scopedPath("/admin/search/index/ndjson", context.organizationId, context.shopId, context.locale);
    const result = await mutateSearch(context, path, "POST", body);
    message = mutationMessage(result, "NDJSON generado.");
  } catch (error) {
    message = error instanceof Error ? error.message : "No se pudo generar NDJSON.";
  }

  finish("feed", message);
}

export async function createSearchGcsImportJobAction(formData: FormData) {
  const context = await getAdminContext();
  let message = "Import GCS creado.";

  try {
    const gcsUri = asString(formData.get("gcsUri"));
    const reconciliationMode = asString(formData.get("reconciliationMode")) === "FULL" ? "FULL" : "INCREMENTAL";
    const validateOnly = formData.get("validateOnly") === "true";
    const fullConfirmed = formData.get("fullConfirmed") === "true";

    if (!gcsNdjsonUri(gcsUri)) {
      throw new Error("gcsUri debe tener formato gs://bucket/path/search-products.ndjson.");
    }
    if (!validateOnly && reconciliationMode === "FULL" && !fullConfirmed) {
      throw new Error("Confirma FULL antes de ejecutar import real.");
    }

    const body = {
      gcsUri,
      reconciliationMode,
      validateOnly,
      ...routingSeoPayload(formData, context),
      ...(await indexSourcePayload(formData, context)),
    };
    const path = scopedPath("/admin/search/index/gcs-import-jobs", context.organizationId, context.shopId, context.locale);
    const result = await mutateSearch(context, path, "POST", body);
    message = mutationMessage(result, validateOnly ? "Validacion GCS ejecutada." : "Import GCS creado.");
  } catch (error) {
    message = error instanceof Error ? error.message : "No se pudo crear import GCS.";
  }

  finish("feed", message);
}

export async function deleteSearchNdjsonAction(formData: FormData) {
  const context = await getAdminContext();
  const gcsUri = asString(formData.get("gcsUri"));

  if (!gcsNdjsonUri(gcsUri)) {
    finish("feed", "gcsUri debe tener formato gs://bucket/path/search-products.ndjson.");
  }

  const path = scopedPath("/admin/search/index/ndjson", context.organizationId, context.shopId, context.locale);
  const result = await mutateSearch(context, path, "DELETE", { gcsUri });
  finish("feed", mutationMessage(result, "Artefacto NDJSON eliminado."));
}
