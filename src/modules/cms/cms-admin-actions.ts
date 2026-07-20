"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  blocksFromJson,
  changeCmsPublishedPath,
  createCmsPage,
  publishCmsPage,
  unpublishCmsPage,
  updateCmsDraft,
  type CmsBlock,
  type CmsPageType,
} from "./cms-admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPageType(value: FormDataEntryValue | null): CmsPageType {
  const text = asString(value);
  if (text === "CONTENT" || text === "HOME") {
    return text;
  }
  return "LANDING";
}

function finish(message: string, keep?: Record<string, string | undefined>): never {
  revalidatePath("/admin/cms");
  const params = new URLSearchParams({ cmsMessage: message });
  for (const [key, value] of Object.entries(keep ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  redirect(`/admin/cms?${params.toString()}`);
}

function mutationMessage(
  result: { ok: true } | { ok: false; status?: number; error: string },
  success: string,
  permission: "cms.pages.write" | "cms.pages.publish",
) {
  if (result.ok) {
    return success;
  }
  return result.status === 403 ? `Falta permiso ${permission}.` : result.error;
}

function keepEditor(formData: FormData, pageId?: string) {
  return {
    mode: "editor",
    pageId: pageId ?? asString(formData.get("pageId")),
    tab: asString(formData.get("tab")) ?? "blocks",
    locale: asString(formData.get("locale")),
  };
}

function pagePayload(formData: FormData, blocks: CmsBlock[]) {
  return {
    pageType: asPageType(formData.get("pageType")),
    title: asString(formData.get("title")),
    path: asString(formData.get("path")),
    seo: {
      title: asString(formData.get("seoTitle")),
      description: asString(formData.get("seoDescription")) ?? "",
    },
    blocks,
  };
}

function parseBlocksOrFinish(formData: FormData) {
  try {
    return blocksFromJson(asString(formData.get("blocksJson")) ?? "[]");
  } catch (error) {
    finish(error instanceof Error ? error.message : "Bloques invalidos.", keepEditor(formData));
  }
}

export async function createCmsPageAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const blocks = parseBlocksOrFinish(formData);
  const payload = pagePayload(formData, blocks);

  if (!payload.title || !payload.path || !payload.seo.title) {
    finish("Faltan titulo, path o SEO title.", { drawer: "create", locale });
  }

  const result = await createCmsPage(context, payload, locale);
  finish(
    mutationMessage(result, "Pagina CMS creada.", "cms.pages.write"),
    result.ok ? keepEditor(formData, result.data.pageId) : { drawer: "create", locale },
  );
}

export async function saveCmsDraftAction(formData: FormData) {
  const context = await getAdminContext();
  const pageId = asString(formData.get("pageId"));
  const locale = asString(formData.get("locale")) ?? context.locale;
  const blocks = parseBlocksOrFinish(formData);
  const payload = pagePayload(formData, blocks);

  if (!pageId) {
    finish("Falta pageId.", { locale });
  }
  if (!payload.title || !payload.seo.title) {
    finish("Faltan titulo o SEO title.", keepEditor(formData, pageId));
  }

  const result = await updateCmsDraft(context, pageId, payload, locale);
  finish(mutationMessage(result, "Draft CMS guardado.", "cms.pages.write"), keepEditor(formData, pageId));
}

export async function publishCmsPageAction(formData: FormData) {
  const context = await getAdminContext();
  const pageId = asString(formData.get("pageId"));
  const locale = asString(formData.get("locale")) ?? context.locale;

  if (!pageId) {
    finish("Falta pageId.", { locale });
  }

  const result = await publishCmsPage(context, pageId, locale);
  finish(mutationMessage(result, "Pagina CMS publicada y ruta SEO sincronizada.", "cms.pages.publish"), keepEditor(formData, pageId));
}

export async function unpublishCmsPageAction(formData: FormData) {
  const context = await getAdminContext();
  const pageId = asString(formData.get("pageId"));
  const locale = asString(formData.get("locale")) ?? context.locale;
  const confirmed = asString(formData.get("confirmUnpublish")) === "DESPUBLICAR";

  if (!confirmed) {
    finish("Confirma escribiendo DESPUBLICAR.", keepEditor(formData, pageId));
  }
  if (!pageId) {
    finish("Falta pageId.", { locale });
  }

  const result = await unpublishCmsPage(context, pageId, locale);
  finish(mutationMessage(result, "Pagina CMS despublicada.", "cms.pages.publish"), keepEditor(formData, pageId));
}

export async function changeCmsPublishedPathAction(formData: FormData) {
  const context = await getAdminContext();
  const pageId = asString(formData.get("pageId"));
  const locale = asString(formData.get("locale")) ?? context.locale;
  const nextPath = asString(formData.get("nextPath"));

  if (!pageId || !nextPath) {
    finish("Falta pageId o nuevo path.", keepEditor(formData, pageId));
  }

  const result = await changeCmsPublishedPath(context, pageId, nextPath, locale);
  finish(mutationMessage(result, "Path publicado actualizado con redirect 301.", "cms.pages.publish"), keepEditor(formData, pageId));
}
