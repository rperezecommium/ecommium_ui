import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";
import type { AdminContext } from "../../shared/config/admin-context";
import {
  normalizeCmsBlock,
  type CmsBlock,
} from "./cms-blocks";
export {
  blocksFromJson,
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockPlacement,
  getCmsBlockPlpTarget,
  getCmsBlockPresets,
  getCmsBlockSurface,
  summarizePlpComposition,
  summarizePlacements,
  type CmsBlock,
  type CmsBlockType,
  type CmsPlacement,
  type CmsPlpListingKind,
  type CmsPlpTarget,
  type CmsSurface,
} from "./cms-blocks";

export type CmsPageStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
export type CmsPageType = "LANDING" | "CONTENT" | "HOME";
export type CmsPage = {
  pageId: string;
  organizationId: string;
  shopId: string;
  locale: string;
  pageType: CmsPageType | string;
  title: string;
  path: string;
  status: CmsPageStatus;
  routeId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CmsPageVersion = {
  versionId: string;
  pageId: string;
  version: number;
  status: "DRAFT" | "PUBLISHED";
  title: string;
  seo: {
    title: string;
    description: string;
  };
  blocks: CmsBlock[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CmsPageDetail = CmsPage & {
  latestVersion: CmsPageVersion | null;
  publishedVersion: CmsPageVersion | null;
};

export type CmsPagesList = {
  total: number;
  limit: number;
  offset: number;
  items: CmsPage[];
};

export type CmsAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: "cms.pages.read" | "cms.pages.write" | "cms.pages.publish" | "cms.settings.read";
  correlationId?: string;
};

export type CmsAdminFilters = {
  q?: string;
  status?: CmsPageStatus | "all";
  pageType?: CmsPageType | "all";
  locale?: string;
  pageId?: string;
  mode?: "list" | "editor";
  tab?: "page" | "settings" | "blocks" | "plp" | "seo" | "preview";
  drawer?: "create" | "path";
  cmsMessage?: string;
};

export type CmsAdminData = {
  pages: CmsAdminResult<CmsPagesList>;
  selectedPage: CmsAdminResult<CmsPageDetail | null>;
  pageSettings: CmsAdminResult<CmsPageSettingsResponse | null>;
  resolvedPageSettings: CmsAdminResult<CmsResolvedPageSettings | null>;
  templates: CmsAdminResult<CmsTemplateSettingsList>;
};

export type CmsSettingsState = "INITIAL" | "PERSISTED";
export type CmsRegionCode = "header" | "main" | "footer";
export type CmsContainerMode = "full-width" | "container";
export type CmsPlacementContainerMode = "inherit" | "full-width" | "container";
export type CmsAlignment = "start" | "center" | "end" | "stretch";
export type CmsLayoutSource = "global" | "template" | "page" | "module";
export type CmsResolvedSettingsLayer = "global" | "template" | "page" | "module";
export type CmsTemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type CmsFontProvider = "google";

export type CmsTypographyToken = {
  family: string;
  provider: CmsFontProvider;
  weights: number[];
};

export type CmsFontOption = CmsTypographyToken & {
  category: "sans" | "serif" | "mono" | "display" | string;
};

export type CmsFontOptionsResponse = {
  provider: CmsFontProvider;
  items: CmsFontOption[];
};

export type CmsResponsiveVisibility = {
  mobile: boolean;
  tablet: boolean;
  desktop: boolean;
};

export type CmsSpacing = {
  marginTop?: string;
  marginBottom?: string;
  paddingTop?: string;
  paddingBottom?: string;
};

export type CmsDesignTokens = {
  colors: Record<string, string>;
  typography: Record<string, CmsTypographyToken>;
  maxWidth: string;
  spacing: Record<string, string>;
  breakpoints: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
  defaultColumnGap: string;
  defaultModuleGap: string;
};

export type CmsColumnSlot = {
  columnIndex: number;
  width: string;
  percentage: number;
};

export type CmsModuleSlot = CmsColumnSlot & {
  region: CmsRegionCode;
  areaId: string;
};

export type CmsArea = {
  areaId: string;
  name: string | null;
  containerMode: CmsContainerMode;
  maxWidth: string | null;
  columns: string[];
  columnSlots: CmsColumnSlot[];
  columnGap: string | null;
  rowGap: string | null;
  spacing: CmsSpacing;
  visibility: CmsResponsiveVisibility;
};

export type CmsRegionLayout = {
  source?: CmsLayoutSource;
  areas: CmsArea[];
};

export type CmsLayout = {
  regions: Partial<Record<CmsRegionCode, CmsRegionLayout>>;
};

export type CmsModulePlacement = {
  region: CmsRegionCode;
  areaId: string;
  columnIndex: number;
  order: number;
  width?: string | null;
  align: CmsAlignment;
  spacing: CmsSpacing;
  visibility: CmsResponsiveVisibility;
  containerMode: CmsPlacementContainerMode;
};

export type CmsGlobalSettings = {
  organizationId: string;
  shopId: string;
  locale: string;
  tokens: CmsDesignTokens;
  layout: CmsLayout;
};

export type CmsGlobalSettingsResponse = {
  configurationState: CmsSettingsState;
  settings: CmsGlobalSettings;
};

export type CmsGlobalSettingsPatch = {
  tokens?: Partial<CmsDesignTokens>;
  layout?: CmsLayout;
};

export type CmsPageSettings = {
  pageId: string;
  inheritGlobalSettings: boolean;
  templateId: string | null;
  overrides: Record<string, unknown>;
};

export type CmsPageSettingsResponse = {
  configurationState: CmsSettingsState;
  settings: CmsPageSettings;
};

export type CmsPageSettingsPatch = {
  inheritGlobalSettings?: boolean;
  templateId?: string | null;
  overrides?: Record<string, unknown>;
};

export type CmsResolvedModule = {
  blockId: string;
  type: string;
  placement: CmsModulePlacement;
};

export type CmsResolvedPageSettings = {
  pageId: string;
  globalSettingsState: CmsSettingsState;
  pageSettingsState: CmsSettingsState;
  inheritGlobalSettings: boolean;
  templateId: string | null;
  resolvedFrom: CmsResolvedSettingsLayer[];
  tokens: CmsDesignTokens;
  layout: CmsLayout;
  moduleSlots: CmsModuleSlot[];
  modules: CmsResolvedModule[];
};

export type CmsTemplateSettings = {
  templateId: string;
  organizationId: string;
  shopId: string;
  locale: string;
  pageType: CmsPageType | string;
  name: string;
  status: CmsTemplateStatus;
  settings: {
    inheritGlobalSettings: boolean;
    templateId: string | null;
    overrides: Record<string, unknown>;
  };
};

export type CmsTemplateSettingsList = {
  total: number;
  limit: number;
  offset: number;
  items: CmsTemplateSettings[];
};

export type CmsTemplateSettingsPayload = {
  pageType?: CmsPageType | string;
  name?: string;
  status?: CmsTemplateStatus;
  settings?: {
    inheritGlobalSettings: boolean;
    templateId: string | null;
    overrides: Record<string, unknown>;
  };
};

export type CmsTemplateSettingsFilters = {
  pageType?: CmsPageType | "all";
  status?: CmsTemplateStatus | "all";
  limit?: number;
  offset?: number;
};

export const CMS_FALLBACK_FONT_OPTIONS: CmsFontOption[] = [
  { family: "Inter", provider: "google", weights: [400, 500, 600, 700], category: "sans" },
  { family: "Inter Tight", provider: "google", weights: [400, 500, 600, 700], category: "sans" },
  { family: "Roboto", provider: "google", weights: [400, 500, 700], category: "sans" },
  { family: "Roboto Mono", provider: "google", weights: [400, 500], category: "mono" },
  { family: "Open Sans", provider: "google", weights: [400, 500, 600, 700], category: "sans" },
  { family: "Lato", provider: "google", weights: [400, 700], category: "sans" },
  { family: "Montserrat", provider: "google", weights: [400, 500, 600, 700], category: "sans" },
  { family: "Poppins", provider: "google", weights: [400, 500, 600, 700], category: "sans" },
  { family: "Merriweather", provider: "google", weights: [400, 700], category: "serif" },
  { family: "Playfair Display", provider: "google", weights: [400, 600, 700], category: "display" },
];

const fallbackSpacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function statusValue(value: unknown): CmsPageStatus {
  return value === "PUBLISHED" || value === "UNPUBLISHED" ? value : "DRAFT";
}

function settingsStateValue(value: unknown): CmsSettingsState {
  return value === "PERSISTED" ? "PERSISTED" : "INITIAL";
}

function booleanValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function stringRecordValue(value: unknown, fallback: Record<string, string> = {}) {
  const record = asRecord(value);
  const entries = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length ? Object.fromEntries(entries) : fallback;
}

function overridesValue(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function responsiveVisibilityValue(value: unknown): CmsResponsiveVisibility {
  const record = asRecord(value);
  return {
    mobile: booleanValue(record.mobile, true),
    tablet: booleanValue(record.tablet, true),
    desktop: booleanValue(record.desktop, true),
  };
}

function spacingValue(value: unknown): CmsSpacing {
  const record = asRecord(value);
  const spacing: CmsSpacing = {};
  for (const key of ["marginTop", "marginBottom", "paddingTop", "paddingBottom"] as const) {
    const text = nullableString(record[key]);
    if (text) spacing[key] = text;
  }
  return spacing;
}

function regionValue(value: unknown): CmsRegionCode {
  return value === "header" || value === "footer" ? value : "main";
}

function containerModeValue(value: unknown): CmsContainerMode {
  return value === "full-width" ? "full-width" : "container";
}

function placementContainerModeValue(value: unknown): CmsPlacementContainerMode {
  return value === "full-width" || value === "container" ? value : "inherit";
}

function alignmentValue(value: unknown): CmsAlignment {
  if (value === "start" || value === "center" || value === "end") return value;
  return "stretch";
}

function layoutSourceValue(value: unknown): CmsLayoutSource | undefined {
  if (value === "global" || value === "template" || value === "page" || value === "module") {
    return value;
  }
  return undefined;
}

function templateStatusValue(value: unknown): CmsTemplateStatus {
  if (value === "ACTIVE" || value === "ARCHIVED") return value;
  return "DRAFT";
}

function resolvedLayerValue(value: unknown): CmsResolvedSettingsLayer | null {
  if (value === "global" || value === "template" || value === "page" || value === "module") {
    return value;
  }
  return null;
}

function isExplicitCssLength(value: string) {
  return /^(?:0|-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|dvh|dvw|svh|svw|lvh|lvw|ch|ex))$/.test(value.trim());
}

export function resolveCmsSpacingValue(
  value: string | null | undefined,
  spacing: Record<string, string>,
  fallback = "24px",
) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  if (spacing[normalized]) return spacing[normalized];
  if (isExplicitCssLength(normalized)) return normalized;
  return fallback;
}

function normalizeSpacingScale(value: unknown) {
  const record = {
    ...fallbackSpacing,
    ...stringRecordValue(value),
  };
  return Object.fromEntries(
    Object.entries(record).map(([key, spacing]) => [
      key,
      isExplicitCssLength(spacing) ? spacing : fallbackSpacing[key as keyof typeof fallbackSpacing] ?? "24px",
    ]),
  );
}

function fontWeightsForSlot(slot: string, family: string) {
  const normalizedSlot = slot.toLowerCase();
  const normalizedFamily = family.toLowerCase();
  if (normalizedSlot === "mono" || normalizedFamily.includes("mono")) return [400, 500];
  if (normalizedSlot === "heading" || normalizedSlot === "headings") return [600, 700];
  return [400, 500, 600, 700];
}

export function cmsTypographyTokenFromFamily(slot: string, family: string): CmsTypographyToken {
  return {
    family,
    provider: "google",
    weights: fontWeightsForSlot(slot, family),
  };
}

export function cmsTypographyFamily(token: CmsTypographyToken | undefined, fallback = "Inter") {
  return token?.family || fallback;
}

function normalizeTypographyToken(value: unknown, slot: string): CmsTypographyToken {
  if (typeof value === "string" && value.trim()) {
    return cmsTypographyTokenFromFamily(slot, value.trim());
  }

  const record = asRecord(value);
  const family = stringValue(record.family, slot === "mono" ? "Roboto Mono" : "Inter");
  const weights = Array.isArray(record.weights)
    ? record.weights.filter((weight): weight is number => Number.isInteger(weight) && weight >= 100 && weight <= 900 && weight % 100 === 0)
    : fontWeightsForSlot(slot, family);

  return {
    family,
    provider: record.provider === "google" ? "google" : "google",
    weights: weights.length ? [...new Set(weights)].sort((left, right) => left - right) : fontWeightsForSlot(slot, family),
  };
}

function normalizeTypographyRecord(value: unknown): Record<string, CmsTypographyToken> {
  const record = asRecord(value);
  const normalized = Object.fromEntries(
    Object.entries(record).map(([slot, token]) => [slot, normalizeTypographyToken(token, slot)]),
  );

  return {
    body: normalized.body ?? cmsTypographyTokenFromFamily("body", "Inter"),
    heading: normalized.heading ?? normalized.headings ?? cmsTypographyTokenFromFamily("heading", "Inter"),
    mono: normalized.mono ?? cmsTypographyTokenFromFamily("mono", "Roboto Mono"),
    ...normalized,
  };
}

function normalizeDesignTokens(value: unknown): CmsDesignTokens {
  const record = asRecord(value);
  const breakpoints = asRecord(record.breakpoints);
  const spacing = normalizeSpacingScale(record.spacing);
  return {
    colors: stringRecordValue(record.colors, { background: "#ffffff", primary: "#111111" }),
    typography: normalizeTypographyRecord(record.typography),
    maxWidth: stringValue(record.maxWidth, "1280px"),
    spacing,
    breakpoints: {
      mobile: stringValue(breakpoints.mobile, "0px"),
      tablet: stringValue(breakpoints.tablet, "768px"),
      desktop: stringValue(breakpoints.desktop, "1024px"),
    },
    defaultColumnGap: resolveCmsSpacingValue(stringValue(record.defaultColumnGap), spacing, "16px"),
    defaultModuleGap: resolveCmsSpacingValue(stringValue(record.defaultModuleGap), spacing, "24px"),
  };
}

function normalizeColumnSlot(value: unknown, index = 0): CmsColumnSlot {
  const record = asRecord(value);
  const columnIndex = numberValue(record.columnIndex, index + 1);
  return {
    columnIndex: columnIndex > 0 ? columnIndex : index + 1,
    width: stringValue(record.width, "100%"),
    percentage: numberValue(record.percentage, 100),
  };
}

function normalizeArea(value: unknown): CmsArea {
  const record = asRecord(value);
  const columns = Array.isArray(record.columns)
    ? record.columns.filter((column): column is string => typeof column === "string")
    : ["100%"];
  const columnSlots = Array.isArray(record.columnSlots)
    ? record.columnSlots.map(normalizeColumnSlot)
    : columns.map((column, index) => ({ columnIndex: index + 1, width: column, percentage: Number(column.replace("%", "")) || 100 }));

  return {
    areaId: stringValue(record.areaId),
    name: nullableString(record.name),
    containerMode: containerModeValue(record.containerMode),
    maxWidth: nullableString(record.maxWidth),
    columns: columns.length ? columns : ["100%"],
    columnSlots,
    columnGap: nullableString(record.columnGap),
    rowGap: nullableString(record.rowGap),
    spacing: spacingValue(record.spacing),
    visibility: responsiveVisibilityValue(record.visibility),
  };
}

function normalizeLayout(value: unknown): CmsLayout {
  const record = asRecord(value);
  const regionsRecord = asRecord(record.regions);
  const regions: CmsLayout["regions"] = {};

  for (const region of ["header", "main", "footer"] as const) {
    const regionRecord = asRecord(regionsRecord[region]);
    if (!Object.keys(regionRecord).length) continue;
    regions[region] = {
      source: layoutSourceValue(regionRecord.source),
      areas: Array.isArray(regionRecord.areas) ? regionRecord.areas.map(normalizeArea) : [],
    };
  }

  return { regions };
}

function resolveSpacingRecord(value: CmsSpacing, spacing: Record<string, string>): CmsSpacing {
  return Object.fromEntries(
    Object.entries(value).map(([key, token]) => [key, resolveCmsSpacingValue(token, spacing)]),
  ) as CmsSpacing;
}

export function resolveCmsLayoutSpacing(layout: CmsLayout, spacing: Record<string, string>): CmsLayout {
  return {
    regions: Object.fromEntries(
      Object.entries(layout.regions).map(([region, regionLayout]) => [
        region,
        regionLayout
          ? {
              ...regionLayout,
              areas: regionLayout.areas.map((area) => ({
                ...area,
                columnGap: area.columnGap ? resolveCmsSpacingValue(area.columnGap, spacing) : area.columnGap,
                rowGap: area.rowGap ? resolveCmsSpacingValue(area.rowGap, spacing) : area.rowGap,
                spacing: resolveSpacingRecord(area.spacing, spacing),
              })),
            }
          : regionLayout,
      ]),
    ) as CmsLayout["regions"],
  };
}

function resolveModulePlacementSpacing(placement: CmsModulePlacement, spacing: Record<string, string>): CmsModulePlacement {
  return {
    ...placement,
    spacing: resolveSpacingRecord(placement.spacing, spacing),
  };
}

function normalizeModulePlacement(value: unknown): CmsModulePlacement {
  const record = asRecord(value);
  return {
    region: regionValue(record.region),
    areaId: stringValue(record.areaId),
    columnIndex: numberValue(record.columnIndex, 1),
    order: numberValue(record.order, 1),
    width: nullableString(record.width),
    align: alignmentValue(record.align),
    spacing: spacingValue(record.spacing),
    visibility: responsiveVisibilityValue(record.visibility),
    containerMode: placementContainerModeValue(record.containerMode),
  };
}

function normalizeModuleSlot(value: unknown, index = 0): CmsModuleSlot {
  const record = asRecord(value);
  return {
    ...normalizeColumnSlot(record, index),
    region: regionValue(record.region),
    areaId: stringValue(record.areaId),
  };
}

function normalizeResolvedModule(value: unknown): CmsResolvedModule {
  const record = asRecord(value);
  return {
    blockId: stringValue(record.blockId),
    type: stringValue(record.type),
    placement: normalizeModulePlacement(record.placement),
  };
}

function normalizePage(value: unknown): CmsPage {
  const record = asRecord(value);
  return {
    pageId: stringValue(record.pageId),
    organizationId: stringValue(record.organizationId),
    shopId: stringValue(record.shopId),
    locale: stringValue(record.locale),
    pageType: stringValue(record.pageType, "LANDING"),
    title: stringValue(record.title),
    path: stringValue(record.path),
    status: statusValue(record.status),
    routeId: nullableString(record.routeId),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    publishedAt: nullableString(record.publishedAt),
  };
}

function normalizeVersion(value: unknown): CmsPageVersion | null {
  const record = asRecord(value);
  if (!record.versionId) {
    return null;
  }
  const seo = asRecord(record.seo);
  return {
    versionId: stringValue(record.versionId),
    pageId: stringValue(record.pageId),
    version: numberValue(record.version),
    status: record.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    title: stringValue(record.title),
    seo: {
      title: stringValue(seo.title),
      description: stringValue(seo.description),
    },
    blocks: Array.isArray(record.blocks) ? record.blocks.map(normalizeCmsBlock) : [],
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
    publishedAt: nullableString(record.publishedAt),
  };
}

function normalizePageDetail(value: unknown): CmsPageDetail {
  const page = normalizePage(value);
  const record = asRecord(value);
  return {
    ...page,
    latestVersion: normalizeVersion(record.latestVersion),
    publishedVersion: normalizeVersion(record.publishedVersion),
  };
}

function normalizeGlobalSettings(value: unknown): CmsGlobalSettingsResponse {
  const record = asRecord(value);
  const settings = asRecord(record.settings);
  const tokens = normalizeDesignTokens(settings.tokens);
  return {
    configurationState: settingsStateValue(record.configurationState),
    settings: {
      organizationId: stringValue(settings.organizationId),
      shopId: stringValue(settings.shopId),
      locale: stringValue(settings.locale),
      tokens,
      layout: resolveCmsLayoutSpacing(normalizeLayout(settings.layout), tokens.spacing),
    },
  };
}

function normalizePageSettings(value: unknown): CmsPageSettingsResponse {
  const record = asRecord(value);
  const settings = asRecord(record.settings);
  return {
    configurationState: settingsStateValue(record.configurationState),
    settings: {
      pageId: stringValue(settings.pageId),
      inheritGlobalSettings: booleanValue(settings.inheritGlobalSettings, true),
      templateId: nullableString(settings.templateId),
      overrides: overridesValue(settings.overrides),
    },
  };
}

function normalizeResolvedPageSettings(value: unknown): CmsResolvedPageSettings {
  const record = asRecord(value);
  const tokens = normalizeDesignTokens(record.tokens);
  return {
    pageId: stringValue(record.pageId),
    globalSettingsState: settingsStateValue(record.globalSettingsState),
    pageSettingsState: settingsStateValue(record.pageSettingsState),
    inheritGlobalSettings: booleanValue(record.inheritGlobalSettings, true),
    templateId: nullableString(record.templateId),
    resolvedFrom: Array.isArray(record.resolvedFrom)
      ? record.resolvedFrom.map(resolvedLayerValue).filter((layer): layer is CmsResolvedSettingsLayer => !!layer)
      : ["global"],
    tokens,
    layout: resolveCmsLayoutSpacing(normalizeLayout(record.layout), tokens.spacing),
    moduleSlots: Array.isArray(record.moduleSlots) ? record.moduleSlots.map(normalizeModuleSlot) : [],
    modules: Array.isArray(record.modules)
      ? record.modules.map(normalizeResolvedModule).map((module) => ({
          ...module,
          placement: resolveModulePlacementSpacing(module.placement, tokens.spacing),
        }))
      : [],
  };
}

function normalizeTemplateSettings(value: unknown): CmsTemplateSettings {
  const record = asRecord(value);
  const settings = asRecord(record.settings);
  return {
    templateId: stringValue(record.templateId),
    organizationId: stringValue(record.organizationId),
    shopId: stringValue(record.shopId),
    locale: stringValue(record.locale),
    pageType: stringValue(record.pageType, "LANDING"),
    name: stringValue(record.name),
    status: templateStatusValue(record.status),
    settings: {
      inheritGlobalSettings: booleanValue(settings.inheritGlobalSettings, true),
      templateId: nullableString(settings.templateId),
      overrides: overridesValue(settings.overrides),
    },
  };
}

function normalizeTemplateSettingsList(value: unknown): CmsTemplateSettingsList {
  const record = asRecord(value);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems.map(normalizeTemplateSettings);
  return {
    total: numberValue(record.total, items.length),
    limit: numberValue(record.limit, 50),
    offset: numberValue(record.offset, 0),
    items,
  };
}

function normalizeFontOption(value: unknown): CmsFontOption {
  const record = asRecord(value);
  const family = stringValue(record.family, "Inter");
  const token = normalizeTypographyToken(record, "body");
  return {
    ...token,
    family,
    category: stringValue(record.category, "sans"),
  };
}

function normalizeFontOptions(value: unknown): CmsFontOptionsResponse {
  const record = asRecord(value);
  const items = Array.isArray(record.items) ? record.items.map(normalizeFontOption) : CMS_FALLBACK_FONT_OPTIONS;
  return {
    provider: "google",
    items: items.length ? items : CMS_FALLBACK_FONT_OPTIONS,
  };
}

function normalizePagesList(value: unknown): CmsPagesList {
  const record = asRecord(value);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems.map(normalizePage);
  return {
    total: numberValue(record.total, items.length),
    limit: numberValue(record.limit, 50),
    offset: numberValue(record.offset, 0),
    items,
  };
}

function makeScopedParams(
  context: AdminContext,
  extra?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  if (context.organizationId) params.set("organizationId", context.organizationId);
  if (context.shopId) params.set("shopId", context.shopId);
  if (context.locale) params.set("locale", context.locale);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value?.trim()) params.set(key, value.trim());
  }

  return params;
}

function unavailable<T>(
  endpoint: string,
  fallback: T,
  result: Extract<BffResult<T>, { ok: false }>,
  permission: CmsAdminResult<T>["permission"],
): CmsAdminResult<T> {
  return {
    source: "unavailable",
    data: fallback,
    message: result.status === 403 ? `Falta permiso ${permission}.` : result.error,
    failedEndpoint: endpoint,
    status: result.status,
    permission: result.status === 403 ? permission : undefined,
    correlationId: result.correlationId,
  };
}

function matchesPage(page: CmsPage, query: string | undefined) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return (
    page.title.toLowerCase().includes(normalized) ||
    page.path.toLowerCase().includes(normalized) ||
    page.pageId.toLowerCase().includes(normalized)
  );
}

export async function getCmsAdminData(
  context: AdminContext,
  filters: CmsAdminFilters,
): Promise<CmsAdminData> {
  const locale = filters.locale ?? context.locale;
  const endpoint = `/admin/cms/pages?${makeScopedParams(context, {
    locale,
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    pageType: filters.pageType && filters.pageType !== "all" ? filters.pageType : undefined,
    limit: "50",
    offset: "0",
  }).toString()}`;
  const pagesResult = await requestBff(endpoint, { context: { ...context, locale }, parse: normalizePagesList });

  const pages = pagesResult.ok
    ? {
        source: "bff" as const,
        data: {
          ...pagesResult.data,
          items: pagesResult.data.items.filter((page) => matchesPage(page, filters.q)),
        },
        correlationId: pagesResult.correlationId,
      }
    : unavailable(endpoint, { total: 0, limit: 50, offset: 0, items: [] }, pagesResult, "cms.pages.read");

  const emptySettings: CmsAdminResult<CmsPageSettingsResponse | null> = { source: "bff", data: null };
  const emptyResolved: CmsAdminResult<CmsResolvedPageSettings | null> = { source: "bff", data: null };
  const emptyTemplates: CmsAdminResult<CmsTemplateSettingsList> = {
    source: "bff",
    data: { total: 0, limit: 50, offset: 0, items: [] },
  };

  if (!filters.pageId) {
    return {
      pages,
      selectedPage: { source: "bff", data: null },
      pageSettings: emptySettings,
      resolvedPageSettings: emptyResolved,
      templates: emptyTemplates,
    };
  }

  const detailEndpoint = `/admin/cms/pages/${encodeURIComponent(filters.pageId)}?${makeScopedParams(context, {
    locale,
  }).toString()}`;
  const detailResult = await requestBff(detailEndpoint, {
    context: { ...context, locale },
    parse: normalizePageDetail,
  });

  if (!detailResult.ok) {
    return {
      pages,
      selectedPage: unavailable(detailEndpoint, null, detailResult, "cms.pages.read"),
      pageSettings: emptySettings,
      resolvedPageSettings: emptyResolved,
      templates: emptyTemplates,
    };
  }

  const pageSettingsEndpoint = `/admin/cms/pages/${encodeURIComponent(filters.pageId)}/settings?${makeScopedParams(context, {
    locale,
  }).toString()}`;
  const resolvedEndpoint = `/admin/cms/pages/${encodeURIComponent(filters.pageId)}/resolved-settings?${makeScopedParams(context, {
    locale,
  }).toString()}`;
  const templatesEndpoint = `/admin/cms/templates?${makeScopedParams(context, {
    locale,
    pageType: detailResult.data.pageType,
    limit: "50",
    offset: "0",
  }).toString()}`;

  const [pageSettingsResult, resolvedResult, templatesResult] = await Promise.all([
    requestBff(pageSettingsEndpoint, {
      context: { ...context, locale },
      parse: normalizePageSettings,
    }),
    requestBff(resolvedEndpoint, {
      context: { ...context, locale },
      parse: normalizeResolvedPageSettings,
    }),
    requestBff(templatesEndpoint, {
      context: { ...context, locale },
      parse: normalizeTemplateSettingsList,
    }),
  ]);

  return {
    pages,
    selectedPage: { source: "bff", data: detailResult.data, correlationId: detailResult.correlationId },
    pageSettings: pageSettingsResult.ok
      ? { source: "bff", data: pageSettingsResult.data, correlationId: pageSettingsResult.correlationId }
      : unavailable(pageSettingsEndpoint, null, pageSettingsResult, "cms.settings.read"),
    resolvedPageSettings: resolvedResult.ok
      ? { source: "bff", data: resolvedResult.data, correlationId: resolvedResult.correlationId }
      : unavailable(resolvedEndpoint, null, resolvedResult, "cms.settings.read"),
    templates: templatesResult.ok
      ? { source: "bff", data: templatesResult.data, correlationId: templatesResult.correlationId }
      : unavailable(templatesEndpoint, { total: 0, limit: 50, offset: 0, items: [] }, templatesResult, "cms.settings.read"),
  };
}

export async function createCmsPage(
  context: AdminContext,
  payload: Record<string, unknown>,
  locale?: string,
) {
  const endpoint = `/admin/cms/pages?${makeScopedParams(context, { locale: locale ?? context.locale }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizePageDetail,
  });
}

export async function updateCmsDraft(
  context: AdminContext,
  pageId: string,
  payload: Record<string, unknown>,
  locale?: string,
) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/draft?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizePageDetail,
  });
}

export async function publishCmsPage(context: AdminContext, pageId: string, locale?: string) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/publish?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    },
    parse: normalizePageDetail,
  });
}

export async function unpublishCmsPage(context: AdminContext, pageId: string, locale?: string) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/unpublish?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: { method: "POST" },
    parse: normalizePageDetail,
  });
}

export async function changeCmsPublishedPath(
  context: AdminContext,
  pageId: string,
  nextPath: string,
  locale?: string,
) {
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/path?${makeScopedParams(context, {
    locale: locale ?? context.locale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: locale ?? context.locale },
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nextPath }),
    },
    parse: normalizePageDetail,
  });
}

export async function getCmsGlobalSettings(context: AdminContext, locale?: string) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/settings/global?${makeScopedParams(context, { locale: effectiveLocale }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    parse: normalizeGlobalSettings,
  });
}

export async function getCmsFontOptions(context: AdminContext, locale?: string) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/font-options?${makeScopedParams(context, { locale: effectiveLocale }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    parse: normalizeFontOptions,
  });
}

export async function patchCmsGlobalSettings(
  context: AdminContext,
  payload: CmsGlobalSettingsPatch,
  locale?: string,
) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/settings/global?${makeScopedParams(context, { locale: effectiveLocale }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeGlobalSettings,
  });
}

export async function getCmsPageSettings(
  context: AdminContext,
  pageId: string,
  locale?: string,
) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/settings?${makeScopedParams(context, {
    locale: effectiveLocale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    parse: normalizePageSettings,
  });
}

export async function patchCmsPageSettings(
  context: AdminContext,
  pageId: string,
  payload: CmsPageSettingsPatch,
  locale?: string,
) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/settings?${makeScopedParams(context, {
    locale: effectiveLocale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizePageSettings,
  });
}

export async function getCmsResolvedPageSettings(
  context: AdminContext,
  pageId: string,
  locale?: string,
) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/pages/${encodeURIComponent(pageId)}/resolved-settings?${makeScopedParams(context, {
    locale: effectiveLocale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    parse: normalizeResolvedPageSettings,
  });
}

export async function listCmsTemplates(
  context: AdminContext,
  filters: CmsTemplateSettingsFilters = {},
  locale?: string,
) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/templates?${makeScopedParams(context, {
    locale: effectiveLocale,
    pageType: filters.pageType && filters.pageType !== "all" ? filters.pageType : undefined,
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    limit: String(filters.limit ?? 50),
    offset: String(filters.offset ?? 0),
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    parse: normalizeTemplateSettingsList,
  });
}

export async function createCmsTemplate(
  context: AdminContext,
  payload: Required<Pick<CmsTemplateSettingsPayload, "pageType" | "name">> & CmsTemplateSettingsPayload,
  locale?: string,
) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/templates?${makeScopedParams(context, { locale: effectiveLocale }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeTemplateSettings,
  });
}

export async function patchCmsTemplate(
  context: AdminContext,
  templateId: string,
  payload: CmsTemplateSettingsPayload,
  locale?: string,
) {
  const effectiveLocale = locale ?? context.locale;
  const endpoint = `/admin/cms/templates/${encodeURIComponent(templateId)}?${makeScopedParams(context, {
    locale: effectiveLocale,
  }).toString()}`;
  return requestBff(endpoint, {
    context: { ...context, locale: effectiveLocale },
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    parse: normalizeTemplateSettings,
  });
}
