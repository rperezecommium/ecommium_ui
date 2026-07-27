"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../shared/config/admin-context";
import {
  blocksFromJson,
  changeCmsPublishedPath,
  cmsTypographyTokenFromFamily,
  createCmsPage,
  createCmsTemplate,
  patchCmsGlobalSettings,
  patchCmsPageSettings,
  patchCmsTemplate,
  publishCmsPage,
  unpublishCmsPage,
  updateCmsDraft,
  type CmsArea,
  type CmsBlock,
  type CmsContainerMode,
  type CmsDesignTokens,
  type CmsLayout,
  type CmsRegionCode,
  type CmsPageType,
  type CmsTemplateStatus,
} from "./cms-admin";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const cmsSettingsPath = "/admin/cms/ajustes-basicos";
const editableRegions: CmsRegionCode[] = ["header", "main", "footer"];

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
