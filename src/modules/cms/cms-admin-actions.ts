"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addMediaCollectionItems, createMediaCollection, listMediaCollections } from "../catalogo/media-admin";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  activateCmsVisualModuleDefinition,
  archiveCmsVisualModuleDefinition,
  blocksFromJson,
  changeCmsPublishedPath,
  cmsTypographyTokenFromFamily,
  createCmsPage,
  createCmsVisualModuleDefinition,
  createCmsVisualModuleDefinitionDraftRevision,
  createCmsTemplate,
  normalizeCmsVisualModuleProps,
  normalizeCmsVisualModuleV2Props,
  patchCmsGlobalSettings,
  patchCmsPageSettings,
  patchCmsTemplate,
  publishCmsPage,
  unpublishCmsPage,
  updateCmsDraft,
  updateCmsVisualModuleDefinitionDraft,
  type CmsArea,
  type CmsBlock,
  type CmsContainerMode,
  type CmsDesignTokens,
  type CmsLayout,
  type CmsRegionCode,
  type CmsPageType,
  type CmsTemplateStatus,
  type CmsVisualNode,
} from "./cms-admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const cmsSettingsPath = "/admin/cms/ajustes-basicos";
const cmsBuilderPath = "/admin/cms/builder";
const cmsBuilderMediaCollectionTitle = "CMS Builder Assets";
const editableRegions: CmsRegionCode[] = ["header", "main", "footer"];

export type CmsBuilderMediaUploadReport = {
  ok: boolean;
  assetKey?: string;
  collectionId?: string;
  mediaAssetId?: string;
  message: string;
  previewUrl?: string;
};

function parseJsonRecord<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function finishCmsSettings(message: string, keep?: Record<string, string | undefined>): never {
  revalidatePath(cmsSettingsPath);
  const params = new URLSearchParams({ cmsSettingsMessage: message });
  for (const [key, value] of Object.entries(keep ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  redirect(`${cmsSettingsPath}?${params.toString()}`);
}

function finishCmsBuilder(
  message: string,
  keep?: Record<string, string | undefined>,
  severity: "success" | "error" = "success",
): never {
  revalidatePath(cmsBuilderPath);
  revalidatePath("/admin/cms");
  const params = new URLSearchParams({ cmsBuilderMessage: message, cmsBuilderMessageSeverity: severity });
  for (const [key, value] of Object.entries(keep ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  redirect(`${cmsBuilderPath}?${params.toString()}`);
}

function normalizedCssValue(value: FormDataEntryValue | null, fallback: string) {
  return asString(value) ?? fallback;
}

function colorFromForm(formData: FormData, key: string, fallback: string) {
  return asString(formData.get(`${key}Text`)) ?? asString(formData.get(key)) ?? fallback;
}

function nextTypography(formData: FormData, current: CmsDesignTokens["typography"]) {
  const body = asString(formData.get("typographyBody"));
  const heading = asString(formData.get("typographyHeading"));
  const mono = asString(formData.get("typographyMono"));

  return {
    ...current,
    ...(body ? { body: cmsTypographyTokenFromFamily("body", body) } : {}),
    ...(heading ? { heading: cmsTypographyTokenFromFamily("heading", heading) } : {}),
    ...(mono ? { mono: cmsTypographyTokenFromFamily("mono", mono) } : {}),
  };
}

function nextSpacing(formData: FormData, current: Record<string, string>) {
  return {
    ...current,
    xs: normalizedCssValue(formData.get("spacingXs"), current.xs ?? "4px"),
    sm: normalizedCssValue(formData.get("spacingSm"), current.sm ?? "8px"),
    md: normalizedCssValue(formData.get("spacingMd"), current.md ?? "16px"),
    lg: normalizedCssValue(formData.get("spacingLg"), current.lg ?? "24px"),
    xl: normalizedCssValue(formData.get("spacingXl"), current.xl ?? "32px"),
  };
}

function nextTokens(formData: FormData): CmsDesignTokens {
  const current = parseJsonRecord<CmsDesignTokens>(formData.get("tokensJson"), {
    colors: {},
    typography: {
      body: cmsTypographyTokenFromFamily("body", "Inter"),
      heading: cmsTypographyTokenFromFamily("heading", "Inter"),
      mono: cmsTypographyTokenFromFamily("mono", "Roboto Mono"),
    },
    maxWidth: "1280px",
    spacing: {},
    breakpoints: { mobile: "0px", tablet: "768px", desktop: "1024px" },
    defaultColumnGap: "24px",
    defaultModuleGap: "24px",
  });

  return {
    ...current,
    colors: {
      ...current.colors,
      primary: colorFromForm(formData, "colorPrimary", current.colors.primary ?? "#25b9d7"),
      background: colorFromForm(formData, "colorBackground", current.colors.background ?? "#ffffff"),
      text: colorFromForm(formData, "colorText", current.colors.text ?? "#1f2937"),
      surface: colorFromForm(formData, "colorSurface", current.colors.surface ?? "#f8fafc"),
    },
    typography: nextTypography(formData, current.typography),
    maxWidth: normalizedCssValue(formData.get("maxWidth"), current.maxWidth),
    spacing: nextSpacing(formData, current.spacing),
    breakpoints: {
      mobile: normalizedCssValue(formData.get("breakpointMobile"), current.breakpoints.mobile),
      tablet: normalizedCssValue(formData.get("breakpointTablet"), current.breakpoints.tablet),
      desktop: normalizedCssValue(formData.get("breakpointDesktop"), current.breakpoints.desktop),
    },
    defaultColumnGap: normalizedCssValue(formData.get("defaultColumnGap"), current.defaultColumnGap),
    defaultModuleGap: normalizedCssValue(formData.get("defaultModuleGap"), current.defaultModuleGap),
  };
}

function normalizeColumns(value: string[] | undefined) {
  const columns = (value ?? ["100%"])
    .map((column) => column.trim())
    .filter(Boolean)
    .slice(0, 3);

  return columns.length ? columns : ["100%"];
}

function percentageFromWidth(width: string) {
  const parsed = Number(width.replace("%", "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function defaultArea(region: CmsRegionCode, maxWidth: string): CmsArea {
  const columns = ["100%"];
  return {
    areaId: `${region}-default`,
    name: region === "main" ? "Contenido global" : `${region[0].toUpperCase()}${region.slice(1)} global`,
    containerMode: "container",
    maxWidth,
    columns,
    columnSlots: [{ columnIndex: 1, width: "100%", percentage: 100 }],
    columnGap: "24px",
    rowGap: "24px",
    spacing: {},
    visibility: { mobile: true, tablet: true, desktop: true },
  };
}

function normalizeArea(area: CmsArea, region: CmsRegionCode, maxWidth: string, index: number): CmsArea {
  const columns = normalizeColumns(area.columns);
  const containerMode: CmsContainerMode = area.containerMode === "full-width" ? "full-width" : "container";

  return {
    ...area,
    areaId: area.areaId || `${region}-area-${index + 1}`,
    name: area.name || `${region} area ${index + 1}`,
    containerMode,
    maxWidth: containerMode === "container" ? area.maxWidth ?? maxWidth : null,
    columns,
    columnSlots: columns.map((width, columnIndex) => ({
      columnIndex: columnIndex + 1,
      width,
      percentage: percentageFromWidth(width),
    })),
    columnGap: area.columnGap ?? "24px",
    rowGap: area.rowGap ?? "24px",
    spacing: area.spacing ?? {},
    visibility: {
      mobile: area.visibility?.mobile !== false,
      tablet: area.visibility?.tablet !== false,
      desktop: area.visibility?.desktop !== false,
    },
  };
}

function nextLayout(formData: FormData, maxWidth: string): CmsLayout {
  const current = parseJsonRecord<CmsLayout>(formData.get("layoutJson"), { regions: {} });
  const regions: CmsLayout["regions"] = {};

  for (const region of editableRegions) {
    const currentRegion = current.regions[region];
    const areas = currentRegion?.areas?.length ? currentRegion.areas : [defaultArea(region, maxWidth)];
    regions[region] = {
      ...currentRegion,
      source: "global",
      areas: areas.map((area, index) => normalizeArea(area, region, maxWidth, index)),
    };
  }

  return { regions };
}

function cmsSettingsMutationMessage(
  result: { ok: true } | { ok: false; status?: number; error: string },
) {
  if (result.ok) {
    return "Ajustes globales CMS guardados.";
  }
  return result.status === 403 ? "Falta permiso cms.settings.write." : result.error;
}

function asPageType(value: FormDataEntryValue | null): CmsPageType {
  const text = asString(value);
  if (text === "CONTENT" || text === "HOME") {
    return text;
  }
  return "LANDING";
}

function asTemplateStatus(value: FormDataEntryValue | null): CmsTemplateStatus {
  const text = asString(value);
  if (text === "ACTIVE" || text === "ARCHIVED") {
    return text;
  }
  return "DRAFT";
}

function asBoolean(value: FormDataEntryValue | null, fallback = true) {
  const text = asString(value);
  if (text === "false") return false;
  if (text === "true") return true;
  return fallback;
}

function uploadedBuilderFile(formData: FormData) {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

function cmsBuilderMediaPreviewUrl(mediaAssetId: string) {
  return `/api/admin/media-assets/${encodeURIComponent(mediaAssetId)}/content?variant=large_default`;
}

async function cmsBuilderMediaCollectionId(context: Awaited<ReturnType<typeof getAdminContext>>) {
  const collections = await listMediaCollections(context, {
    limit: 20,
    q: cmsBuilderMediaCollectionTitle,
    status: "all",
  });
  return collections.items.find((collection) => collection.title === cmsBuilderMediaCollectionTitle)?.mediaCollectionId;
}

export async function uploadCmsBuilderMediaAction(formData: FormData): Promise<CmsBuilderMediaUploadReport> {
  const context = await getAdminContext();
  if (!context.organizationId || !context.shopId) {
    return { ok: false, message: "Falta contexto Admin canonico para subir Media." };
  }

  const file = uploadedBuilderFile(formData);
  if (!file) {
    return { ok: false, message: "Selecciona un archivo valido." };
  }

  const assetKey = asString(formData.get("assetKey")) ?? `cms-bg-${crypto.randomUUID()}`;
  const alt = asString(formData.get("alt"));
  const assetTitle = asString(formData.get("assetTitle")) ?? assetKey;
  const existingCollectionId = asString(formData.get("mediaCollectionId")) ?? await cmsBuilderMediaCollectionId(context);
  const result = existingCollectionId
    ? await addMediaCollectionItems(context, {
        mediaCollectionId: existingCollectionId,
        files: [file],
        defaultLocale: context.locale,
        alt,
        assetTitle,
      })
    : await createMediaCollection(context, {
        title: cmsBuilderMediaCollectionTitle,
        files: [file],
        defaultLocale: context.locale,
        alt,
        assetTitle,
      });

  if (!result.ok || !result.data) {
    return { ok: false, assetKey, message: result.ok ? "Media no devolvio coleccion." : result.error };
  }

  const uploadedAsset = result.data.items.at(-1);
  const mediaAssetId = uploadedAsset?.mediaAssetId ?? result.data.mediaAssetIds.at(-1);
  if (!mediaAssetId) {
    return { ok: false, assetKey, collectionId: result.data.mediaCollectionId, message: "Media guardo la coleccion, pero no devolvio mediaAssetId." };
  }

  return {
    ok: true,
    assetKey,
    collectionId: result.data.mediaCollectionId,
    mediaAssetId,
    message: "Asset CMS subido.",
    previewUrl: cmsBuilderMediaPreviewUrl(mediaAssetId),
  };
}

function cmsTemplateMutationMessage(
  result: { ok: true } | { ok: false; status?: number; error: string },
  success: string,
) {
  if (result.ok) {
    return success;
  }
  return result.status === 403 ? "Falta permiso cms.settings.write." : result.error;
}

function templateKeep(formData: FormData, templateId?: string) {
  return {
    tab: "templates",
    locale: asString(formData.get("locale")),
    pageType: asString(formData.get("pageTypeFilter")) ?? asString(formData.get("pageType")),
    status: asString(formData.get("statusFilter")),
    templateId: templateId ?? asString(formData.get("templateId")),
  };
}

function templateTypographyOverrides(formData: FormData) {
  const body = asString(formData.get("templateTypographyBody"));
  const heading = asString(formData.get("templateTypographyHeading"));
  const mono = asString(formData.get("templateTypographyMono"));
  const typography: CmsDesignTokens["typography"] = {};

  if (body) typography.body = cmsTypographyTokenFromFamily("body", body);
  if (heading) typography.heading = cmsTypographyTokenFromFamily("heading", heading);
  if (mono) typography.mono = cmsTypographyTokenFromFamily("mono", mono);

  return typography;
}

function templateOverrides(formData: FormData) {
  const maxWidth = asString(formData.get("templateMaxWidth"));
  const layout = nextLayout(formData, maxWidth ?? "1280px");
  const typography = templateTypographyOverrides(formData);
  const overrides: Record<string, unknown> = { layout };

  if (maxWidth) {
    overrides.maxWidth = maxWidth;
  }
  if (Object.keys(typography).length) {
    overrides.tokens = { typography };
  }

  return overrides;
}

function pageSettingsKeep(formData: FormData) {
  return {
    mode: "editor",
    pageId: asString(formData.get("pageId")),
    tab: "settings",
    locale: asString(formData.get("locale")),
  };
}

function pageOverrides(formData: FormData) {
  const mode = asString(formData.get("settingsMode")) ?? "inherit";
  if (mode !== "custom") {
    return {};
  }

  const maxWidth = asString(formData.get("pageMaxWidth"));
  const layout = nextLayout(formData, maxWidth ?? "1280px");
  const overrides: Record<string, unknown> = { layout };

  if (maxWidth) {
    overrides.maxWidth = maxWidth;
  }

  return overrides;
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

function visualModuleMutationMessage(
  result: { ok: true } | { ok: false; status?: number; error: string },
  success: string,
) {
  return mutationMessage(result, success, "cms.pages.write");
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function visualContentTextForSave(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function visualContentValuesForSave(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" ? visualContentTextForSave(value) : value,
    ]),
  );
}

function replaceVisualModuleBlockWithCmsReference(blocks: CmsBlock[], blockId: string, definitionId: string) {
  return blocks.map((block) => {
    if (block.blockId !== blockId || block.type !== "visual.module") return block;
    return {
      ...block,
      props: {
        definitionId,
        contentValues: visualContentValuesForSave(recordValue(block.props.contentValues)),
      },
    };
  });
}

function publishedVisualModuleDefinitionId(formData: FormData, blockId: string) {
  const block = parseBlocksOrFinish(formData).find((item) => item.blockId === blockId && item.type === "visual.module");
  if (!block) return undefined;
  const definitionId = typeof block.props.definitionId === "string" && block.props.definitionId.trim()
    ? block.props.definitionId.trim()
    : undefined;
  return definitionId && (block.props.visualDefinitionReference === true || !block.props.tree) ? definitionId : undefined;
}

async function attachPublishedVisualModuleToDraft(
  formData: FormData,
  blockId: string,
  definitionId: string,
  context: Awaited<ReturnType<typeof getAdminContext>>,
) {
  const pageId = asString(formData.get("pageId"));
  const locale = asString(formData.get("locale")) ?? context.locale;
  if (!pageId) {
    return null;
  }

  const blocks = parseBlocksOrFinish(formData);
  const payload = pagePayload(formData, replaceVisualModuleBlockWithCmsReference(blocks, blockId, definitionId));
  if (!payload.title || !payload.path || !payload.seo.title) {
    return { ok: false as const, error: "Modulo publicado, pero faltan datos de pagina para enlazarlo al draft." };
  }
  return updateCmsDraft(context, pageId, payload, locale);
}

function keepEditor(formData: FormData, pageId?: string) {
  return {
    mode: "editor",
    pageId: pageId ?? asString(formData.get("pageId")),
    tab: asString(formData.get("tab")) ?? "blocks",
    locale: asString(formData.get("locale")),
  };
}

function keepBuilder(formData: FormData, pageId?: string) {
  return {
    pageId: pageId ?? asString(formData.get("pageId")),
    locale: asString(formData.get("locale")),
  };
}

function finishCmsVisualModuleDefinition(
  formData: FormData,
  message: string,
  severity: "success" | "error" = "success",
): never {
  if (asString(formData.get("visualDefinitionReturn")) === "editor") {
    finish(message, keepEditor(formData));
  }
  finishCmsBuilder(message, keepBuilder(formData), severity);
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

function parseBuilderBlocksOrFinish(formData: FormData) {
  try {
    const blocks = blocksFromJson(asString(formData.get("blocksJson")) ?? "[]");
    const visualError = visualModuleSaveError(blocks);
    if (visualError) {
      finishCmsBuilder(visualError, keepBuilder(formData));
    }
    return blocks;
  } catch (error) {
    finishCmsBuilder(error instanceof Error ? error.message : "Bloques invalidos.", keepBuilder(formData));
  }
}

function parseVisualModuleJsonOrFinish(formData: FormData) {
  const rawIntent = asString(formData.get("visualDefinitionIntent")) ?? "create";
  const visualBlockId = rawIntent.startsWith("publish:") ? rawIntent.slice("publish:".length) : asString(formData.get("visualBlockId"));
  const rawModule = asString(formData.get("visualModuleJson"))
    ?? (visualBlockId ? asString(formData.get(`visualModuleJson-${visualBlockId}`)) : undefined);
  if (!rawModule) {
    finishCmsVisualModuleDefinition(formData, "Selecciona un modulo visual antes de guardarlo en CMS.", "error");
  }

  try {
    return normalizeCmsVisualModuleV2Props(JSON.parse(rawModule));
  } catch (error) {
    finishCmsVisualModuleDefinition(formData, error instanceof Error ? error.message : "Modulo visual invalido.", "error");
  }
}

function visualNodeIds(node: CmsVisualNode): string[] {
  return [node.nodeId, ...(node.children ?? []).flatMap(visualNodeIds)];
}

function visualModuleSaveError(blocks: CmsBlock[]) {
  for (const block of blocks) {
    if (block.type !== "visual.module") continue;
    const moduleProps = normalizeCmsVisualModuleProps(block.props);
    const ids = visualNodeIds(moduleProps.tree);
    const duplicateId = ids.find((nodeId, index) => ids.indexOf(nodeId) !== index);
    if (!moduleProps.tree.nodeId) {
      return `Modulo visual ${block.blockId} no tiene root nodeId.`;
    }
    if (duplicateId) {
      return `Modulo visual ${block.blockId} repite nodeId ${duplicateId}.`;
    }
  }
  return null;
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

export async function saveCmsBuilderDraftAction(formData: FormData) {
  const context = await getAdminContext();
  const pageId = asString(formData.get("pageId"));
  const locale = asString(formData.get("locale")) ?? context.locale;
  const blocks = parseBuilderBlocksOrFinish(formData);
  const payload = pagePayload(formData, blocks);

  if (!pageId) {
    finishCmsBuilder("Selecciona una pagina antes de guardar.", { locale });
  }
  if (!payload.title || !payload.path || !payload.seo.title) {
    finishCmsBuilder("Faltan titulo, path o SEO title para guardar el draft.", keepBuilder(formData, pageId));
  }

  const result = await updateCmsDraft(context, pageId, payload, locale);
  finishCmsBuilder(
    mutationMessage(result, "Draft CMS guardado desde Builder.", "cms.pages.write"),
    keepBuilder(formData, pageId),
    result.ok ? "success" : "error",
  );
}

export async function saveCmsVisualModuleDefinitionAction(formData: FormData) {
  const context = await getAdminContext();
  const rawIntent = asString(formData.get("visualDefinitionIntent")) ?? "create";
  const visualBlockId = rawIntent.startsWith("publish:")
    ? rawIntent.slice("publish:".length)
    : asString(formData.get("visualBlockId"));
  const publishedBlockId = rawIntent.startsWith("publish:") || rawIntent === "publish" ? visualBlockId : undefined;
  const intent = rawIntent.startsWith("publish:") ? "publish" : rawIntent;
  const definitionId = asString(formData.get("visualDefinitionId"));
  const name = asString(formData.get("visualDefinitionName"))
    ?? (publishedBlockId ? asString(formData.get(`visualDefinitionName-${publishedBlockId}`)) : undefined);

  if ((intent === "publish" || intent === "create") && visualBlockId) {
    const existingDefinitionId = publishedVisualModuleDefinitionId(formData, visualBlockId);
    if (existingDefinitionId) {
      finishCmsVisualModuleDefinition(
        formData,
        `Modulo visual ya publicado en CMS (${existingDefinitionId}).`,
        "success",
      );
    }
  }

  if (intent === "activate") {
    if (!definitionId) {
      finishCmsVisualModuleDefinition(formData, "Selecciona una definicion CMS para activar.", "error");
    }
    const result = await activateCmsVisualModuleDefinition(context, definitionId);
    finishCmsVisualModuleDefinition(
      formData,
      visualModuleMutationMessage(result, "Definicion visual activada."),
      result.ok ? "success" : "error",
    );
  }

  if (intent === "archive") {
    if (!definitionId) {
      finishCmsVisualModuleDefinition(formData, "Selecciona una definicion CMS para archivar.", "error");
    }
    const result = await archiveCmsVisualModuleDefinition(context, definitionId);
    finishCmsVisualModuleDefinition(
      formData,
      visualModuleMutationMessage(result, "Definicion visual archivada."),
      result.ok ? "success" : "error",
    );
  }

  if (intent === "createDraftRevision") {
    if (!definitionId) {
      finishCmsVisualModuleDefinition(formData, "Selecciona una definicion CMS activa para crear una revision.", "error");
    }
    const result = await createCmsVisualModuleDefinitionDraftRevision(context, definitionId, {});
    finishCmsVisualModuleDefinition(
      formData,
      visualModuleMutationMessage(result, "Draft de nueva revision visual creado."),
      result.ok ? "success" : "error",
    );
  }

  const visualModule = parseVisualModuleJsonOrFinish(formData);
  if (!name) {
    finishCmsVisualModuleDefinition(formData, "Indica un nombre para la definicion visual.", "error");
  }

  if (intent === "updateDraft") {
    if (!definitionId) {
      finishCmsVisualModuleDefinition(formData, "Selecciona una definicion CMS draft para actualizar.", "error");
    }
    const result = await updateCmsVisualModuleDefinitionDraft(context, definitionId, { name, module: visualModule });
    finishCmsVisualModuleDefinition(
      formData,
      visualModuleMutationMessage(result, "Draft de definicion visual actualizado."),
      result.ok ? "success" : "error",
    );
  }

  const result = await createCmsVisualModuleDefinition(context, { name, module: visualModule });
  if (!result.ok || intent !== "publish") {
    finishCmsVisualModuleDefinition(
      formData,
      visualModuleMutationMessage(result, "Definicion visual CMS creada."),
      result.ok ? "success" : "error",
    );
  }

  const activation = await activateCmsVisualModuleDefinition(context, result.data.definitionId);
  if (activation.ok && publishedBlockId) {
    const draftResult = await attachPublishedVisualModuleToDraft(
      formData,
      publishedBlockId,
      result.data.definitionId,
      context,
    );
    if (draftResult) {
      finishCmsVisualModuleDefinition(
        formData,
        visualModuleMutationMessage(
          draftResult,
          "Modulo visual publicado, agregado a Bloques guardados y enlazado al draft.",
        ),
        draftResult.ok ? "success" : "error",
      );
    }
  }
  finishCmsVisualModuleDefinition(
    formData,
    visualModuleMutationMessage(activation, "Modulo visual publicado y agregado a Bloques guardados."),
    activation.ok ? "success" : "error",
  );
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

export async function saveCmsGlobalSettingsAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const tokens = nextTokens(formData);
  const layout = nextLayout(formData, tokens.maxWidth);
  const result = await patchCmsGlobalSettings(context, { tokens, layout }, locale);

  finishCmsSettings(cmsSettingsMutationMessage(result), { locale });
}

export async function createCmsTemplateAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const name = asString(formData.get("name"));
  const pageType = asPageType(formData.get("pageType"));
  const status = asTemplateStatus(formData.get("status"));

  if (!name) {
    finishCmsSettings("Falta nombre de plantilla.", { tab: "templates", locale, drawer: "create" });
  }

  const result = await createCmsTemplate(context, {
    pageType,
    name,
    status,
    settings: {
      inheritGlobalSettings: true,
      templateId: null,
      overrides: {},
    },
  }, locale);

  finishCmsSettings(
    cmsTemplateMutationMessage(result, "Plantilla CMS creada."),
    result.ok ? templateKeep(formData, result.data.templateId) : { tab: "templates", locale, drawer: "create" },
  );
}

export async function saveCmsTemplateSettingsAction(formData: FormData) {
  const context = await getAdminContext();
  const locale = asString(formData.get("locale")) ?? context.locale;
  const templateId = asString(formData.get("templateId"));
  const name = asString(formData.get("name"));

  if (!templateId || !name) {
    finishCmsSettings("Falta templateId o nombre de plantilla.", templateKeep(formData));
  }

  const result = await patchCmsTemplate(context, templateId, {
    name,
    status: asTemplateStatus(formData.get("status")),
    settings: {
      inheritGlobalSettings: asBoolean(formData.get("inheritGlobalSettings"), true),
      templateId: null,
      overrides: templateOverrides(formData),
    },
  }, locale);

  finishCmsSettings(
    cmsTemplateMutationMessage(result, "Plantilla CMS guardada."),
    templateKeep(formData, templateId),
  );
}

export async function saveCmsPageSettingsAction(formData: FormData) {
  const context = await getAdminContext();
  const pageId = asString(formData.get("pageId"));
  const locale = asString(formData.get("locale")) ?? context.locale;

  if (!pageId) {
    finish("Falta pageId.", { locale });
  }

  const settingsMode = asString(formData.get("settingsMode")) ?? "inherit";
  const result = await patchCmsPageSettings(context, pageId, {
    inheritGlobalSettings: settingsMode !== "custom",
    templateId: asString(formData.get("templateId")) ?? null,
    overrides: pageOverrides(formData),
  }, locale);

  finish(
    result.ok ? "Configuracion de pagina CMS guardada." : result.status === 403 ? "Falta permiso cms.settings.write." : result.error,
    pageSettingsKeep(formData),
  );
}
