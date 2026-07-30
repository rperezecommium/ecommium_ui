"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { ArrowDown, ArrowUp, Clipboard, CopyPlus, FileJson, Redo2, Trash2, Undo2, Upload } from "lucide-react";
import { uploadCmsBuilderMediaAction } from "./cms-admin-actions";
import {
  blocksFromJson,
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockDefinition,
  getCmsBlockDefinitions,
  getCmsBlockPlacement,
  getCmsBlockPlpTarget,
  getCmsBlockSurface,
  migrateCmsVisualModuleV1ToV2ForRenderer,
  normalizeCmsVisualModuleProps,
  normalizeCmsVisualModuleV2Props,
  normalizeCmsVisualNode,
  normalizeCmsBlock,
  type CmsBlock,
  type CmsBlockModulePlacement,
  type CmsPlpListingKind,
  type CmsSurface,
  type CmsVisualAssetRef,
  type CmsVisualBreakpoint,
  type CmsVisualContentField,
  type CmsVisualContentSchema,
  type CmsVisualElement,
  type CmsVisualHoverStyleKey,
  type CmsVisualInteractionTransition,
  type CmsVisualModuleV2Props,
  type CmsVisualNode,
  type CmsVisualNodeProps,
  type CmsVisualNodeStyle,
  type CmsVisualNodeType,
  type CmsVisualPanel,
  cmsVisualHoverStyleKeys,
} from "./cms-blocks";
import {
  CmsBlockRenderer,
  CmsPlpStorefrontPreviewRenderer,
} from "../../../packages/cms-blocks/src/react";
import type {
  CmsDesignTokens,
  CmsLayout,
  CmsModulePlacement,
  CmsModuleSlot,
  CmsResolvedModule,
  CmsRegionCode,
  CmsVisualModuleDefinition,
  CmsVisualModuleDefinitionsList,
} from "./cms-admin";

type CmsBlockBuilderClientProps = {
  contextLabel: string;
  initialBlocks: CmsBlock[];
  initialPageId?: string;
  locale: string;
  pageOptions: CmsBlockBuilderPageOption[];
  pageSummary: CmsBlockBuilderPageSummary | null;
  resolvedCanvas: CmsBlockBuilderResolvedCanvas | null;
  resolvedSummary: CmsBlockBuilderResolvedSummary | null;
  saveDraftAction: (formData: FormData) => void | Promise<void>;
  saveVisualModuleDefinitionAction: (formData: FormData) => void | Promise<void>;
  visualModules: CmsVisualModuleDefinitionsList;
};

type BuilderViewport = "desktop" | "tablet" | "mobile";
type CmsBlockBuilderPageOption = {
  pageId: string;
  pageType: string;
  path: string;
  status: string;
  title: string;
};
type CmsBlockBuilderPageSummary = CmsBlockBuilderPageOption & {
  canSaveDraft: boolean;
  seoDescription: string;
  seoTitle: string;
  versionLabel: string;
};
type CmsBlockBuilderResolvedSummary = {
  maxWidth: string;
  moduleSlots: number;
  modules: number;
  templateId: string | null;
};
type CmsBlockBuilderResolvedCanvas = {
  layout: CmsLayout;
  modules: CmsResolvedModule[];
  tokens: CmsDesignTokens;
};
type CmsBlockBuilderValidationIssue = {
  blockId?: string;
  message: string;
  severity: "error" | "warning";
};
type CmsBlockBuilderMediaUploadState = {
  assetKey: string;
  mediaAssetId?: string;
  message?: string;
  previewUrl?: string;
  status: "idle" | "uploading" | "uploaded" | "failed";
};
type CmsBlockBuilderHistory = {
  future: CmsBlock[][];
  past: CmsBlock[][];
};
type CmsBlockBuilderState = {
  blocks: CmsBlock[];
  exportMessage: string | null;
  history: CmsBlockBuilderHistory;
  importDraft: string;
  importMessage: string | null;
  mediaUploads: CmsBlockBuilderMediaUploadState[];
  selectedBlockId: string | null;
  selectedVisualNodeId: string | null;
  surface: CmsSurface;
  validationIssues: CmsBlockBuilderValidationIssue[];
  viewport: BuilderViewport;
  visualImportDraft: string;
  visualModulePresets: CmsVisualModulePreset[];
  visualPortabilityMessage: string | null;
  visualPresetMessage: string | null;
  visualPresetName: string;
  visualStyleScope: CmsVisualStyleScope;
};
type CmsBlockBuilderAction =
  | { type: "applyBlocks"; blocks: CmsBlock[]; selectedBlockId?: string | null; selectedVisualNodeId?: string | null; surface?: CmsSurface }
  | { type: "mutateBlocks"; mutate: (blocks: CmsBlock[]) => CmsBlock[]; selectedBlockId?: string | null; selectedVisualNodeId?: string | null; surface?: CmsSurface }
  | { type: "redo" }
  | { type: "selectBlock"; blockId: string | null }
  | { type: "selectVisualNode"; nodeId: string | null }
  | { type: "setExportMessage"; message: string | null }
  | { type: "setImportDraft"; draft: string }
  | { type: "setImportMessage"; message: string | null }
  | { type: "setMediaUpload"; upload: CmsBlockBuilderMediaUploadState }
  | { type: "setSurface"; surface: CmsSurface }
  | { type: "setValidationIssues"; issues: CmsBlockBuilderValidationIssue[] }
  | { type: "setViewport"; viewport: BuilderViewport }
  | { type: "setVisualImportDraft"; draft: string }
  | { type: "setVisualModulePresets"; presets: CmsVisualModulePreset[] }
  | { type: "setVisualPortabilityMessage"; message: string | null }
  | { type: "setVisualPresetMessage"; message: string | null }
  | { type: "setVisualPresetName"; name: string }
  | { type: "setVisualStyleScope"; scope: CmsVisualStyleScope }
  | { type: "undo" };
type CmsVisualNodeEditableProp = Exclude<keyof CmsVisualNodeProps, "target">;
type CmsVisualMediaUploadTarget =
  | { kind: "prop"; key: CmsVisualNodeEditableProp; role: NonNullable<CmsVisualAssetRef["role"]> }
  | { kind: "style"; key: keyof CmsVisualNodeStyle; role: NonNullable<CmsVisualAssetRef["role"]> };
type CmsVisualStyleScope = "base" | CmsVisualBreakpoint;
type CmsVisualNodeMoveTarget = {
  depth: number;
  label: string;
  nodeId: string;
  type: CmsVisualNodeType;
};
type CmsVisualModulePreset = {
  assetRefs?: CmsVisualAssetRef[];
  contentSchema?: CmsVisualContentSchema;
  contentValues?: Record<string, unknown>;
  createdAt: string;
  definitionId: string;
  moduleId: string;
  name: string;
  presetId: string;
  revision: number;
  source?: "local" | "system";
  schemaMinorVersion: number;
  schemaVersion: 2;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  tree: CmsVisualNode;
  updatedAt: string;
  version: number;
};

const viewportLabels: Record<BuilderViewport, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};
const visualStyleScopeLabels: Record<CmsVisualStyleScope, string> = {
  base: "Base",
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};
const visualStyleScopes: CmsVisualStyleScope[] = ["base", "desktop", "tablet", "mobile"];
const visualAnimationPresets = ["none", "fadeIn", "slideUp", "scaleIn"] as const;
const visualAnimationEasings = ["standard", "emphasized", "linear"] as const;
const visualAnimationTriggers = ["load", "inView"] as const;
const cmsRegionCodes: CmsRegionCode[] = ["header", "main", "footer"];
const visualModulePresetsStorageKey = "ecommium.cms.visualModulePresets.v1";
const visualNodeCatalog: Array<{
  description: string;
  label: string;
  type: CmsVisualNodeType;
}> = [
  { type: "container", label: "Container", description: "Contenedor principal con ancho y padding." },
  { type: "section", label: "Section", description: "Bloque semantico para agrupar contenido." },
  { type: "div", label: "Div", description: "Caja neutra para composicion libre." },
  { type: "grid", label: "Grid", description: "Layout por columnas CSS grid." },
  { type: "flex", label: "Flex", description: "Layout flexible para filas o columnas." },
  { type: "heading", label: "Heading", description: "Titulo editable del modulo." },
  { type: "paragraph", label: "Paragraph", description: "Texto corto o descriptivo." },
  { type: "richText", label: "Rich text", description: "Texto largo preformateado y seguro." },
  { type: "image", label: "Image", description: "Imagen con src y alt." },
  { type: "button", label: "Button", description: "CTA enlazado con estilo de boton." },
  { type: "link", label: "Link", description: "Enlace textual seguro." },
  { type: "icon", label: "Icon", description: "Texto/icono simple para decorar." },
  { type: "spacer", label: "Spacer", description: "Espacio vertical controlado." },
  { type: "video", label: "Video", description: "Enlace seguro a video externo." },
  { type: "htmlEmbed", label: "HTML embed", description: "HTML guardado como texto escapado." },
];
const visualStarterNodeTypes: CmsVisualNodeType[] = ["section", "grid", "flex", "heading", "paragraph", "button", "image"];
const visualContainerNodeTypes: CmsVisualNodeType[] = ["container", "section", "div", "grid", "flex"];
const visualNodePropFields: Array<{
  key: CmsVisualNodeEditableProp;
  label: string;
  multiline?: boolean;
  nodeTypes?: CmsVisualNodeType[];
}> = [
  { key: "text", label: "Texto", multiline: true, nodeTypes: ["heading", "paragraph", "richText", "button", "link", "icon"] },
  { key: "href", label: "Href", nodeTypes: ["button", "link"] },
  { key: "src", label: "Src", nodeTypes: ["image", "video"] },
  { key: "alt", label: "Alt", nodeTypes: ["image"] },
  { key: "title", label: "Title" },
  { key: "ariaLabel", label: "Aria label" },
  { key: "html", label: "HTML escapado", multiline: true, nodeTypes: ["htmlEmbed", "richText"] },
];
type CmsVisualStyleTarget = "module" | "panel" | "element";
type CmsVisualStyleControl = "color" | "media" | "radius" | "select" | "slider" | "text" | "tokenOrLength";
type CmsVisualStylePropertyDefinition = {
  appliesTo: CmsVisualStyleTarget[];
  control: CmsVisualStyleControl;
  cssProperty: string;
  group: "background" | "border" | "effects" | "layout" | "spacing" | "typography";
  helper?: string;
  key: keyof CmsVisualNodeStyle;
  label: string;
  options?: string[];
  suggestions?: string[];
  visibleWhen?: {
    nodeTypes?: CmsVisualNodeType[];
    property?: keyof CmsVisualNodeStyle;
    values?: string[];
  };
};
const allVisualStyleTargets: CmsVisualStyleTarget[] = ["module", "panel", "element"];
const visualStylePropertyRegistry: CmsVisualStylePropertyDefinition[] = [
  { key: "display", label: "Display", cssProperty: "display", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "block", "flex", "grid", "none"] },
  { key: "position", label: "Position", cssProperty: "position", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "relative", "absolute", "sticky"] },
  { key: "width", label: "Width", cssProperty: "width", group: "layout", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["100%", "50%", "min(100%, 1120px)"] },
  { key: "maxWidth", label: "Max width", cssProperty: "max-width", group: "layout", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["100%", "1120px", "var:container.lg"] },
  { key: "height", label: "Height", cssProperty: "height", group: "layout", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["auto", "100%", "320px"] },
  { key: "minHeight", label: "Min height", cssProperty: "min-height", group: "layout", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["220px", "60vh", "100vh"] },
  { key: "aspectRatio", label: "Aspect ratio", cssProperty: "aspect-ratio", group: "layout", control: "select", appliesTo: ["panel", "element"], options: ["", "1 / 1", "4 / 3", "16 / 9", "21 / 9"] },
  { key: "overflow", label: "Overflow", cssProperty: "overflow", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "visible", "hidden", "auto", "clip"] },
  { key: "padding", label: "Padding", cssProperty: "padding", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:spacing.sm", "var:spacing.md", "var:spacing.lg", "24px"] },
  { key: "paddingTop", label: "Padding top", cssProperty: "padding-top", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:spacing.md", "32px", "64px"] },
  { key: "paddingBottom", label: "Padding bottom", cssProperty: "padding-bottom", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:spacing.md", "32px", "64px"] },
  { key: "margin", label: "Margin", cssProperty: "margin", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["0", "0 auto", "var:spacing.md"] },
  { key: "marginBottom", label: "Margin bottom", cssProperty: "margin-bottom", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:spacing.sm", "var:spacing.md", "24px"] },
  { key: "gap", label: "Gap", cssProperty: "gap", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:spacing.sm", "var:spacing.md", "24px"], visibleWhen: { property: "display", values: ["flex", "grid"], nodeTypes: ["flex", "grid"] } },
  { key: "rowGap", label: "Row gap", cssProperty: "row-gap", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:spacing.sm", "var:spacing.md", "24px"], visibleWhen: { property: "display", values: ["grid"], nodeTypes: ["grid"] } },
  { key: "columnGap", label: "Column gap", cssProperty: "column-gap", group: "spacing", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:spacing.sm", "var:spacing.md", "24px"], visibleWhen: { property: "display", values: ["grid", "flex"], nodeTypes: ["grid", "flex"] } },
  { key: "gridTemplateColumns", label: "Grid columns", cssProperty: "grid-template-columns", group: "layout", control: "select", appliesTo: ["module", "panel"], options: ["", "repeat(2, minmax(0, 1fr))", "repeat(3, minmax(0, 1fr))", "minmax(0, 1fr) 360px"], visibleWhen: { property: "display", values: ["grid"], nodeTypes: ["grid"] } },
  { key: "flexDirection", label: "Flex direction", cssProperty: "flex-direction", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "row", "column", "row-reverse", "column-reverse"], visibleWhen: { property: "display", values: ["flex"], nodeTypes: ["flex"] } },
  { key: "flexWrap", label: "Flex wrap", cssProperty: "flex-wrap", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "nowrap", "wrap", "wrap-reverse"], visibleWhen: { property: "display", values: ["flex"], nodeTypes: ["flex"] } },
  { key: "alignItems", label: "Align items", cssProperty: "align-items", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "stretch", "flex-start", "center", "flex-end", "baseline"], visibleWhen: { property: "display", values: ["flex", "grid"], nodeTypes: ["flex", "grid"] } },
  { key: "justifyContent", label: "Justify content", cssProperty: "justify-content", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "flex-start", "center", "flex-end", "space-between", "space-around"], visibleWhen: { property: "display", values: ["flex", "grid"], nodeTypes: ["flex", "grid"] } },
  { key: "backgroundColor", label: "Background color", cssProperty: "background-color", group: "background", control: "color", appliesTo: allVisualStyleTargets, suggestions: ["var:color.surface", "var:color.primary", "#ffffff", "#111827"] },
  { key: "backgroundImage", label: "Background image", cssProperty: "background-image", group: "background", control: "media", appliesTo: ["module", "panel"], helper: "Usa asset:key hasta integrar Media en 7/12." },
  { key: "backgroundSize", label: "Background size", cssProperty: "background-size", group: "background", control: "select", appliesTo: ["module", "panel"], options: ["", "cover", "contain", "auto"] },
  { key: "backgroundPosition", label: "Background position", cssProperty: "background-position", group: "background", control: "select", appliesTo: ["module", "panel"], options: ["", "center", "top", "bottom", "left", "right"] },
  { key: "color", label: "Text color", cssProperty: "color", group: "typography", control: "color", appliesTo: allVisualStyleTargets, suggestions: ["var:color.text", "var:color.primary", "#111827"] },
  { key: "fontFamily", label: "Font family", cssProperty: "font-family", group: "typography", control: "text", appliesTo: ["module", "panel", "element"] },
  { key: "fontSize", label: "Font size", cssProperty: "font-size", group: "typography", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["var:fontSize.base", "var:fontSize.xl", "32px"] },
  { key: "fontWeight", label: "Font weight", cssProperty: "font-weight", group: "typography", control: "select", appliesTo: allVisualStyleTargets, options: ["", "400", "500", "600", "700", "800"] },
  { key: "lineHeight", label: "Line height", cssProperty: "line-height", group: "typography", control: "text", appliesTo: allVisualStyleTargets, suggestions: ["1", "1.15", "1.5"] },
  { key: "textAlign", label: "Text align", cssProperty: "text-align", group: "typography", control: "select", appliesTo: allVisualStyleTargets, options: ["", "left", "center", "right"] },
  { key: "border", label: "Border", cssProperty: "border", group: "border", control: "text", appliesTo: allVisualStyleTargets, suggestions: ["1px solid var:color.border", "1px solid #e5e7eb"] },
  { key: "borderRadius", label: "Radius", cssProperty: "border-radius", group: "border", control: "radius", appliesTo: allVisualStyleTargets, suggestions: ["var:radius.sm", "var:radius.md", "var:radius.lg", "16px"] },
  { key: "boxShadow", label: "Shadow", cssProperty: "box-shadow", group: "effects", control: "select", appliesTo: allVisualStyleTargets, options: ["", "var:shadow.sm", "var:shadow.md", "0 20px 45px rgba(15, 23, 42, 0.18)"] },
  { key: "opacity", label: "Opacity", cssProperty: "opacity", group: "effects", control: "slider", appliesTo: allVisualStyleTargets },
  { key: "objectFit", label: "Object fit", cssProperty: "object-fit", group: "layout", control: "select", appliesTo: ["element"], options: ["", "cover", "contain", "fill", "none"], visibleWhen: { nodeTypes: ["image", "video"] } },
];
const visualStylePropertyKeys = visualStylePropertyRegistry.map((field) => field.key);

function makeBuilderBlockId(block: CmsBlock) {
  return `${block.blockId}-copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeVisualBuilderNodeId(type: CmsVisualNodeType) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeVisualModulePresetId() {
  return `visual-preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const consultWorksSplitCtaContentSchema: CmsVisualContentSchema = {
  bodyFontSize: { type: "text", required: false, label: "Tamano texto descripcion" },
  buttonMinWidth: { type: "text", required: false, label: "Ancho minimo botones" },
  buttonPadding: { type: "text", required: false, label: "Padding botones" },
  buttonRadius: { type: "text", required: false, label: "Border radius botones" },
  columnRatio: { type: "number", required: true, label: "Proporcion lado izquierdo / lado derecho" },
  headingFontSize: { type: "text", required: false, label: "Tamano titulos" },
  leftBodyText: { type: "richText", required: true, label: "Texto lado izquierdo" },
  leftButtonBackgroundColor: { type: "color", required: false, label: "Fondo boton izquierdo" },
  leftButtonText: { type: "text", required: true, label: "Texto boton izquierdo" },
  leftButtonTextColor: { type: "color", required: false, label: "Color texto boton izquierdo" },
  leftHeadingText: { type: "text", required: true, label: "Titulo lado izquierdo" },
  leftOverlayColor: { type: "color", required: false, label: "Color overlay izquierdo" },
  leftOverlayOpacity: { type: "number", required: false, label: "Transparencia overlay izquierdo" },
  leftTextColor: { type: "color", required: false, label: "Color texto lado izquierdo" },
  moduleMargin: { type: "text", required: false, label: "Margin modulo" },
  moduleMinHeight: { type: "text", required: false, label: "Altura minima modulo" },
  moduleRadius: { type: "text", required: false, label: "Border radius modulo" },
  moduleWidth: { type: "text", required: false, label: "Ancho modulo" },
  panelPadding: { type: "text", required: false, label: "Padding paneles" },
  rightBodyText: { type: "richText", required: true, label: "Texto lado derecho" },
  rightButtonBackgroundColor: { type: "color", required: false, label: "Fondo boton derecho" },
  rightButtonText: { type: "text", required: true, label: "Texto boton derecho" },
  rightButtonTextColor: { type: "color", required: false, label: "Color texto boton derecho" },
  rightHeadingText: { type: "text", required: true, label: "Titulo lado derecho" },
  rightPanelBackgroundColor: { type: "color", required: false, label: "Fondo lado derecho" },
  rightTextColor: { type: "color", required: false, label: "Color texto lado derecho" },
};

const consultWorksSplitCtaContentValues: Record<string, unknown> = {
  bodyFontSize: "26px",
  buttonMinWidth: "264px",
  buttonPadding: "22px 34px",
  buttonRadius: "999px",
  columnRatio: 50,
  headingFontSize: "44px",
  leftBodyText: "There's nothing can hold me when I hold you. Feels so right it cant be wrong. Rockin' and rollin' all week long. A man is born he's a man come two they got nothing.",
  leftButtonBackgroundColor: "#202020",
  leftButtonText: "CONTACT US",
  leftButtonTextColor: "#ffffff",
  leftHeadingText: "NEED TO CONSULT WITH US?",
  leftOverlayColor: "#f5a21b",
  leftOverlayOpacity: 0.82,
  leftTextColor: "#ffffff",
  moduleMargin: "0",
  moduleMinHeight: "720px",
  moduleRadius: "0",
  moduleWidth: "100%",
  panelPadding: "72px 48px",
  rightBodyText: "There's nothing can hold me when I hold you. Feels so right it cant be wrong. Rockin' and rollin' all week long. A man is born he's a man come two they got nothing.",
  rightButtonBackgroundColor: "#f5a21b",
  rightButtonText: "VIEW WORKS",
  rightButtonTextColor: "#ffffff",
  rightHeadingText: "NEED TO EXPLORE OUR WORKS?",
  rightPanelBackgroundColor: "#2f4152",
  rightTextColor: "#ffffff",
};

const consultWorksSplitCtaTree: CmsVisualNode = {
  nodeId: "consult-works-split-cta-001",
  type: "container",
  label: "Consult works split CTA",
  animation: {
    preset: "fadeIn",
    durationMs: 420,
    easing: "standard",
    trigger: "load",
  },
  styles: {
    backgroundColor: "binding:rightPanelBackgroundColor",
    borderRadius: "binding:moduleRadius",
    display: "grid",
    gap: "0",
    gridTemplateColumns: "binding:columnRatio",
    margin: "binding:moduleMargin",
    minHeight: "binding:moduleMinHeight",
    overflow: "hidden",
    width: "binding:moduleWidth",
  },
  responsiveStyles: {
    mobile: {
      gridTemplateColumns: "1fr",
      minHeight: "0",
    },
  },
  children: [
    {
      nodeId: "consult-works-split-cta-001-left",
      type: "section",
      label: "Lado izquierdo con imagen",
      styles: {
        alignItems: "center",
        backgroundImage: "url(/storefront/cms/consult-works-engineers.jpg)",
        backgroundPosition: "center",
        backgroundSize: "cover",
        display: "flex",
        justifyContent: "center",
        minHeight: "binding:moduleMinHeight",
        overflow: "hidden",
        padding: "binding:panelPadding",
        position: "relative",
        textAlign: "center",
        width: "100%",
      },
      responsiveStyles: {
        mobile: {
          minHeight: "520px",
          padding: "56px 20px",
        },
      },
      children: [
        {
          nodeId: "consult-works-split-cta-001-left-overlay",
          type: "div",
          label: "Overlay izquierdo",
          styles: {
            backgroundColor: "binding:leftOverlayColor",
            height: "100%",
            opacity: "binding:leftOverlayOpacity",
            position: "absolute",
            width: "100%",
          },
          children: [],
        },
        {
          nodeId: "consult-works-split-cta-001-left-content",
          type: "section",
          label: "Contenido izquierdo",
          styles: {
            alignItems: "center",
            color: "binding:leftTextColor",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "1040px",
            position: "relative",
            width: "100%",
          },
          children: [
            {
              nodeId: "consult-works-split-cta-001-left-heading",
              type: "heading",
              label: "Titulo izquierdo",
              contentBinding: "leftHeadingText",
              props: { level: "2", text: "NEED TO CONSULT WITH US?" },
              styles: {
                color: "binding:leftTextColor",
                fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
                fontSize: "binding:headingFontSize",
                fontWeight: "800",
                letterSpacing: "0",
                lineHeight: "1.1",
                margin: "0",
                textAlign: "center",
              },
              responsiveStyles: {
                tablet: { fontSize: "38px" },
                mobile: { fontSize: "34px" },
              },
              children: [],
            },
            {
              nodeId: "consult-works-split-cta-001-left-body",
              type: "paragraph",
              label: "Texto izquierdo",
              contentBinding: "leftBodyText",
              props: {
                text: "There's nothing can hold me when I hold you. Feels so right it cant be wrong. Rockin' and rollin' all week long. A man is born he's a man come two they got nothing.",
              },
              styles: {
                color: "binding:leftTextColor",
                fontSize: "binding:bodyFontSize",
                fontWeight: "700",
                letterSpacing: "0",
                lineHeight: "1.45",
                margin: "0",
                marginTop: "64px",
                maxWidth: "1130px",
                textAlign: "center",
              },
              responsiveStyles: {
                tablet: { fontSize: "21px", marginTop: "42px" },
                mobile: { fontSize: "18px", marginTop: "30px" },
              },
              children: [],
            },
            {
              nodeId: "consult-works-split-cta-001-left-button",
              type: "button",
              label: "Boton izquierdo",
              contentBinding: "leftButtonText",
              interactions: {
                hover: {
                  styles: {
                    boxShadow: "0 18px 38px rgba(32, 32, 32, 0.24)",
                    transform: "translateY(-2px)",
                  },
                  transition: { durationMs: 160, easing: "emphasized" },
                },
              },
              props: {
                ariaLabel: "Contact us",
                href: "/contact",
                text: "CONTACT US",
              },
              styles: {
                alignItems: "center",
                backgroundColor: "binding:leftButtonBackgroundColor",
                borderRadius: "binding:buttonRadius",
                color: "binding:leftButtonTextColor",
                display: "inline-flex",
                fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
                fontSize: "25px",
                fontWeight: "800",
                justifyContent: "center",
                letterSpacing: "0",
                marginTop: "64px",
                minHeight: "86px",
                minWidth: "binding:buttonMinWidth",
                padding: "binding:buttonPadding",
                textAlign: "center",
              },
              responsiveStyles: {
                tablet: { fontSize: "21px", marginTop: "44px", minHeight: "72px" },
                mobile: { fontSize: "20px", marginTop: "34px", minHeight: "66px" },
              },
              children: [],
            },
          ],
        },
      ],
    },
    {
      nodeId: "consult-works-split-cta-001-right",
      type: "section",
      label: "Lado derecho",
      styles: {
        alignItems: "center",
        backgroundColor: "binding:rightPanelBackgroundColor",
        display: "flex",
        justifyContent: "center",
        minHeight: "binding:moduleMinHeight",
        padding: "binding:panelPadding",
        textAlign: "center",
        width: "100%",
      },
      responsiveStyles: {
        mobile: {
          minHeight: "520px",
          padding: "56px 20px",
        },
      },
      children: [
        {
          nodeId: "consult-works-split-cta-001-right-content",
          type: "section",
          label: "Contenido derecho",
          styles: {
            alignItems: "center",
            color: "binding:rightTextColor",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "1040px",
            width: "100%",
          },
          children: [
            {
              nodeId: "consult-works-split-cta-001-right-heading",
              type: "heading",
              label: "Titulo derecho",
              contentBinding: "rightHeadingText",
              props: { level: "2", text: "NEED TO EXPLORE OUR WORKS?" },
              styles: {
                color: "binding:rightTextColor",
                fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
                fontSize: "binding:headingFontSize",
                fontWeight: "800",
                letterSpacing: "0",
                lineHeight: "1.1",
                margin: "0",
                textAlign: "center",
              },
              responsiveStyles: {
                tablet: { fontSize: "38px" },
                mobile: { fontSize: "34px" },
              },
              children: [],
            },
            {
              nodeId: "consult-works-split-cta-001-right-body",
              type: "paragraph",
              label: "Texto derecho",
              contentBinding: "rightBodyText",
              props: {
                text: "There's nothing can hold me when I hold you. Feels so right it cant be wrong. Rockin' and rollin' all week long. A man is born he's a man come two they got nothing.",
              },
              styles: {
                color: "binding:rightTextColor",
                fontSize: "binding:bodyFontSize",
                fontWeight: "700",
                letterSpacing: "0",
                lineHeight: "1.45",
                margin: "0",
                marginTop: "64px",
                maxWidth: "1130px",
                textAlign: "center",
              },
              responsiveStyles: {
                tablet: { fontSize: "21px", marginTop: "42px" },
                mobile: { fontSize: "18px", marginTop: "30px" },
              },
              children: [],
            },
            {
              nodeId: "consult-works-split-cta-001-right-button",
              type: "button",
              label: "Boton derecho",
              contentBinding: "rightButtonText",
              interactions: {
                hover: {
                  styles: {
                    boxShadow: "0 18px 38px rgba(245, 162, 27, 0.28)",
                    transform: "translateY(-2px)",
                  },
                  transition: { durationMs: 160, easing: "emphasized" },
                },
              },
              props: {
                ariaLabel: "View works",
                href: "/works",
                text: "VIEW WORKS",
              },
              styles: {
                alignItems: "center",
                backgroundColor: "binding:rightButtonBackgroundColor",
                borderRadius: "binding:buttonRadius",
                color: "binding:rightButtonTextColor",
                display: "inline-flex",
                fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
                fontSize: "25px",
                fontWeight: "800",
                justifyContent: "center",
                letterSpacing: "0",
                marginTop: "64px",
                minHeight: "86px",
                minWidth: "binding:buttonMinWidth",
                padding: "binding:buttonPadding",
                textAlign: "center",
              },
              responsiveStyles: {
                tablet: { fontSize: "21px", marginTop: "44px", minHeight: "72px" },
                mobile: { fontSize: "20px", marginTop: "34px", minHeight: "66px" },
              },
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

function createBlankVisualModuleBlock(): CmsBlock {
  const block = createCmsBlockFromPreset("visual.module");
  const tree: CmsVisualNode = {
    nodeId: "root",
    type: "container",
    label: "Nuevo modulo",
    styles: {
      display: "block",
      minHeight: "240px",
      padding: "24px",
    },
    children: [],
  };

  return {
    ...block,
    props: {
      ...block.props,
      contentSchema: {},
      contentValues: {},
      name: "Nuevo modulo visual",
      schemaVersion: 1,
      surface: "page",
      tree,
    },
    children: [],
  };
}

function createSolHighSplitHeroTree(): CmsVisualNode {
  return {
    nodeId: "sol-high-split-hero-001",
    type: "container",
    label: "Sol High split hero",
    animation: {
      preset: "fadeIn",
      durationMs: 520,
      easing: "standard",
      trigger: "load",
    },
    styles: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      display: "grid",
      gap: "40px",
      gridTemplateColumns: "binding:columnRatio",
      margin: "binding:moduleMargin",
      maxWidth: "1280px",
      minHeight: "640px",
      overflow: "hidden",
      padding: "binding:modulePadding",
      width: "100%",
    },
    responsiveStyles: {
      tablet: {
        gap: "24px",
        minHeight: "560px",
        padding: "40px",
      },
      mobile: {
        gap: "32px",
        gridTemplateColumns: "1fr",
        minHeight: "0",
        padding: "24px",
      },
    },
    children: [
      {
        nodeId: "sol-high-split-hero-001-image-panel",
        type: "section",
        label: "Imagen left",
        styles: {
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          minHeight: "480px",
          overflow: "visible",
          position: "relative",
          width: "100%",
        },
        responsiveStyles: {
          tablet: { minHeight: "400px" },
          mobile: { minHeight: "280px" },
        },
        children: [
          {
            nodeId: "sol-high-split-hero-001-image",
            type: "image",
            label: "Imagen principal reemplazable",
            props: {
              alt: "Professional presenting digital services",
              src: "/storefront/cms/sol-high-hero.jpeg",
            },
            styles: {
              backgroundPosition: "center",
              backgroundSize: "contain",
              height: "560px",
              maxWidth: "560px",
              objectFit: "contain",
              width: "100%",
            },
            responsiveStyles: {
              tablet: {
                height: "400px",
              },
              mobile: {
                height: "300px",
                maxWidth: "420px",
              },
            },
            children: [],
          },
        ],
      },
      {
        nodeId: "sol-high-split-hero-001-copy-panel",
        type: "section",
        label: "Contenido right",
        styles: {
          alignItems: "flex-start",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: "620px",
          width: "100%",
        },
        responsiveStyles: {
          mobile: {
            alignItems: "center",
            maxWidth: "100%",
          },
        },
        children: [
          {
            nodeId: "sol-high-split-hero-001-eyebrow",
            type: "paragraph",
            label: "Eyebrow",
            contentBinding: "eyebrowText",
            props: { text: "Welcome To Techsouq" },
            styles: {
              border: "1px solid #6d5dfc",
              borderRadius: "999px",
              color: "binding:eyebrowColor",
              fontSize: "14px",
              fontWeight: "600",
              margin: "0",
              marginBottom: "20px",
              padding: "8px",
            },
            responsiveStyles: {
              mobile: { textAlign: "center" },
            },
            children: [],
          },
          {
            nodeId: "sol-high-split-hero-001-heading",
            type: "heading",
            label: "Heading",
            contentBinding: "headingText",
            props: { level: "1", text: "Transforming ideas into a" },
            styles: {
              color: "binding:headingColor",
              fontSize: "56px",
              fontWeight: "700",
              lineHeight: "1.08",
              margin: "0",
              maxWidth: "600px",
            },
            responsiveStyles: {
              tablet: { fontSize: "44px" },
              mobile: { fontSize: "38px", textAlign: "center" },
            },
            children: [],
          },
          {
            nodeId: "sol-high-split-hero-001-heading-accent",
            type: "heading",
            label: "Heading accent",
            contentBinding: "accentHeadingText",
            props: { level: "2", text: "Digital world" },
            styles: {
              color: "binding:accentHeadingColor",
              fontSize: "56px",
              fontWeight: "700",
              lineHeight: "1.08",
              margin: "0",
              maxWidth: "600px",
            },
            responsiveStyles: {
              tablet: { fontSize: "44px" },
              mobile: { fontSize: "38px", textAlign: "center" },
            },
            children: [],
          },
          {
            nodeId: "sol-high-split-hero-001-paragraph",
            type: "paragraph",
            label: "Paragraph",
            contentBinding: "paragraphText",
            props: {
              text: "Crafting intuitive designs that captivate and inspire. Building robust websites that elevate brands online.",
            },
            styles: {
              color: "binding:paragraphColor",
              fontSize: "17px",
              lineHeight: "1.65",
              margin: "0",
              marginTop: "24px",
              maxWidth: "580px",
            },
            responsiveStyles: {
              mobile: { textAlign: "center" },
            },
            children: [],
          },
          {
            nodeId: "sol-high-split-hero-001-actions",
            type: "flex",
            label: "Dos CTA",
            styles: {
              alignItems: "center",
              display: "flex",
              gap: "14px",
              marginTop: "32px",
            },
            responsiveStyles: {
              mobile: {
                alignItems: "stretch",
                flexDirection: "column",
                width: "100%",
              },
            },
            children: [
              {
                nodeId: "sol-high-split-hero-001-primary-cta",
                type: "button",
                label: "CTA primary",
                contentBinding: "primaryButtonText",
                interactions: {
                  hover: {
                    styles: {
                      backgroundColor: "#3f2bd8",
                      boxShadow: "0 20px 45px rgba(91, 69, 248, 0.28)",
                      transform: "translateY(-2px)",
                    },
                    transition: { durationMs: 180, easing: "emphasized" },
                  },
                },
                props: {
                  ariaLabel: "Book a consultation",
                  href: "/contact",
                  text: "Book a Consultation ->",
                },
                styles: {
                  alignItems: "center",
                  backgroundColor: "binding:primaryButtonBackgroundColor",
                  borderRadius: "8px",
                  boxShadow: "0 12px 28px rgba(91, 69, 248, 0.22)",
                  color: "binding:primaryButtonTextColor",
                  display: "inline-flex",
                  fontSize: "15px",
                  fontWeight: "700",
                  justifyContent: "center",
                  minHeight: "54px",
                  paddingLeft: "24px",
                  paddingRight: "24px",
                  textAlign: "center",
                },
                children: [],
              },
              {
                nodeId: "sol-high-split-hero-001-secondary-cta",
                type: "button",
                label: "CTA secondary",
                contentBinding: "secondaryButtonText",
                interactions: {
                  hover: {
                    styles: {
                      backgroundColor: "#f0edff",
                      boxShadow: "0 12px 28px rgba(91, 69, 248, 0.12)",
                      transform: "translateY(-2px)",
                    },
                    transition: { durationMs: 180, easing: "emphasized" },
                  },
                },
                props: {
                  ariaLabel: "Explore our work",
                  href: "/case-study",
                  text: "Explore Our Work",
                },
                styles: {
                  alignItems: "center",
                  backgroundColor: "binding:secondaryButtonBackgroundColor",
                  border: "1px solid #6d5dfc",
                  borderColor: "binding:secondaryButtonBorderColor",
                  borderRadius: "8px",
                  color: "binding:secondaryButtonTextColor",
                  display: "inline-flex",
                  fontSize: "15px",
                  fontWeight: "700",
                  justifyContent: "center",
                  minHeight: "54px",
                  paddingLeft: "24px",
                  paddingRight: "24px",
                  textAlign: "center",
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function createFourInfoSquaresTree(): CmsVisualNode {
  const cardDefaults = {
    alignItems: "flex-start",
    borderRadius: "0",
    color: "binding:cardTextColor",
    display: "flex",
    gap: "18px",
    margin: "binding:cardMargin",
    minHeight: "200px",
    padding: "32px 30px 28px",
    width: "100%",
  } satisfies CmsVisualNode["styles"];
  const iconDefaults = {
    color: "binding:cardTextColor",
    fontSize: "34px",
    fontWeight: "300",
    lineHeight: "1",
    minWidth: "52px",
    textAlign: "center",
    width: "52px",
  } satisfies CmsVisualNode["styles"];
  const titleDefaults = {
    color: "binding:cardTextColor",
    fontSize: "22px",
    fontWeight: "400",
    lineHeight: "1.1",
    margin: "0",
  } satisfies CmsVisualNode["styles"];
  const textDefaults = {
    color: "binding:cardTextColor",
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0",
  } satisfies CmsVisualNode["styles"];
  const cards = [
    { key: "card1", icon: "ED", label: "Education" },
    { key: "card2", icon: "$", label: "Donation" },
    { key: "card3", icon: "25", label: "Projects" },
    { key: "card4", icon: "*", label: "Volunteer" },
  ];

  return {
    nodeId: "four-info-squares-001",
    type: "container",
    label: "FourInfoSquares",
    styles: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      display: "flex",
      flexDirection: "column",
      margin: "binding:moduleMargin",
      padding: "72px 24px 118px",
      width: "100%",
    },
    responsiveStyles: {
      mobile: {
        padding: "48px 18px 72px",
      },
    },
    children: [
      {
        nodeId: "four-info-squares-001-heading",
        type: "heading",
        label: "Titulo",
        contentBinding: "headingText",
        props: { level: "2", text: "HOW CAN YOU HELP?" },
        styles: {
          color: "#333333",
          fontSize: "30px",
          fontWeight: "400",
          lineHeight: "1.2",
          margin: "0",
          textAlign: "center",
        },
        responsiveStyles: {
          mobile: { fontSize: "26px" },
        },
        children: [],
      },
      {
        nodeId: "four-info-squares-001-intro",
        type: "paragraph",
        label: "Texto",
        contentBinding: "introText",
        props: {
          text: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        },
        styles: {
          color: "#4f4f4f",
          fontSize: "16px",
          lineHeight: "1.5",
          margin: "0",
          marginTop: "18px",
          maxWidth: "940px",
          textAlign: "center",
        },
        children: [],
      },
      {
        nodeId: "four-info-squares-001-grid",
        type: "grid",
        label: "Cuadros",
        styles: {
          display: "grid",
          gap: "0",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          marginTop: "42px",
          maxWidth: "1220px",
          width: "100%",
        },
        responsiveStyles: {
          tablet: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
          mobile: { gridTemplateColumns: "1fr", marginTop: "32px" },
        },
        children: cards.map((card) => ({
          nodeId: `four-info-squares-001-${card.key}`,
          type: "section",
          label: card.label,
          styles: {
            ...cardDefaults,
            backgroundColor: `binding:${card.key}BackgroundColor`,
          },
          responsiveStyles: {
            mobile: { minHeight: "0", padding: "28px 24px" },
          },
          children: [
            {
              nodeId: `four-info-squares-001-${card.key}-icon`,
              type: "icon",
              label: `${card.label} icon`,
              props: { text: card.icon },
              styles: iconDefaults,
              children: [],
            },
            {
              nodeId: `four-info-squares-001-${card.key}-content`,
              type: "flex",
              label: `${card.label} content`,
              styles: {
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                width: "100%",
              },
              children: [
                {
                  nodeId: `four-info-squares-001-${card.key}-title`,
                  type: "heading",
                  label: `${card.label} titulo`,
                  contentBinding: `${card.key}Title`,
                  props: { level: "3", text: card.label.toUpperCase() },
                  styles: titleDefaults,
                  children: [],
                },
                {
                  nodeId: `four-info-squares-001-${card.key}-text`,
                  type: "paragraph",
                  label: `${card.label} texto`,
                  contentBinding: `${card.key}Text`,
                  props: {
                    text: "Sed do eiusmod tempor incididuntlabore dolore magna aliqua. Ut enim minim veniam, nostrud exercitation.",
                  },
                  styles: textDefaults,
                  children: [],
                },
              ],
            },
          ],
        })),
      },
    ],
  };
}

function createCmsVisualModuleReferenceBlock(definition: CmsVisualModuleDefinition): CmsBlock {
  const block = createCmsBlockFromPreset("visual.module");
  return {
    ...block,
    blockId: `${definition.definitionId}-ref-${Date.now().toString(36)}`,
    props: {
      ...block.props,
      ...definition.module,
      contentValues: definition.module.contentValues ?? {},
      definitionId: definition.definitionId,
      definitionRevision: definition.revision,
      name: definition.name,
      surface: "page",
      visualDefinitionReference: true,
    },
    children: [],
  };
}

function createSystemVisualModulePresets(): CmsVisualModulePreset[] {
  const moduleProps = normalizeCmsVisualModuleProps(createCmsBlockFromPreset("visual.module").props);
  const timestamp = "2026-07-28T00:00:00.000Z";
  return [
    {
      contentSchema: moduleProps.contentSchema,
      contentValues: moduleProps.contentValues,
      createdAt: timestamp,
      definitionId: "system-heroModule-prototype-images-001",
      moduleId: moduleProps.tree.nodeId,
      name: "Hero prototype images",
      presetId: "system-heroModule-prototype-images-001",
      revision: 1,
      schemaMinorVersion: 0,
      schemaVersion: 2,
      source: "system",
      status: "ACTIVE",
      tree: moduleProps.tree,
      updatedAt: timestamp,
      version: 1,
    },
    {
      contentSchema: {
        accentHeadingColor: { type: "color", required: false, label: "Color heading destacado" },
        accentHeadingText: { type: "text", required: true, label: "Heading destacado" },
        columnRatio: { type: "number", required: true, label: "Proporcion imagen left / contenido right" },
        eyebrowColor: { type: "color", required: false, label: "Color eyebrow" },
        eyebrowText: { type: "text", required: false, label: "Eyebrow" },
        headingColor: { type: "color", required: false, label: "Color heading" },
        headingText: { type: "text", required: true, label: "Heading" },
        moduleMargin: { type: "text", required: false, label: "Margin modulo" },
        modulePadding: { type: "text", required: false, label: "Padding modulo" },
        paragraphColor: { type: "color", required: false, label: "Color parrafo" },
        paragraphText: { type: "richText", required: true, label: "Texto de parrafo" },
        primaryButtonBackgroundColor: { type: "color", required: false, label: "Fondo CTA primary" },
        primaryButtonText: { type: "text", required: true, label: "Texto CTA primary" },
        primaryButtonTextColor: { type: "color", required: false, label: "Color texto CTA primary" },
        secondaryButtonBackgroundColor: { type: "color", required: false, label: "Fondo CTA secondary" },
        secondaryButtonBorderColor: { type: "color", required: false, label: "Borde CTA secondary" },
        secondaryButtonText: { type: "text", required: true, label: "Texto CTA secondary" },
        secondaryButtonTextColor: { type: "color", required: false, label: "Color texto CTA secondary" },
      },
      contentValues: {
        accentHeadingColor: "#5b45f8",
        accentHeadingText: "Digital world",
        columnRatio: 45,
        eyebrowColor: "#5b45f8",
        eyebrowText: "Welcome To Techsouq",
        headingColor: "#111111",
        headingText: "Transforming ideas into a",
        moduleMargin: "0 auto",
        modulePadding: "64px",
        paragraphColor: "#4b5563",
        paragraphText: "Crafting intuitive designs that captivate and inspire. Building robust websites that elevate brands online.",
        primaryButtonBackgroundColor: "#5b45f8",
        primaryButtonText: "Book a Consultation ->",
        primaryButtonTextColor: "#ffffff",
        secondaryButtonBackgroundColor: "#ffffff",
        secondaryButtonBorderColor: "#6d5dfc",
        secondaryButtonText: "Explore Our Work",
        secondaryButtonTextColor: "#5b45f8",
      },
      createdAt: timestamp,
      definitionId: "system-sol-high-split-hero-001",
      moduleId: "sol-high-split-hero-001",
      name: "Sol High split hero",
      presetId: "system-sol-high-split-hero-001",
      revision: 1,
      schemaMinorVersion: 0,
      schemaVersion: 2,
      source: "system",
      status: "ACTIVE",
      tree: createSolHighSplitHeroTree(),
      updatedAt: timestamp,
      version: 1,
    },
    {
      contentSchema: consultWorksSplitCtaContentSchema,
      contentValues: consultWorksSplitCtaContentValues,
      createdAt: timestamp,
      definitionId: "system-consult-works-split-cta-001",
      moduleId: "consult-works-split-cta-001",
      name: "Consult works split CTA",
      presetId: "system-consult-works-split-cta-001",
      revision: 1,
      schemaMinorVersion: 0,
      schemaVersion: 2,
      source: "system",
      status: "ACTIVE",
      tree: consultWorksSplitCtaTree,
      updatedAt: timestamp,
      version: 1,
    },
    {
      contentSchema: {
        card1BackgroundColor: { type: "color", required: false, label: "Fondo cuadro 1" },
        card1Text: { type: "richText", required: true, label: "Texto cuadro 1" },
        card1Title: { type: "text", required: true, label: "Titulo cuadro 1" },
        card2BackgroundColor: { type: "color", required: false, label: "Fondo cuadro 2" },
        card2Text: { type: "richText", required: true, label: "Texto cuadro 2" },
        card2Title: { type: "text", required: true, label: "Titulo cuadro 2" },
        card3BackgroundColor: { type: "color", required: false, label: "Fondo cuadro 3" },
        card3Text: { type: "richText", required: true, label: "Texto cuadro 3" },
        card3Title: { type: "text", required: true, label: "Titulo cuadro 3" },
        card4BackgroundColor: { type: "color", required: false, label: "Fondo cuadro 4" },
        card4Text: { type: "richText", required: true, label: "Texto cuadro 4" },
        card4Title: { type: "text", required: true, label: "Titulo cuadro 4" },
        cardMargin: { type: "text", required: false, label: "Margin compartido cuadros" },
        cardTextColor: { type: "color", required: false, label: "Color texto cuadros" },
        headingText: { type: "text", required: true, label: "Titulo principal" },
        introText: { type: "richText", required: true, label: "Texto principal" },
        moduleMargin: { type: "text", required: false, label: "Margin modulo" },
      },
      contentValues: {
        card1BackgroundColor: "#3ccb83",
        card1Text: "Sed do eiusmod tempor incididuntlabore dolore magna aliqua. Ut enim minim veniam, nostrud exercitation.",
        card1Title: "EDUCATION",
        card2BackgroundColor: "#22aee8",
        card2Text: "Sed do eiusmod tempor incididuntlabore dolore magna aliqua. Ut enim minim veniam, nostrud exercitation.",
        card2Title: "DONATION",
        card3BackgroundColor: "#ed1e68",
        card3Text: "Sed do eiusmod tempor incididuntlabore dolore magna aliqua. Ut enim minim veniam, nostrud exercitation.",
        card3Title: "PROJECTS",
        card4BackgroundColor: "#ff5a2e",
        card4Text: "Sed do eiusmod tempor incididuntlabore dolore magna aliqua. Ut enim minim veniam, nostrud exercitation.",
        card4Title: "VOLUNTEER",
        cardMargin: "0 15px",
        cardTextColor: "#ffffff",
        headingText: "HOW CAN YOU HELP?",
        introText: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        moduleMargin: "0 auto",
      },
      createdAt: timestamp,
      definitionId: "system-four-info-squares-001",
      moduleId: "four-info-squares-001",
      name: "FourInfoSquares",
      presetId: "system-four-info-squares-001",
      revision: 1,
      schemaMinorVersion: 0,
      schemaVersion: 2,
      source: "system",
      status: "ACTIVE",
      tree: createFourInfoSquaresTree(),
      updatedAt: timestamp,
      version: 1,
    },
  ];
}

const systemVisualModulePresets = createSystemVisualModulePresets();

function blockTitle(block: CmsBlock) {
  if (block.type === "visual.module") {
    return normalizeCmsVisualModuleProps(block.props).name || "Modulo visual";
  }
  return getCmsBlockDefinitions().find((definition) => definition.type === block.type)?.label ?? block.type;
}

function blockEditorFieldValue(block: CmsBlock, key: string) {
  if (block.type === "visual.module") {
    const moduleProps = normalizeCmsVisualModuleProps(block.props);
    if (key === "tree") return moduleProps.tree;
    if (key === "name") return moduleProps.name;
  }
  return block.props[key];
}

function blockSurfaceLabel(block: CmsBlock) {
  const surface = getCmsBlockSurface(block);
  if (surface === "plp") {
    return getCmsBlockPlacement(block) === "afterList" ? "PLP despues" : "PLP antes";
  }
  return "Pagina";
}

function visualStyleTargetForNode(node: CmsVisualNode): CmsVisualStyleTarget {
  if (node.nodeId === "root") return "module";
  return visualContainerNodeTypes.includes(node.type) ? "panel" : "element";
}

function visualStylePropertyVisible(field: CmsVisualStylePropertyDefinition, node: CmsVisualNode, scopedStyles: CmsVisualNodeStyle | undefined) {
  const target = visualStyleTargetForNode(node);
  if (!field.appliesTo.includes(target)) return false;
  if (!field.visibleWhen) return true;
  const typeMatches = field.visibleWhen.nodeTypes?.includes(node.type) ?? false;
  const valueMatches = field.visibleWhen.property && field.visibleWhen.values
    ? field.visibleWhen.values.includes(scopedStyles?.[field.visibleWhen.property] ?? "")
    : false;
  if (field.visibleWhen.property && field.visibleWhen.nodeTypes) return typeMatches || valueMatches;
  if (field.visibleWhen.property) return valueMatches;
  if (field.visibleWhen.nodeTypes) return typeMatches;
  return true;
}

function isVisualStyleValueSafe(key: keyof CmsVisualNodeStyle, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (key === "backgroundImage") return /^asset:[a-z0-9][a-z0-9._:-]*$/i.test(trimmed);
  return !/(url\s*\(|javascript:|expression\s*\(|@import|<\/?[a-z]|[{};])/i.test(trimmed);
}

function isSafeVisualContentText(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length <= 6000 &&
    !/[\u0000-\u001f\u007f]/.test(trimmed) &&
    !/(javascript:|expression\s*\(|@import|<\/?script|<\/?style)/i.test(trimmed)
  );
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

function visualPropsForSave(props: Record<string, unknown> | undefined) {
  if (!props) return props;
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === "string" ? visualContentTextForSave(value) : value,
    ]),
  );
}

function visualElementsForSave(elements: CmsVisualElement[] | undefined): CmsVisualElement[] | undefined {
  return elements?.map((element) => ({
    ...element,
    props: visualPropsForSave(element.props),
    children: visualElementsForSave(element.children),
    elements: visualElementsForSave(element.elements),
  }));
}

function visualPanelsForSave(panels: CmsVisualPanel[] | undefined): CmsVisualPanel[] {
  return (panels ?? []).map((panel) => ({
    ...panel,
    props: visualPropsForSave(panel.props),
    elements: visualElementsForSave(panel.elements),
    panels: visualPanelsForSave(panel.panels),
  }));
}

function visualModulePropsForSave(moduleProps: CmsVisualModuleV2Props): CmsVisualModuleV2Props {
  return {
    ...moduleProps,
    contentValues: visualContentValuesForSave(recordValue(moduleProps.contentValues)),
    elements: visualElementsForSave(moduleProps.elements),
    panels: visualPanelsForSave(moduleProps.panels),
  };
}

function normalizeVisualStyleJsonObject(value: unknown): CmsVisualNodeStyle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const styles: CmsVisualNodeStyle = {};
  const knownKeys = new Set<string>(visualStylePropertyKeys);
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = visualStylePropertyRegistry.find((field) => field.key === rawKey || field.cssProperty === rawKey)?.key;
    if (!key || !knownKeys.has(key)) return null;
    if (typeof rawValue !== "string") return null;
    if (!isVisualStyleValueSafe(key, rawValue)) return null;
    if (rawValue.trim()) styles[key] = rawValue;
  }
  return styles;
}

function visualHoverStyleJsonCandidate(value: unknown): unknown {
  const record = recordValue(value);
  const hoverRecord = recordValue(record.hover);
  if (hoverRecord.styles) return hoverRecord.styles;
  if (record.styles) return record.styles;
  return value;
}

function normalizeVisualHoverStyleJsonObject(value: unknown): {
  error: string | null;
  styles: Partial<Record<CmsVisualHoverStyleKey, string>>;
} {
  const candidate = visualHoverStyleJsonCandidate(value);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { error: "Hover debe ser un objeto JSON de estilos.", styles: {} };
  }
  const styles: Partial<Record<CmsVisualHoverStyleKey, string>> = {};
  for (const [rawKey, rawValue] of Object.entries(candidate)) {
    const key = visualStylePropertyRegistry.find((field) => field.key === rawKey || field.cssProperty === rawKey)?.key;
    if (!key || !cmsVisualHoverStyleKeys.includes(key as CmsVisualHoverStyleKey)) {
      return { error: `${rawKey} no es una key hover permitida.`, styles: {} };
    }
    if (typeof rawValue !== "string") {
      return { error: `${rawKey} debe ser texto CSS.`, styles: {} };
    }
    if (!isVisualStyleValueSafe(key, rawValue)) {
      return { error: `${rawKey} contiene CSS no permitido.`, styles: {} };
    }
    if (rawValue.trim()) {
      styles[key as CmsVisualHoverStyleKey] = rawValue.trim();
    }
  }
  return { error: null, styles };
}

function visualBuilderAssetPreviewUrl(mediaAssetId: string | undefined) {
  return mediaAssetId
    ? `/api/admin/media-assets/${encodeURIComponent(mediaAssetId)}/content?variant=large_default`
    : undefined;
}

function visualBuilderAssetKey(seed: string) {
  const normalizedSeed = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalizedSeed || `asset-${Date.now().toString(36)}`;
}

function visualAssetRefForValue(value: string | undefined, assetRefs: CmsVisualAssetRef[]) {
  const assetKey = value?.startsWith("asset:") ? value.slice("asset:".length) : "";
  return assetKey ? assetRefs.find((asset) => asset.assetKey === assetKey) : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function visualContentFieldTypeForNode(node: CmsVisualNode): CmsVisualContentField["type"] {
  if (node.contentBinding?.toLowerCase().includes("color")) return "color";
  if (node.type === "richText" || node.type === "htmlEmbed") return "richText";
  if (node.type === "button" || node.type === "link") return "text";
  if (node.type === "image" || node.type === "video") return "media";
  return "text";
}

function visualContentFieldTypeForStyle(key: keyof CmsVisualNodeStyle, bindingKey: string): CmsVisualContentField["type"] {
  if (bindingKey.toLowerCase().includes("color") || key.toLowerCase().includes("color")) return "color";
  if (key === "backgroundImage") return "media";
  if (key === "gridTemplateColumns") return "number";
  return "text";
}

function visualStyleBindingsForNode(node: CmsVisualNode): Array<{ field: CmsVisualContentField; key: string; nodeId: string }> {
  const scopedStyles = [
    node.styles,
    node.responsiveStyles?.desktop,
    node.responsiveStyles?.tablet,
    node.responsiveStyles?.mobile,
  ];
  const current = scopedStyles.flatMap((styles) =>
    Object.entries(styles ?? {}).flatMap(([rawKey, rawValue]) => {
      if (typeof rawValue !== "string" || !rawValue.startsWith("binding:")) return [];
      const key = rawValue.slice("binding:".length).trim();
      if (!key) return [];
      return [{
        key,
        nodeId: node.nodeId,
        field: {
          type: visualContentFieldTypeForStyle(rawKey as keyof CmsVisualNodeStyle, key),
          required: false,
          label: key,
        } satisfies CmsVisualContentField,
      }];
    }),
  );
  return current;
}

function visualContentBindings(node: CmsVisualNode): Array<{ field: CmsVisualContentField; key: string; nodeId: string }> {
  const current = node.contentBinding?.trim()
    ? [{
        key: node.contentBinding.trim(),
        nodeId: node.nodeId,
        field: {
          type: visualContentFieldTypeForNode(node),
          required: false,
          label: node.label ?? node.contentBinding.trim(),
        } satisfies CmsVisualContentField,
      }]
    : [];
  return [
    ...current,
    ...visualStyleBindingsForNode(node),
    ...(node.children ?? []).flatMap((child) => visualContentBindings(child)),
  ];
}

function inferredVisualContentSchema(tree: CmsVisualNode, currentSchema: CmsVisualContentSchema): CmsVisualContentSchema {
  const nextSchema: CmsVisualContentSchema = { ...currentSchema };
  for (const binding of visualContentBindings(tree)) {
    nextSchema[binding.key] = {
      ...binding.field,
      ...(nextSchema[binding.key] ?? {}),
      label: nextSchema[binding.key]?.label ?? binding.field.label,
    };
  }
  return nextSchema;
}

function visualContentValues(block: CmsBlock) {
  return recordValue(block.props.contentValues);
}

function upsertVisualBlockAssetRef(block: CmsBlock, assetRef: CmsVisualAssetRef): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  const assetRefs = [
    assetRef,
    ...(moduleProps.assetRefs ?? []).filter((asset) => asset.assetKey !== assetRef.assetKey),
  ];
  return {
    ...block,
    props: {
      ...block.props,
      ...moduleProps,
      assetRefs,
    },
  };
}

function removeVisualBlockAssetRef(block: CmsBlock, assetKey: string): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  const assetRefs = (moduleProps.assetRefs ?? []).filter((asset) => asset.assetKey !== assetKey);
  return {
    ...block,
    props: {
      ...block.props,
      ...moduleProps,
      ...(assetRefs.length ? { assetRefs } : { assetRefs: undefined }),
    },
  };
}

function issueBlockLabel(block: CmsBlock, index: number) {
  return `${index + 1}. ${blockTitle(block)}`;
}

function nextSelectedBlockId(blocks: CmsBlock[]) {
  return blocks[blocks.length - 1]?.blockId ?? null;
}

function createInitialBlocks(blocks: CmsBlock[]): CmsBlock[] {
  if (blocks.length > 0) {
    return blocks;
  }

  return [{
    ...createCmsBlockFromPreset("banner.hero"),
    blockId: "cms-builder-empty-banner-hero",
  }];
}

const builderHistoryLimit = 40;
const cmsVisualModuleV2RolloutModes = ["disabled", "beta", "default"] as const;
type CmsVisualModuleV2RolloutMode = (typeof cmsVisualModuleV2RolloutModes)[number];

function cmsVisualModuleV2RolloutMode(): CmsVisualModuleV2RolloutMode {
  const rawMode = process.env.NEXT_PUBLIC_ECOMMIUM_CMS_VISUAL_MODULE_V2_ROLLOUT?.trim().toLowerCase();
  return cmsVisualModuleV2RolloutModes.includes(rawMode as CmsVisualModuleV2RolloutMode)
    ? rawMode as CmsVisualModuleV2RolloutMode
    : "beta";
}

function visualModuleBlockForRollout(block: CmsBlock, rolloutMode: CmsVisualModuleV2RolloutMode): CmsBlock {
  if (block.type !== "visual.module" || rolloutMode === "disabled") {
    return block;
  }
  const visualModule = migrateCmsVisualModuleV1ToV2ForRenderer(block.props);
  return {
    ...block,
    props: {
      surface: block.props.surface,
      placement: block.props.placement,
      ...visualModule,
    },
  };
}

function createInitialBuilderState(blocks: CmsBlock[]): CmsBlockBuilderState {
  const initialBlocksValue = createInitialBlocks(blocks);
  const selectedBlockId = nextSelectedBlockId(initialBlocksValue);
  const selectedBlock = initialBlocksValue.find((block) => block.blockId === selectedBlockId);
  return {
    blocks: initialBlocksValue,
    exportMessage: null,
    history: { future: [], past: [] },
    importDraft: "",
    importMessage: null,
    mediaUploads: [],
    selectedBlockId,
    selectedVisualNodeId: selectedBlock?.type === "visual.module" ? "root" : null,
    surface: initialBlocksValue.some((block) => getCmsBlockSurface(block) !== "plp") ? "page" : "plp",
    validationIssues: [],
    viewport: "desktop",
    visualImportDraft: "",
    visualModulePresets: mergeVisualModulePresets([]),
    visualPortabilityMessage: null,
    visualPresetMessage: null,
    visualPresetName: "",
    visualStyleScope: "base",
  };
}

function blocksHistoryKey(blocks: CmsBlock[]) {
  return JSON.stringify(blocks);
}

function validationIssuesKey(issues: CmsBlockBuilderValidationIssue[]) {
  return issues.map((issue) => `${issue.severity}|${issue.blockId ?? "canvas"}|${issue.message}`).join("\n");
}

function selectedBlockFromBlocks(blocks: CmsBlock[], selectedBlockId: string | null) {
  return blocks.find((block) => block.blockId === selectedBlockId) ?? blocks[0] ?? null;
}

function selectedVisualNodeIdForBlock(block: CmsBlock | null, requestedNodeId: string | null | undefined) {
  if (block?.type !== "visual.module") return null;
  if (!requestedNodeId) return "root";
  const tree = normalizeCmsVisualModuleProps(block.props).tree;
  return findVisualNode(tree, requestedNodeId)?.nodeId ?? tree.nodeId;
}

function nextBuilderStateWithBlocks(
  state: CmsBlockBuilderState,
  blocks: CmsBlock[],
  options: Pick<Extract<CmsBlockBuilderAction, { type: "applyBlocks" }>, "selectedBlockId" | "selectedVisualNodeId" | "surface">,
) {
  if (blocksHistoryKey(blocks) === blocksHistoryKey(state.blocks)) {
    return state;
  }
  const selectedBlockId = options.selectedBlockId === undefined
    ? state.selectedBlockId
    : options.selectedBlockId;
  const selectedBlock = selectedBlockFromBlocks(blocks, selectedBlockId);
  const safeSelectedBlockId = selectedBlock?.blockId ?? nextSelectedBlockId(blocks);
  const safeSelectedBlock = selectedBlockFromBlocks(blocks, safeSelectedBlockId);

  return {
    ...state,
    blocks,
    selectedBlockId: safeSelectedBlockId,
    selectedVisualNodeId: selectedVisualNodeIdForBlock(safeSelectedBlock, options.selectedVisualNodeId ?? state.selectedVisualNodeId),
    surface: options.surface ?? state.surface,
    history: {
      past: [...state.history.past.slice(-(builderHistoryLimit - 1)), state.blocks],
      future: [],
    },
  };
}

function cmsBlockBuilderReducer(state: CmsBlockBuilderState, action: CmsBlockBuilderAction): CmsBlockBuilderState {
  switch (action.type) {
    case "applyBlocks":
      return nextBuilderStateWithBlocks(state, action.blocks, action);
    case "mutateBlocks":
      return nextBuilderStateWithBlocks(state, action.mutate(state.blocks), action);
    case "redo": {
      const [nextBlocks, ...future] = state.history.future;
      if (!nextBlocks) return state;
      const selectedBlock = selectedBlockFromBlocks(nextBlocks, state.selectedBlockId);
      return {
        ...state,
        blocks: nextBlocks,
        selectedBlockId: selectedBlock?.blockId ?? nextSelectedBlockId(nextBlocks),
        selectedVisualNodeId: selectedVisualNodeIdForBlock(selectedBlock, state.selectedVisualNodeId),
        history: {
          past: [...state.history.past.slice(-(builderHistoryLimit - 1)), state.blocks],
          future,
        },
      };
    }
    case "selectBlock": {
      const selectedBlock = selectedBlockFromBlocks(state.blocks, action.blockId);
      return {
        ...state,
        selectedBlockId: selectedBlock?.blockId ?? null,
        selectedVisualNodeId: selectedVisualNodeIdForBlock(selectedBlock, state.selectedVisualNodeId),
      };
    }
    case "selectVisualNode":
      return { ...state, selectedVisualNodeId: action.nodeId };
    case "setExportMessage":
      return { ...state, exportMessage: action.message };
    case "setImportDraft":
      return { ...state, importDraft: action.draft };
    case "setImportMessage":
      return { ...state, importMessage: action.message };
    case "setMediaUpload":
      return {
        ...state,
        mediaUploads: [
          action.upload,
          ...state.mediaUploads.filter((upload) => upload.assetKey !== action.upload.assetKey),
        ].slice(0, 12),
      };
    case "setSurface":
      return { ...state, surface: action.surface };
    case "setValidationIssues":
      return validationIssuesKey(state.validationIssues) === validationIssuesKey(action.issues)
        ? state
        : { ...state, validationIssues: action.issues };
    case "setViewport":
      return { ...state, viewport: action.viewport };
    case "setVisualImportDraft":
      return { ...state, visualImportDraft: action.draft };
    case "setVisualModulePresets":
      return { ...state, visualModulePresets: action.presets };
    case "setVisualPortabilityMessage":
      return { ...state, visualPortabilityMessage: action.message };
    case "setVisualPresetMessage":
      return { ...state, visualPresetMessage: action.message };
    case "setVisualPresetName":
      return { ...state, visualPresetName: action.name };
    case "setVisualStyleScope":
      return { ...state, visualStyleScope: action.scope };
    case "undo": {
      const previousBlocks = state.history.past.at(-1);
      if (!previousBlocks) return state;
      const selectedBlock = selectedBlockFromBlocks(previousBlocks, state.selectedBlockId);
      return {
        ...state,
        blocks: previousBlocks,
        selectedBlockId: selectedBlock?.blockId ?? nextSelectedBlockId(previousBlocks),
        selectedVisualNodeId: selectedVisualNodeIdForBlock(selectedBlock, state.selectedVisualNodeId),
        history: {
          past: state.history.past.slice(0, -1),
          future: [state.blocks, ...state.history.future].slice(0, builderHistoryLimit),
        },
      };
    }
    default:
      return state;
  }
}

function normalizeVisualModulePreset(value: unknown): CmsVisualModulePreset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const presetId = typeof record.presetId === "string" && record.presetId ? record.presetId : makeVisualModulePresetId();
  const definitionId = typeof record.definitionId === "string" && record.definitionId.trim() ? record.definitionId.trim() : presetId;
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Modulo visual";
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : createdAt;
  const version = typeof record.version === "number" && Number.isFinite(record.version) && record.version > 0
    ? Math.floor(record.version)
    : 1;
  const revision = typeof record.revision === "number" && Number.isFinite(record.revision) && record.revision > 0
    ? Math.floor(record.revision)
    : version;
  const schemaMinorVersion = typeof record.schemaMinorVersion === "number" && Number.isFinite(record.schemaMinorVersion) && record.schemaMinorVersion >= 0
    ? Math.floor(record.schemaMinorVersion)
    : 0;
  const status = record.status === "DRAFT" || record.status === "ARCHIVED" ? record.status : "ACTIVE";
  const tree = normalizeCmsVisualNode(record.tree);
  const moduleId = typeof record.moduleId === "string" && record.moduleId.trim() ? record.moduleId.trim() : tree.nodeId;
  const contentSchema = normalizeVisualContentSchemaDraft(record.contentSchema);
  const contentValues = recordValue(record.contentValues);
  const assetRefs = normalizeCmsVisualModuleProps({
    assetRefs: record.assetRefs,
    schemaVersion: 1,
    tree,
  }).assetRefs;

  return {
    assetRefs,
    contentSchema,
    contentValues,
    createdAt,
    definitionId,
    moduleId,
    name,
    presetId,
    revision,
    schemaMinorVersion,
    schemaVersion: 2,
    source: "local",
    status,
    tree,
    updatedAt,
    version,
  };
}

function localVisualModulePresets(presets: CmsVisualModulePreset[]) {
  return presets.filter((preset) => preset.source !== "system");
}

function visualModulePresetDisplayName(preset: Pick<CmsVisualModulePreset, "name" | "version">) {
  return new RegExp(`\\s+v${preset.version}$`, "i").test(preset.name)
    ? preset.name
    : `${preset.name} v${preset.version}`;
}

function visualModulePresetBaseName(name: string) {
  return name.replace(/\s+v\d+$/i, "");
}

function mergeVisualModulePresets(localPresets: CmsVisualModulePreset[]) {
  const systemPresetIds = new Set(systemVisualModulePresets.map((preset) => preset.presetId));
  return [
    ...systemVisualModulePresets,
    ...localPresets.filter((preset) => !systemPresetIds.has(preset.presetId)),
  ];
}

function visualModulePresetsFromJson(value: string | null): CmsVisualModulePreset[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.map(normalizeVisualModulePreset).filter((preset): preset is CmsVisualModulePreset => Boolean(preset))
      : [];
  } catch {
    return [];
  }
}

function visualModulePresetsToJson(presets: CmsVisualModulePreset[]) {
  return JSON.stringify(localVisualModulePresets(presets), null, 2);
}

function textProp(block: CmsBlock, key: string, fallback = "") {
  const value = block.props[key];
  return typeof value === "string" ? value : fallback;
}

function boolProp(block: CmsBlock, key: string) {
  return block.props[key] === true;
}

function blockPlacement(block: CmsBlock, resolvedCanvas: CmsBlockBuilderResolvedCanvas | null): CmsModulePlacement | undefined {
  if (block.placement) return block.placement as CmsModulePlacement;
  return resolvedCanvas?.modules.find((module) => module.blockId === block.blockId)?.placement;
}

function sameModuleSlot(
  left: Pick<CmsModulePlacement, "region" | "areaId" | "columnIndex">,
  right: Pick<CmsModulePlacement, "region" | "areaId" | "columnIndex">,
) {
  return left.region === right.region && left.areaId === right.areaId && left.columnIndex === right.columnIndex;
}

function moduleSlotKey(value: Pick<CmsModulePlacement, "region" | "areaId" | "columnIndex">) {
  return `${value.region}|${value.areaId}|${value.columnIndex}`;
}

function resolvedModuleSlots(resolvedCanvas: CmsBlockBuilderResolvedCanvas | null): CmsModuleSlot[] {
  if (!resolvedCanvas) return [];
  return cmsRegionCodes.flatMap((region) =>
    (resolvedCanvas.layout.regions[region]?.areas ?? []).flatMap((area) =>
      area.columnSlots.map((slot) => ({
        ...slot,
        region,
        areaId: area.areaId,
      })),
    ),
  );
}

function firstModuleSlot(slots: CmsModuleSlot[]) {
  return slots.find((slot) => slot.region === "main") ?? slots[0];
}

function defaultModulePlacement(resolvedCanvas: CmsBlockBuilderResolvedCanvas | null, order = 1): CmsBlockModulePlacement | undefined {
  const slot = firstModuleSlot(resolvedModuleSlots(resolvedCanvas));
  if (!slot) return undefined;
  return {
    region: slot.region,
    areaId: slot.areaId,
    columnIndex: slot.columnIndex,
    order,
    width: "100%",
    align: "stretch",
    spacing: {},
    visibility: { mobile: true, tablet: true, desktop: true },
    containerMode: "inherit",
  };
}

function withPagePlacementDefaults(block: CmsBlock, resolvedCanvas: CmsBlockBuilderResolvedCanvas | null, order: number): CmsBlock {
  if (getCmsBlockSurface(block) === "plp") return block;
  const placement = block.placement ?? defaultModulePlacement(resolvedCanvas, order);
  return {
    ...block,
    ...(placement ? { placement } : {}),
    props: {
      ...block.props,
      surface: "page",
      placement: "main",
    },
  };
}

function completePlacement(
  block: CmsBlock,
  resolvedCanvas: CmsBlockBuilderResolvedCanvas | null,
  order: number,
): CmsBlockModulePlacement | undefined {
  const placement = blockPlacement(block, resolvedCanvas) ?? defaultModulePlacement(resolvedCanvas, order);
  if (!placement) return undefined;
  return {
    region: placement.region,
    areaId: placement.areaId,
    columnIndex: placement.columnIndex,
    order: placement.order ?? order,
    width: placement.width ?? "100%",
    align: placement.align ?? "stretch",
    spacing: placement.spacing ?? {},
    visibility: placement.visibility ?? { mobile: true, tablet: true, desktop: true },
    containerMode: placement.containerMode ?? "inherit",
  };
}

function blocksForColumn(
  blocks: CmsBlock[],
  resolvedCanvas: CmsBlockBuilderResolvedCanvas | null,
  region: CmsRegionCode,
  areaId: string,
  columnIndex: number,
) {
  return blocks
    .filter((block) => {
      const placement = blockPlacement(block, resolvedCanvas);
      return placement?.region === region && placement.areaId === areaId && placement.columnIndex === columnIndex;
    })
    .sort((left, right) => (blockPlacement(left, resolvedCanvas)?.order ?? 0) - (blockPlacement(right, resolvedCanvas)?.order ?? 0));
}

function unplacedBlocks(blocks: CmsBlock[], resolvedCanvas: CmsBlockBuilderResolvedCanvas | null) {
  if (!resolvedCanvas) return [];
  const slotKeys = new Set(cmsRegionCodes.flatMap((region) =>
    (resolvedCanvas.layout.regions[region]?.areas ?? []).flatMap((area) =>
      area.columnSlots.map((slot) => `${region}|${area.areaId}|${slot.columnIndex}`),
    ),
  ));

  return blocks.filter((block) => {
    const placement = blockPlacement(block, resolvedCanvas);
    if (!placement) return true;
    return !slotKeys.has(`${placement.region}|${placement.areaId}|${placement.columnIndex}`);
  });
}

function propHasValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

function visualNodeIds(node: CmsVisualNode): string[] {
  return [node.nodeId, ...(node.children ?? []).flatMap(visualNodeIds)];
}

function uniqueVisualNodeId(nodeId: string, seenIds: Set<string>) {
  const baseId = nodeId.trim() || "node";
  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }
  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;
  while (seenIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }
  seenIds.add(nextId);
  return nextId;
}

function visualTreeWithUniqueNodeIds(node: CmsVisualNode, seenIds = new Set<string>()): CmsVisualNode {
  return {
    ...node,
    nodeId: uniqueVisualNodeId(node.nodeId, seenIds),
    children: (node.children ?? []).map((child) => visualTreeWithUniqueNodeIds(child, seenIds)),
  };
}

function visualBlockWithUniqueNodeIds(block: CmsBlock): CmsBlock {
  if (block.type !== "visual.module") return block;
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  return visualBlockWithTree(block, visualTreeWithUniqueNodeIds(moduleProps.tree));
}

function visualNodeHasRenderableContent(node: CmsVisualNode): boolean {
  if ((node.children ?? []).some(visualNodeHasRenderableContent)) return true;
  if (node.type === "heading" || node.type === "paragraph" || node.type === "richText" || node.type === "button" || node.type === "link") {
    return Boolean(node.props?.text || node.props?.title);
  }
  if (node.type === "image" || node.type === "video") {
    return Boolean(node.props?.src);
  }
  if (node.type === "htmlEmbed") {
    return Boolean(node.props?.html || node.props?.text);
  }
  return node.type === "spacer" || node.type === "icon";
}

function visualNodesByType(node: CmsVisualNode, type: CmsVisualNodeType): CmsVisualNode[] {
  return [
    ...(node.type === type ? [node] : []),
    ...(node.children ?? []).flatMap((child) => visualNodesByType(child, type)),
  ];
}

function isSafeVisualHref(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  const href = value.trim();
  if (href.includes("\\") || href.startsWith("//")) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

function visualHeadingLevel(node: CmsVisualNode) {
  if (node.type !== "heading") return null;
  const extendedProps = node.props as (CmsVisualNode["props"] & {
    as?: unknown;
    headingLevel?: unknown;
    level?: unknown;
  }) | undefined;
  const rawLevel = extendedProps?.level ?? extendedProps?.headingLevel;
  if (typeof rawLevel === "number" && Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 6) {
    return rawLevel;
  }
  if (typeof rawLevel === "string" && /^h?[1-6]$/.test(rawLevel.trim())) {
    return Number(rawLevel.trim().replace(/^h/, ""));
  }
  const rawAs = extendedProps?.as;
  if (typeof rawAs === "string" && /^h[1-6]$/.test(rawAs.trim())) {
    return Number(rawAs.trim().replace("h", ""));
  }
  return 2;
}

function visualModuleAccessibilityIssues(block: CmsBlock, label: string): CmsBlockBuilderValidationIssue[] {
  if (block.type !== "visual.module") return [];
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  const tree = moduleProps.tree;
  const issues: CmsBlockBuilderValidationIssue[] = [];
  const headings = visualNodesByType(tree, "heading");
  const images = visualNodesByType(tree, "image");
  const actions = [...visualNodesByType(tree, "button"), ...visualNodesByType(tree, "link")];
  const animatedNodes = visualNodeIdsWithAnimation(tree);

  if (headings.length === 0) {
    issues.push({ blockId: block.blockId, severity: "warning", message: `${label} no tiene heading visual para estructura semantica.` });
  }
  const headingLevels = headings.map(visualHeadingLevel).filter((level): level is number => level !== null);
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      issues.push({ blockId: block.blockId, severity: "warning", message: `${label} salta niveles de heading; revisa la jerarquia semantica.` });
      break;
    }
  }
  for (const image of images) {
    if (!image.props?.alt && !image.contentBinding) {
      issues.push({ blockId: block.blockId, severity: "warning", message: `${label} tiene imagen sin alt ni contentBinding: ${image.nodeId}.` });
      break;
    }
  }
  for (const action of actions) {
    if (!isSafeVisualHref(action.props?.href)) {
      issues.push({ blockId: block.blockId, severity: "warning", message: `${label} tiene accion sin href seguro: ${action.nodeId}.` });
      break;
    }
  }
  if (animatedNodes.some((node) => (node.animation?.durationMs ?? 600) > 1200)) {
    issues.push({ blockId: block.blockId, severity: "warning", message: `${label} usa animaciones largas; reduced-motion las desactiva.` });
  }

  return issues;
}

function visualNodeIdsWithAnimation(node: CmsVisualNode): CmsVisualNode[] {
  return [
    ...(node.animation && node.animation.preset !== "none" ? [node] : []),
    ...(node.children ?? []).flatMap(visualNodeIdsWithAnimation),
  ];
}

function visualModuleValidationIssues(block: CmsBlock, label: string): CmsBlockBuilderValidationIssue[] {
  if (block.type !== "visual.module") return [];
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  const ids = visualNodeIds(moduleProps.tree);
  const duplicateIds = ids.filter((nodeId, index) => ids.indexOf(nodeId) !== index);
  const issues: CmsBlockBuilderValidationIssue[] = [];

  if (moduleProps.schemaVersion !== 1) {
    issues.push({ blockId: block.blockId, severity: "error", message: `${label} tiene schemaVersion visual invalido.` });
  }
  if (!visualContainerNodeTypes.includes(moduleProps.tree.type)) {
    issues.push({ blockId: block.blockId, severity: "error", message: `${label} debe tener root visual contenedor.` });
  }
  if (!visualNodeHasRenderableContent(moduleProps.tree)) {
    issues.push({ blockId: block.blockId, severity: "warning", message: `${label} no tiene nodos visuales renderizables.` });
  }
  if (duplicateIds.length > 0) {
    issues.push({ blockId: block.blockId, severity: "error", message: `${label} repite nodeId visual: ${duplicateIds[0]}.` });
  }

  return issues;
}

function visualModuleContentValidationIssues(block: CmsBlock, label: string): CmsBlockBuilderValidationIssue[] {
  if (block.type !== "visual.module") return [];
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  const values = visualContentValues(block);
  const issues = Object.entries(moduleProps.contentSchema ?? {})
    .filter(([, field]) => field.required)
    .filter(([key]) => !propHasValue(values[key]))
    .map(([key, field]) => ({
      blockId: block.blockId,
      severity: "error" as const,
      message: `${label} requiere contenido ${field.label ?? key}.`,
    }));
  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === "string" && !isSafeVisualContentText(value)) {
      issues.push({
        blockId: block.blockId,
        severity: "error",
        message: `${label} contiene contenido inseguro en ${key}.`,
      });
    }
  });
  return issues;
}

function createVisualBuilderNode(type: CmsVisualNodeType): CmsVisualNode {
  const base: {
    children?: CmsVisualNode[];
    props?: CmsVisualNodeProps;
    styles?: CmsVisualNodeStyle;
  } = {};

  if (type === "container") {
    base.styles = { paddingBottom: "32px", paddingTop: "32px" };
    base.children = [];
  }
  if (type === "section") {
    base.styles = { paddingBottom: "24px", paddingTop: "24px" };
    base.children = [];
  }
  if (type === "div") {
    base.styles = { padding: "16px" };
    base.children = [];
  }
  if (type === "grid") {
    base.styles = { display: "grid", gap: "16px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
    base.children = [];
  }
  if (type === "flex") {
    base.styles = { alignItems: "center", display: "flex", gap: "16px" };
    base.children = [];
  }
  if (type === "heading") {
    base.props = { text: "Nuevo titulo" };
    base.styles = { fontSize: "32px", fontWeight: "700", lineHeight: "1.15" };
    base.children = [];
  }
  if (type === "paragraph" || type === "richText") {
    base.props = { text: "Texto del modulo visual." };
    base.styles = { fontSize: "16px", lineHeight: "1.5" };
    base.children = [];
  }
  if (type === "image") {
    base.props = { alt: "Imagen del modulo", src: "" };
    base.styles = { minHeight: "220px", width: "100%" };
    base.children = [];
  }
  if (type === "button") {
    base.props = { href: "/", text: "Comprar ahora" };
    base.styles = { marginLeft: "0px" };
    base.children = [];
  }
  if (type === "link") {
    base.props = { href: "/", text: "Ver mas" };
    base.children = [];
  }
  if (type === "icon") {
    base.props = { text: "*" };
    base.styles = { fontSize: "20px" };
    base.children = [];
  }
  if (type === "spacer") {
    base.styles = { height: "24px" };
    base.children = [];
  }
  if (type === "video") {
    base.props = { src: "", title: "Video" };
    base.children = [];
  }
  if (type === "htmlEmbed") {
    base.props = { html: "<div>HTML escapado</div>" };
    base.children = [];
  }

  return {
    nodeId: makeVisualBuilderNodeId(type),
    type,
    label: visualNodeCatalog.find((node) => node.type === type)?.label ?? type,
    ...base,
  };
}

function cloneVisualBuilderNode(node: CmsVisualNode): CmsVisualNode {
  return {
    ...node,
    nodeId: makeVisualBuilderNodeId(node.type),
    label: node.label ? `${node.label} copy` : undefined,
    children: (node.children ?? []).map((child) => cloneVisualBuilderNode(child)),
  };
}

function remapVisualNodeIds(node: CmsVisualNode, rootNodeId?: string): CmsVisualNode {
  return {
    ...node,
    nodeId: rootNodeId ?? makeVisualBuilderNodeId(node.type),
    children: (node.children ?? []).map((child) => remapVisualNodeIds(child)),
  };
}

function findVisualNode(node: CmsVisualNode, nodeId: string | null): CmsVisualNode | null {
  if (!nodeId) return null;
  if (node.nodeId === nodeId) return node;
  for (const child of node.children ?? []) {
    const found = findVisualNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function visualNodeContains(node: CmsVisualNode, nodeId: string): boolean {
  if (node.nodeId === nodeId) return true;
  return (node.children ?? []).some((child) => visualNodeContains(child, nodeId));
}

function visualNodeMoveTargets(
  node: CmsVisualNode,
  selectedNodeId: string,
  depth = 0,
): CmsVisualNodeMoveTarget[] {
  if (node.nodeId === selectedNodeId) {
    return [];
  }

  return [
    ...(visualContainerNodeTypes.includes(node.type) ? [{
      depth,
      label: node.label ?? node.type,
      nodeId: node.nodeId,
      type: node.type,
    }] : []),
    ...(node.children ?? []).flatMap((child) => visualNodeMoveTargets(child, selectedNodeId, depth + 1)),
  ];
}

function findVisualParentId(node: CmsVisualNode, nodeId: string, parentId: string | null = null): string | null {
  if (node.nodeId === nodeId) return parentId;
  for (const child of node.children ?? []) {
    const parent = findVisualParentId(child, nodeId, node.nodeId);
    if (parent) return parent;
  }
  return null;
}

function updateVisualNodeChildren(
  node: CmsVisualNode,
  parentNodeId: string,
  updater: (children: CmsVisualNode[]) => CmsVisualNode[],
): CmsVisualNode {
  if (node.nodeId === parentNodeId) {
    return {
      ...node,
      children: updater(node.children ?? []),
    };
  }

  return {
    ...node,
    children: (node.children ?? []).map((child) => updateVisualNodeChildren(child, parentNodeId, updater)),
  };
}

function extractVisualNodeFromChildren(children: CmsVisualNode[], nodeId: string): {
  children: CmsVisualNode[];
  extracted: CmsVisualNode | null;
} {
  let extracted: CmsVisualNode | null = null;
  const nextChildren = children.flatMap((child) => {
    if (child.nodeId === nodeId) {
      extracted = child;
      return [];
    }
    const result = extractVisualNodeFromChildren(child.children ?? [], nodeId);
    if (result.extracted) extracted = result.extracted;
    return [{
      ...child,
      children: result.children,
    }];
  });
  return { children: nextChildren, extracted };
}

function insertVisualNodeIntoParent(node: CmsVisualNode, parentNodeId: string, insertedNode: CmsVisualNode): CmsVisualNode {
  return updateVisualNodeChildren(node, parentNodeId, (children) => [...children, insertedNode]);
}

function insertVisualNodeAfterChild(
  node: CmsVisualNode,
  parentNodeId: string,
  siblingNodeId: string,
  insertedNode: CmsVisualNode,
): CmsVisualNode {
  return updateVisualNodeChildren(node, parentNodeId, (children) => {
    const siblingIndex = children.findIndex((child) => child.nodeId === siblingNodeId);
    if (siblingIndex < 0) return [...children, insertedNode];
    return [
      ...children.slice(0, siblingIndex + 1),
      insertedNode,
      ...children.slice(siblingIndex + 1),
    ];
  });
}

function updateVisualNodeInTree(
  node: CmsVisualNode,
  nodeId: string,
  updater: (node: CmsVisualNode) => CmsVisualNode,
): CmsVisualNode {
  if (node.nodeId === nodeId) return updater(node);
  return {
    ...node,
    children: (node.children ?? []).map((child) => updateVisualNodeInTree(child, nodeId, updater)),
  };
}

function removeVisualNodeFromTree(node: CmsVisualNode, nodeId: string): CmsVisualNode {
  return {
    ...node,
    children: (node.children ?? [])
      .filter((child) => child.nodeId !== nodeId)
      .map((child) => removeVisualNodeFromTree(child, nodeId)),
  };
}

function duplicateVisualNodeInTree(node: CmsVisualNode, nodeId: string): { nextNode: CmsVisualNode; copyId: string | null } {
  let copyId: string | null = null;
  const nextNode = {
    ...node,
    children: (node.children ?? []).flatMap((child) => {
      if (child.nodeId === nodeId) {
        const copy = cloneVisualBuilderNode(child);
        copyId = copy.nodeId;
        return [child, copy];
      }
      const result = duplicateVisualNodeInTree(child, nodeId);
      if (result.copyId) copyId = result.copyId;
      return [result.nextNode];
    }),
  };
  return { nextNode, copyId };
}

function moveVisualNodeInTree(node: CmsVisualNode, nodeId: string, direction: -1 | 1): CmsVisualNode {
  const childIndex = (node.children ?? []).findIndex((child) => child.nodeId === nodeId);
  if (childIndex >= 0) {
    return {
      ...node,
      children: moveArrayItem(node.children ?? [], childIndex, direction),
    };
  }

  return {
    ...node,
    children: (node.children ?? []).map((child) => moveVisualNodeInTree(child, nodeId, direction)),
  };
}

function moveVisualNodeToParentInTree(node: CmsVisualNode, nodeId: string, targetParentNodeId: string): CmsVisualNode {
  if (node.nodeId === nodeId) return node;
  const selectedNode = findVisualNode(node, nodeId);
  const targetParentNode = findVisualNode(node, targetParentNodeId);
  if (!selectedNode || !targetParentNode || visualNodeContains(selectedNode, targetParentNodeId)) return node;
  const extracted = extractVisualNodeFromChildren(node.children ?? [], nodeId);
  if (!extracted.extracted) return node;
  return insertVisualNodeIntoParent({
    ...node,
    children: extracted.children,
  }, targetParentNodeId, extracted.extracted);
}

function moveVisualNodeOutInTree(node: CmsVisualNode, nodeId: string): CmsVisualNode {
  if (node.nodeId === nodeId) return node;
  const parentId = findVisualParentId(node, nodeId);
  const grandParentId = parentId ? findVisualParentId(node, parentId) : null;
  if (!parentId || !grandParentId) return node;
  const extracted = extractVisualNodeFromChildren(node.children ?? [], nodeId);
  if (!extracted.extracted) return node;
  return insertVisualNodeAfterChild({
    ...node,
    children: extracted.children,
  }, grandParentId, parentId, extracted.extracted);
}

function visualBlockWithTree(block: CmsBlock, tree: CmsVisualNode): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  return {
    ...block,
    props: {
      ...block.props,
      ...moduleProps,
      tree,
    },
  };
}

function addVisualNodeToParent(block: CmsBlock, parentNodeId: string, node: CmsVisualNode): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  return visualBlockWithTree(
    block,
    updateVisualNodeChildren(moduleProps.tree, parentNodeId, (children) => [...children, node]),
  );
}

function updateVisualNodeInBlock(
  block: CmsBlock,
  nodeId: string,
  updater: (node: CmsVisualNode) => CmsVisualNode,
): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  return visualBlockWithTree(block, updateVisualNodeInTree(moduleProps.tree, nodeId, updater));
}

function removeVisualNodeFromBlock(block: CmsBlock, nodeId: string): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, removeVisualNodeFromTree(moduleProps.tree, nodeId));
}

function duplicateVisualNodeInBlock(block: CmsBlock, nodeId: string): { block: CmsBlock; copyId: string | null } {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return { block, copyId: null };
  const result = duplicateVisualNodeInTree(moduleProps.tree, nodeId);
  return {
    block: visualBlockWithTree(block, result.nextNode),
    copyId: result.copyId,
  };
}

function moveVisualNodeInBlock(block: CmsBlock, nodeId: string, direction: -1 | 1): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, moveVisualNodeInTree(moduleProps.tree, nodeId, direction));
}

function moveVisualNodeToParentInBlock(block: CmsBlock, nodeId: string, targetParentNodeId: string): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, moveVisualNodeToParentInTree(moduleProps.tree, nodeId, targetParentNodeId));
}

function moveVisualNodeOutInBlock(block: CmsBlock, nodeId: string): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, moveVisualNodeOutInTree(moduleProps.tree, nodeId));
}

function replaceVisualNodeInBlock(block: CmsBlock, nodeId: string, replacement: CmsVisualNode): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) {
    return visualBlockWithTree(block, remapVisualNodeIds(replacement, moduleProps.tree.nodeId));
  }
  return updateVisualNodeInBlock(block, nodeId, () => replacement);
}

function canMoveVisualNodeOut(tree: CmsVisualNode, nodeId: string) {
  const parentId = findVisualParentId(tree, nodeId);
  const grandParentId = parentId ? findVisualParentId(tree, parentId) : null;
  return Boolean(parentId && grandParentId);
}

function placementIsVisible(placement: CmsBlockModulePlacement) {
  const visibility = placement.visibility ?? { mobile: true, tablet: true, desktop: true };
  return visibility.mobile || visibility.tablet || visibility.desktop;
}

function builderValidationIssues(
  blocks: CmsBlock[],
  resolvedCanvas: CmsBlockBuilderResolvedCanvas | null,
  moduleSlots: CmsModuleSlot[],
): CmsBlockBuilderValidationIssue[] {
  const issues: CmsBlockBuilderValidationIssue[] = [];
  const slotKeys = new Set(moduleSlots.map(moduleSlotKey));
  const blockIds = new Set<string>();
  const orderMap = new Map<string, string[]>();

  if (blocks.length === 0) {
    issues.push({ severity: "warning", message: "El canvas no tiene bloques." });
  }

  blocks.forEach((block, index) => {
    const label = issueBlockLabel(block, index);
    const definition = getCmsBlockDefinition(block.type);
    const surface = getCmsBlockSurface(block);

    if (blockIds.has(block.blockId)) {
      issues.push({ blockId: block.blockId, severity: "error", message: `${label} repite Block ID.` });
    }
    blockIds.add(block.blockId);

    if (!definition) {
      issues.push({ blockId: block.blockId, severity: "warning", message: `${label} no existe en el registry compartido.` });
    }

    definition?.editorFields.forEach((field) => {
      if (!field.required || field.type === "plpTarget") return;
      if (!propHasValue(blockEditorFieldValue(block, field.key))) {
        issues.push({ blockId: block.blockId, severity: "error", message: `${label} requiere ${field.label}.` });
      }
    });
    issues.push(...visualModuleValidationIssues(block, label));
    issues.push(...visualModuleContentValidationIssues(block, label));
    issues.push(...visualModuleAccessibilityIssues(block, label));

    if (surface === "page") {
      const placement = completePlacement(block, resolvedCanvas, index + 1);
      if (!placement) {
        issues.push({ blockId: block.blockId, severity: "error", message: `${label} no tiene placement de pagina.` });
        return;
      }
      if (resolvedCanvas && !slotKeys.has(moduleSlotKey(placement))) {
        issues.push({ blockId: block.blockId, severity: "error", message: `${label} apunta a un slot que no existe.` });
      }
      if (!placementIsVisible(placement)) {
        issues.push({ blockId: block.blockId, severity: "warning", message: `${label} esta oculto en mobile, tablet y desktop.` });
      }
      const orderKey = `${moduleSlotKey(placement)}|${placement.order}`;
      orderMap.set(orderKey, [...(orderMap.get(orderKey) ?? []), label]);
    }

    if (surface === "plp") {
      const placement = getCmsBlockPlacement(block);
      const target = getCmsBlockPlpTarget(block);
      if (placement === "main") {
        issues.push({ blockId: block.blockId, severity: "error", message: `${label} es PLP pero no esta antes o despues del listado.` });
      }
      if (!target.routePath && !target.categorySlug) {
        issues.push({ blockId: block.blockId, severity: "warning", message: `${label} no tiene URL PLP ni slug de categoria.` });
      }
      if (target.routePath && !target.routePath.startsWith("/")) {
        issues.push({ blockId: block.blockId, severity: "warning", message: `${label} usa una URL PLP sin slash inicial.` });
      }
    }
  });

  orderMap.forEach((labels, key) => {
    if (labels.length < 2) return;
    const [region, areaId, columnIndex, order] = key.split("|");
    issues.push({
      severity: "warning",
      message: `Orden ${order} duplicado en ${region}/${areaId}/col ${columnIndex}: ${labels.join(", ")}.`,
    });
  });

  return issues;
}

function canvasTokenStyle(resolvedCanvas: CmsBlockBuilderResolvedCanvas | null): CSSProperties {
  if (!resolvedCanvas) return {};
  const colors = resolvedCanvas.tokens.colors;
  return {
    "--cms-builder-bg": colors.background ?? "var(--admin-bg)",
    "--cms-builder-text": colors.text ?? "var(--admin-text)",
    "--cms-builder-surface": colors.surface ?? "var(--admin-surface)",
    "--cms-builder-module-gap": resolvedCanvas.tokens.defaultModuleGap,
    color: colors.text ?? "var(--admin-text)",
    maxWidth: resolvedCanvas.tokens.maxWidth,
  } as CSSProperties;
}

function columnGridStyle(columns: string[], columnGap: string | null | undefined, tokens: CmsDesignTokens): CSSProperties {
  return {
    columnGap: columnGap ?? tokens.defaultColumnGap,
    gridTemplateColumns: columns.join(" "),
  };
}

function handlePreviewItemKey(event: KeyboardEvent<HTMLDivElement>, onSelect: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1) {
  if (index < 0) return items;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  return copy;
}

function renumberModuleSlotOrders(
  blocks: CmsBlock[],
  resolvedCanvas: CmsBlockBuilderResolvedCanvas | null,
  targetPlacement: Pick<CmsModulePlacement, "region" | "areaId" | "columnIndex"> | undefined,
) {
  const targetSlot = targetPlacement;
  if (!resolvedCanvas || !targetSlot) return blocks;
  const orderByBlockId = new Map(blocks
    .map((block, index) => ({
      block,
      index,
      placement: completePlacement(block, resolvedCanvas, index + 1),
    }))
    .filter((item): item is { block: CmsBlock; index: number; placement: CmsBlockModulePlacement } => {
      const placement = item.placement;
      return placement !== undefined && getCmsBlockSurface(item.block) === "page" && sameModuleSlot(placement, targetSlot);
    })
    .sort((left, right) => (left.placement?.order ?? 0) - (right.placement?.order ?? 0) || left.index - right.index)
    .map((item, index) => [item.block.blockId, index + 1]));

  return blocks.map((block, index) => {
    const nextOrder = orderByBlockId.get(block.blockId);
    if (!nextOrder) return block;
    const placement = completePlacement(block, resolvedCanvas, index + 1);
    if (!placement) return block;
    return {
      ...block,
      placement: {
        ...placement,
        order: nextOrder,
      },
      props: {
        ...block.props,
        surface: "page",
        placement: "main",
      },
    };
  });
}

function builderBlocksForSave(
  blocks: CmsBlock[],
  rolloutMode: CmsVisualModuleV2RolloutMode,
  resolvedCanvas: CmsBlockBuilderResolvedCanvas | null,
) {
  return blocks.map((block, index) => {
    const blockForSave = visualBlockWithUniqueNodeIds(block);
    const surface = getCmsBlockSurface(blockForSave);
    const placement = surface === "page" ? completePlacement(blockForSave, resolvedCanvas, index + 1) : undefined;
    const normalizedBlock = normalizeCmsBlock({
      ...blockForSave,
      ...(placement ? {
        placement: {
          ...placement,
          order: index + 1,
        },
      } : {}),
    });
    const rolloutBlock = visualModuleBlockForRollout(normalizedBlock, rolloutMode);
    if (rolloutBlock.type !== "visual.module") return rolloutBlock;
    if (rolloutBlock.props.schemaVersion === 2) {
      const moduleProps = normalizeCmsVisualModuleV2Props(rolloutBlock.props);
      return {
        ...rolloutBlock,
        props: {
          ...rolloutBlock.props,
          ...visualModulePropsForSave(moduleProps),
        },
      };
    }
    return {
      ...rolloutBlock,
      props: {
        ...rolloutBlock.props,
        contentValues: visualContentValuesForSave(recordValue(rolloutBlock.props.contentValues)),
      },
    };
  });
}

function builderBlocksForCmsDraftPayload(blocks: CmsBlock[]) {
  return blocks.map((block) => {
    if (block.type !== "visual.module" || block.props.visualDefinitionReference !== true) {
      return block;
    }
    const definitionId = typeof block.props.definitionId === "string" ? block.props.definitionId.trim() : "";
    if (!definitionId) return block;
    return {
      ...block,
      props: {
        definitionId,
        contentValues: visualContentValuesForSave(recordValue(block.props.contentValues)),
      },
    };
  });
}

function visualModuleSaveSummary(blocks: CmsBlock[]) {
  return blocks
    .filter((block) => block.type === "visual.module")
    .map((block) => {
      const moduleProps = normalizeCmsVisualModuleProps(block.props);
      return {
        blockId: block.blockId,
        name: moduleProps.name ?? "Modulo visual",
        nodes: countVisualNodes(moduleProps.tree),
      };
    });
}

function visualModuleDefinitionModuleFromBlock(block: CmsBlock | null | undefined): CmsVisualModuleV2Props | null {
  if (!block || block.type !== "visual.module") return null;
  const schemaVersion = (block.props as { schemaVersion?: unknown }).schemaVersion;
  const moduleProps = schemaVersion === 2
    ? normalizeCmsVisualModuleV2Props(block.props)
    : migrateCmsVisualModuleV1ToV2ForRenderer(block.props);
  return visualModulePropsForSave(moduleProps);
}

export function CmsBlockBuilderClient({
  contextLabel,
  initialBlocks,
  initialPageId,
  locale,
  pageOptions,
  pageSummary,
  resolvedCanvas,
  resolvedSummary,
  saveDraftAction,
  saveVisualModuleDefinitionAction,
  visualModules,
}: CmsBlockBuilderClientProps) {
  const [builderState, dispatchBuilder] = useReducer(cmsBlockBuilderReducer, initialBlocks, createInitialBuilderState);
  const {
    blocks,
    exportMessage,
    history,
    importDraft,
    importMessage,
    mediaUploads,
    selectedBlockId,
    selectedVisualNodeId,
    surface,
    validationIssues,
    viewport,
    visualImportDraft,
    visualModulePresets,
    visualPortabilityMessage,
    visualPresetMessage,
    visualPresetName,
    visualStyleScope,
  } = builderState;
  const visualModuleRolloutMode = cmsVisualModuleV2RolloutMode();
  const canCreateVisualModules = visualModuleRolloutMode !== "disabled";
  const definitions = useMemo(
    () => getCmsBlockDefinitions().filter((definition) => canCreateVisualModules || definition.type !== "visual.module"),
    [canCreateVisualModules],
  );
  const filteredBlocks = useMemo(() => blocks.filter((block) => surface === "plp" ? getCmsBlockSurface(block) === "plp" : getCmsBlockSurface(block) !== "plp"), [blocks, surface]);
  const selectedBlock = blocks.find((block) => block.blockId === selectedBlockId) ?? blocks[0] ?? null;
  const selectedBlockIndex = selectedBlock ? blocks.findIndex((block) => block.blockId === selectedBlock.blockId) : -1;
  const saveBlocks = useMemo(() => builderBlocksForSave(blocks, visualModuleRolloutMode, resolvedCanvas), [blocks, resolvedCanvas, visualModuleRolloutMode]);
  const serialized = useMemo(() => blocksToJson(builderBlocksForCmsDraftPayload(saveBlocks)), [saveBlocks]);
  const visualModulesForSave = useMemo(() => visualModuleSaveSummary(saveBlocks), [saveBlocks]);
  const selectedSaveBlock = selectedBlock
    ? saveBlocks.find((block) => block.blockId === selectedBlock.blockId) ?? selectedBlock
    : null;
  const selectedVisualDefinitionModule = useMemo(() => visualModuleDefinitionModuleFromBlock(selectedSaveBlock), [selectedSaveBlock]);
  const selectedVisualDefinitionModuleJson = useMemo(
    () => selectedVisualDefinitionModule ? JSON.stringify(selectedVisualDefinitionModule) : "",
    [selectedVisualDefinitionModule],
  );
  const selectedVisualDefinitionName = visualPresetName.trim() || selectedVisualDefinitionModule?.name || (selectedBlock ? blockTitle(selectedBlock) : "Modulo visual");
  const [initialSerialized] = useState(() => serialized);
  const hasLocalChanges = serialized !== initialSerialized;
  const moduleSlots = useMemo(() => resolvedModuleSlots(resolvedCanvas), [resolvedCanvas]);
  const pageUnplacedBlocks = useMemo(() => unplacedBlocks(filteredBlocks, resolvedCanvas), [filteredBlocks, resolvedCanvas]);
  const computedValidationIssues = useMemo(() => builderValidationIssues(saveBlocks, resolvedCanvas, moduleSlots), [moduleSlots, resolvedCanvas, saveBlocks]);
  const validationErrorCount = validationIssues.filter((issue) => issue.severity === "error").length;
  const validationWarningCount = validationIssues.length - validationErrorCount;
  const canSubmitDraft = Boolean(pageSummary?.canSaveDraft) && validationErrorCount === 0;
  const validationStatusMessage = validationErrorCount > 0
    ? "Corrige los errores antes de guardar el draft."
    : validationWarningCount > 0
      ? "Hay avisos no bloqueantes. Puedes guardar el draft."
      : "Validacion local con registry, slots y targets.";
  const saveDisabledReason = !pageSummary?.canSaveDraft
    ? "La pagina publicada no se edita desde Builder."
    : validationErrorCount > 0
      ? `Bloqueado por ${validationErrorCount} error(es) de builder.`
      : null;
  const selectedVisualModuleProps = selectedBlock?.type === "visual.module"
    ? normalizeCmsVisualModuleProps(selectedBlock.props)
    : null;
  const selectedVisualTree = selectedVisualModuleProps?.tree ?? null;
  const selectedVisualAssetRefs = selectedVisualModuleProps?.assetRefs ?? [];
  const selectedVisualNode = selectedVisualTree
    ? findVisualNode(selectedVisualTree, selectedVisualNodeId) ?? selectedVisualTree
    : null;
  const selectedVisualTreeIsEmpty = Boolean(selectedVisualTree && (selectedVisualTree.children?.length ?? 0) === 0);
  const selectedVisualMoveTargets = selectedVisualTree && selectedVisualNode
    ? visualNodeMoveTargets(selectedVisualTree, selectedVisualNode.nodeId)
    : [];
  const selectedVisualCanMoveOut = selectedVisualTree && selectedVisualNode
    ? canMoveVisualNodeOut(selectedVisualTree, selectedVisualNode.nodeId)
    : false;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const visualBlockPresets = useMemo(
    () => visualModulePresets.filter((preset) => preset.status === "ACTIVE"),
    [visualModulePresets],
  );
  const totalBlockLibraryItems = definitions.length + visualBlockPresets.length;

  useEffect(() => {
    dispatchBuilder({ type: "setValidationIssues", issues: computedValidationIssues });
  }, [computedValidationIssues]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        dispatchBuilder({
          type: "setVisualModulePresets",
          presets: mergeVisualModulePresets(visualModulePresetsFromJson(window.localStorage.getItem(visualModulePresetsStorageKey))),
        });
      } catch {
        dispatchBuilder({ type: "setVisualPresetMessage", message: "No se pudieron cargar los presets visuales locales." });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function persistVisualModulePresets(nextPresets: CmsVisualModulePreset[]) {
    const mergedPresets = mergeVisualModulePresets(nextPresets);
    dispatchBuilder({ type: "setVisualModulePresets", presets: mergedPresets });
    try {
      window.localStorage.setItem(visualModulePresetsStorageKey, visualModulePresetsToJson(mergedPresets));
      return true;
    } catch {
      dispatchBuilder({ type: "setVisualPresetMessage", message: "No se pudo persistir el preset visual en este navegador." });
      return false;
    }
  }

  function addBlock(type: string) {
    if (type === "visual.module" && !canCreateVisualModules) {
      dispatchBuilder({ type: "setImportMessage", message: "visual.module v2 esta desactivado por rollout." });
      return;
    }
    const block = withPagePlacementDefaults(createCmsBlockFromPreset(type), resolvedCanvas, blocks.length + 1);
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => [...current, block],
      selectedBlockId: block.blockId,
      selectedVisualNodeId: type === "visual.module" ? "root" : null,
      surface: getCmsBlockSurface(block),
    });
  }

  function addBlankVisualModuleBlock() {
    if (!canCreateVisualModules) {
      dispatchBuilder({ type: "setImportMessage", message: "visual.module v2 esta desactivado por rollout." });
      return;
    }
    const block = withPagePlacementDefaults(createBlankVisualModuleBlock(), resolvedCanvas, blocks.length + 1);
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => [...current, block],
      selectedBlockId: block.blockId,
      selectedVisualNodeId: "root",
      surface: "page",
    });
  }

  function addCmsVisualModuleReference(definitionId: string) {
    const definition = visualModules.items.find((item) => item.definitionId === definitionId && item.status === "ACTIVE");
    if (!definition) {
      dispatchBuilder({ type: "setVisualPresetMessage", message: "La definicion CMS no esta activa o ya no existe." });
      return;
    }
    const block = withPagePlacementDefaults(createCmsVisualModuleReferenceBlock(definition), resolvedCanvas, blocks.length + 1);
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => [...current, block],
      selectedBlockId: block.blockId,
      selectedVisualNodeId: definition.module.moduleId,
      surface: "page",
    });
  }

  function removeBlock(blockId: string) {
    const next = blocks.filter((block) => block.blockId !== blockId);
    dispatchBuilder({
      type: "applyBlocks",
      blocks: next,
      selectedBlockId: selectedBlockId === blockId ? nextSelectedBlockId(next) : selectedBlockId,
      selectedVisualNodeId: selectedBlockId === blockId ? null : selectedVisualNodeId,
    });
  }

  function removeSelectedBlock() {
    if (selectedBlockId) removeBlock(selectedBlockId);
  }

  function duplicateBlock(blockId: string) {
    const sourceIndex = blocks.findIndex((block) => block.blockId === blockId);
    const source = blocks[sourceIndex];
    if (!source) return;
    const placement = completePlacement(source, resolvedCanvas, sourceIndex + 1);
    const copy: CmsBlock = {
      ...source,
      blockId: makeBuilderBlockId(source),
      ...(placement && getCmsBlockSurface(source) === "page" ? {
        placement: {
          ...placement,
          order: placement.order + 1,
        },
      } : {}),
      props: {
        ...source.props,
      },
      children: source.children ? [...source.children] : [],
    };
    dispatchBuilder({
      type: "mutateBlocks",
      selectedBlockId: copy.blockId,
      selectedVisualNodeId: copy.type === "visual.module" ? "root" : null,
      mutate: (current) => {
      const currentSourceIndex = current.findIndex((block) => block.blockId === blockId);
      if (currentSourceIndex < 0) return current;
      const next = [...current.slice(0, currentSourceIndex + 1), copy, ...current.slice(currentSourceIndex + 1)];
      return placement && getCmsBlockSurface(copy) === "page"
        ? renumberModuleSlotOrders(next, resolvedCanvas, placement)
        : next;
      },
    });
  }

  function duplicateSelectedBlock() {
    if (selectedBlockId) duplicateBlock(selectedBlockId);
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    dispatchBuilder({ type: "selectBlock", blockId });
    dispatchBuilder({
      type: "mutateBlocks",
      selectedBlockId: blockId,
      mutate: (current) => {
      const sourceIndex = current.findIndex((block) => block.blockId === blockId);
      const source = current[sourceIndex];
      if (!source) return current;
      const sourcePlacement = completePlacement(source, resolvedCanvas, sourceIndex + 1);

      if (getCmsBlockSurface(source) !== "page" || !sourcePlacement || !resolvedCanvas) {
        return moveArrayItem(current, sourceIndex, direction);
      }
      const sourceSlot = sourcePlacement;

      const siblings = current
        .map((block, index) => ({
          block,
          index,
          placement: completePlacement(block, resolvedCanvas, index + 1),
        }))
        .filter((item): item is { block: CmsBlock; index: number; placement: CmsBlockModulePlacement } => {
          const placement = item.placement;
          return placement !== undefined && getCmsBlockSurface(item.block) === "page" && sameModuleSlot(placement, sourceSlot);
        })
        .sort((left, right) => (left.placement?.order ?? 0) - (right.placement?.order ?? 0) || left.index - right.index);
      const siblingIndex = siblings.findIndex((item) => item.block.blockId === blockId);
      const movedSiblings = moveArrayItem(siblings, siblingIndex, direction);
      const orderByBlockId = new Map(movedSiblings.map((item, index) => [item.block.blockId, index + 1]));

      return current.map((block, index) => {
        const nextOrder = orderByBlockId.get(block.blockId);
        if (!nextOrder) return block;
        const placement = completePlacement(block, resolvedCanvas, index + 1);
        if (!placement) return block;
        return {
          ...block,
          placement: {
            ...placement,
            order: nextOrder,
          },
          props: {
            ...block.props,
            surface: "page",
            placement: "main",
          },
        };
      });
      },
    });
  }

  function moveSelectedBlock(direction: -1 | 1) {
    if (selectedBlockId) moveBlock(selectedBlockId, direction);
  }

  function updateSelectedBlock(updater: (block: CmsBlock, index: number) => CmsBlock) {
    if (!selectedBlockId) return;
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block, index) =>
        block.blockId === selectedBlockId ? updater(block, index) : block,
      ),
    });
  }

  function updateSelectedProp(key: string, value: unknown) {
    updateSelectedBlock((block) => ({
      ...block,
      props: {
        ...block.props,
        [key]: value,
      },
    }));
  }

  function updateSelectedTarget(key: keyof ReturnType<typeof getCmsBlockPlpTarget>, value: string) {
    updateSelectedBlock((block) => {
      const target = getCmsBlockPlpTarget(block);
      return {
        ...block,
        props: {
          ...block.props,
          surface: "plp",
          target: {
            ...target,
            [key]: value,
          },
        },
      };
    });
  }

  function updateSelectedSurface(nextSurface: CmsSurface) {
    updateSelectedBlock((block, index) => {
      if (nextSurface === "plp") {
        const nextBlock: CmsBlock = {
          ...block,
          props: {
            ...block.props,
            surface: "plp",
            placement: getCmsBlockPlacement(block) === "main" ? "beforeList" : getCmsBlockPlacement(block),
            target: getCmsBlockPlpTarget(block),
          },
        };
        delete nextBlock.placement;
        return nextBlock;
      }

      return withPagePlacementDefaults({
        ...block,
        props: {
          ...block.props,
          surface: "page",
          placement: "main",
        },
      }, resolvedCanvas, index + 1);
    });
    dispatchBuilder({ type: "setSurface", surface: nextSurface });
  }

  function updateSelectedPlacement(partial: Partial<CmsBlockModulePlacement>) {
    updateSelectedBlock((block, index) => {
      const placement = completePlacement(block, resolvedCanvas, index + 1);
      if (!placement) return block;
      return {
        ...block,
        placement: {
          ...placement,
          ...partial,
        },
        props: {
          ...block.props,
          surface: "page",
          placement: "main",
        },
      };
    });
  }

  function addVisualNodeToSelectedBlock(type: CmsVisualNodeType) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode) return;
    const node = createVisualBuilderNode(type);
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) =>
        block.blockId === selectedBlock.blockId
          ? addVisualNodeToParent(block, selectedVisualNode.nodeId, node)
          : block,
      ),
      selectedVisualNodeId: node.nodeId,
    });
  }

  function removeVisualNode(nodeId: string) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || selectedVisualTree?.nodeId === nodeId) return;
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) =>
        block.blockId === selectedBlock.blockId
          ? removeVisualNodeFromBlock(block, nodeId)
          : block,
      ),
      selectedVisualNodeId: selectedVisualTree?.nodeId ?? "root",
    });
  }

  function duplicateVisualNode(nodeId: string) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || selectedVisualTree?.nodeId === nodeId) return;
    const result = duplicateVisualNodeInBlock(selectedBlock, nodeId);
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) =>
        block.blockId === selectedBlock.blockId ? result.block : block,
      ),
      selectedVisualNodeId: result.copyId ?? selectedVisualNodeId,
    });
  }

  function moveVisualNode(nodeId: string, direction: -1 | 1) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || selectedVisualTree?.nodeId === nodeId) return;
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) =>
        block.blockId === selectedBlock.blockId
          ? moveVisualNodeInBlock(block, nodeId, direction)
          : block,
      ),
      selectedVisualNodeId: nodeId,
    });
  }

  function moveSelectedVisualNodeToParent(targetParentNodeId: string) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode || !targetParentNodeId) return;
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) =>
        block.blockId === selectedBlock.blockId
          ? moveVisualNodeToParentInBlock(block, selectedVisualNode.nodeId, targetParentNodeId)
          : block,
      ),
      selectedVisualNodeId: selectedVisualNode.nodeId,
    });
  }

  function moveSelectedVisualNodeOut() {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode) return;
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) =>
        block.blockId === selectedBlock.blockId
          ? moveVisualNodeOutInBlock(block, selectedVisualNode.nodeId)
          : block,
      ),
      selectedVisualNodeId: selectedVisualNode.nodeId,
    });
  }

  function updateSelectedVisualNode(updater: (node: CmsVisualNode) => CmsVisualNode) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode) return;
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) =>
        block.blockId === selectedBlock.blockId
          ? updateVisualNodeInBlock(block, selectedVisualNode.nodeId, updater)
          : block,
      ),
    });
  }

  function updateSelectedVisualNodeLabel(value: string) {
    updateSelectedVisualNode((node) => ({
      ...node,
      ...(value.trim() ? { label: value } : { label: undefined }),
    }));
  }

  function updateSelectedVisualNodeContentBinding(value: string) {
    updateSelectedVisualNode((node) => ({
      ...node,
      ...(value.trim() ? { contentBinding: value.trim() } : { contentBinding: undefined }),
    }));
  }

  function updateSelectedVisualNodeVisibility(breakpoint: CmsVisualBreakpoint, value: boolean) {
    updateSelectedVisualNode((node) => {
      const visibility = { ...(node.visibility ?? {}) };
      visibility[breakpoint] = value;
      const normalizedVisibility = Object.fromEntries(
        Object.entries(visibility).filter(([, visible]) => visible === false),
      ) as CmsVisualNode["visibility"];
      return {
        ...node,
        visibility: normalizedVisibility && Object.keys(normalizedVisibility).length ? normalizedVisibility : undefined,
      };
    });
  }

  function updateSelectedVisualNodeAnimation(key: keyof NonNullable<CmsVisualNode["animation"]>, value: string) {
    updateSelectedVisualNode((node) => {
      const current = node.animation ?? { preset: "none" as const };
      if (key === "preset") {
        const preset = visualAnimationPresets.includes(value as typeof visualAnimationPresets[number])
          ? value as NonNullable<CmsVisualNode["animation"]>["preset"]
          : "none";
        return {
          ...node,
          animation: preset === "none" ? undefined : { ...current, preset },
        };
      }
      const next = { ...current, preset: current.preset === "none" ? "fadeIn" as const : current.preset };
      if (key === "durationMs" || key === "delayMs") {
        const numericValue = Math.max(0, Math.min(2000, Number(value) || 0));
        next[key] = numericValue;
      }
      if (key === "easing" && visualAnimationEasings.includes(value as typeof visualAnimationEasings[number])) {
        next.easing = value as NonNullable<CmsVisualNode["animation"]>["easing"];
      }
      if (key === "trigger" && visualAnimationTriggers.includes(value as typeof visualAnimationTriggers[number])) {
        next.trigger = value as NonNullable<CmsVisualNode["animation"]>["trigger"];
      }
      return { ...node, animation: next };
    });
  }

  function updateSelectedVisualNodeHoverStyles(styles: Partial<Record<CmsVisualHoverStyleKey, string>>) {
    updateSelectedVisualNode((node) => {
      const currentHover = node.interactions?.hover ?? {};
      const nextHover = {
        ...currentHover,
        styles: Object.keys(styles).length ? styles : undefined,
      };
      const nextInteractions = nextHover.styles || nextHover.transition
        ? { ...(node.interactions ?? {}), hover: nextHover }
        : undefined;
      return { ...node, interactions: nextInteractions };
    });
  }

  function updateSelectedVisualNodeHoverTransition(
    key: keyof CmsVisualInteractionTransition,
    value: string,
  ) {
    updateSelectedVisualNode((node) => {
      const currentHover = node.interactions?.hover ?? {};
      const currentTransition = currentHover.transition ?? {};
      const nextTransition = { ...currentTransition };
      if (key === "durationMs") {
        nextTransition.durationMs = Math.max(0, Math.min(2000, Number(value) || 0));
      }
      if (key === "delayMs") {
        nextTransition.delayMs = Math.max(0, Math.min(2000, Number(value) || 0));
      }
      if (key === "easing" && visualAnimationEasings.includes(value as typeof visualAnimationEasings[number])) {
        nextTransition.easing = value as NonNullable<typeof currentHover.transition>["easing"];
      }
      const nextHover = {
        ...currentHover,
        transition: nextTransition,
      };
      return {
        ...node,
        interactions: {
          ...(node.interactions ?? {}),
          hover: nextHover,
        },
      };
    });
  }

  function clearSelectedVisualNodeHover() {
    updateSelectedVisualNode((node) => {
      const restInteractions = { ...(node.interactions ?? {}) };
      delete restInteractions.hover;
      return {
        ...node,
        interactions: Object.keys(restInteractions).length ? restInteractions : undefined,
      };
    });
  }

  function updateSelectedVisualNodeProp(key: CmsVisualNodeEditableProp, value: string) {
    updateSelectedVisualNode((node) => {
      const props = { ...(node.props ?? {}) };
      if (value.trim()) {
        props[key] = value;
      } else {
        delete props[key];
      }
      return {
        ...node,
        props: Object.keys(props).length ? props : undefined,
      };
    });
  }

  function updateSelectedVisualNodeStyle(key: keyof CmsVisualNodeStyle, value: string) {
    updateSelectedVisualNode((node) => {
      const styles = { ...(node.styles ?? {}) };
      if (value.trim()) {
        styles[key] = value;
      } else {
        delete styles[key];
      }
      return {
        ...node,
        styles: Object.keys(styles).length ? styles : undefined,
      };
    });
  }

  function updateSelectedVisualNodeResponsiveStyle(
    breakpoint: CmsVisualBreakpoint,
    key: keyof CmsVisualNodeStyle,
    value: string,
  ) {
    updateSelectedVisualNode((node) => {
      const responsiveStyles = { ...(node.responsiveStyles ?? {}) };
      const breakpointStyles = { ...(responsiveStyles[breakpoint] ?? {}) };
      if (value.trim()) {
        breakpointStyles[key] = value;
      } else {
        delete breakpointStyles[key];
      }
      if (Object.keys(breakpointStyles).length) {
        responsiveStyles[breakpoint] = breakpointStyles;
      } else {
        delete responsiveStyles[breakpoint];
      }
      return {
        ...node,
        responsiveStyles: Object.keys(responsiveStyles).length ? responsiveStyles : undefined,
      };
    });
  }

  function replaceSelectedVisualNodeStyleScope(scope: CmsVisualStyleScope, nextStyles: CmsVisualNodeStyle) {
    updateSelectedVisualNode((node) => {
      if (scope === "base") {
        return {
          ...node,
          styles: Object.keys(nextStyles).length ? nextStyles : undefined,
        };
      }
      const responsiveStyles = { ...(node.responsiveStyles ?? {}) };
      if (Object.keys(nextStyles).length) {
        responsiveStyles[scope] = nextStyles;
      } else {
        delete responsiveStyles[scope];
      }
      return {
        ...node,
        responsiveStyles: Object.keys(responsiveStyles).length ? responsiveStyles : undefined,
      };
    });
  }

  async function uploadSelectedVisualNodeMedia(target: CmsVisualMediaUploadTarget, file: File, requestedAssetKey?: string) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode) return;
    const assetKey = visualBuilderAssetKey(requestedAssetKey || `${selectedBlock.blockId}-${selectedVisualNode.nodeId}-${target.kind}-${target.key}`);
    const canonicalValue = `asset:${assetKey}`;
    dispatchBuilder({ type: "setMediaUpload", upload: { assetKey, message: file.name, status: "uploading" } });

    const formData = new FormData();
    formData.set("assetKey", assetKey);
    formData.set("assetTitle", selectedVisualNode.label ?? selectedVisualNode.type);
    formData.set("alt", selectedVisualNode.props?.alt ?? selectedVisualNode.label ?? selectedVisualNode.type);
    formData.set("file", file);

    const result = await uploadCmsBuilderMediaAction(formData);
    if (!result.ok || !result.mediaAssetId) {
      dispatchBuilder({ type: "setMediaUpload", upload: { assetKey, message: result.message, status: "failed" } });
      return;
    }

    const assetRef: CmsVisualAssetRef = {
      assetKey: result.assetKey ?? assetKey,
      mediaAssetId: result.mediaAssetId,
      role: target.role,
      src: result.previewUrl ?? visualBuilderAssetPreviewUrl(result.mediaAssetId),
      alt: selectedVisualNode.props?.alt ?? selectedVisualNode.label ?? selectedVisualNode.type,
    };

    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) => {
        if (block.blockId !== selectedBlock.blockId) return block;
        const blockWithAsset = upsertVisualBlockAssetRef(block, assetRef);
        return updateVisualNodeInBlock(blockWithAsset, selectedVisualNode.nodeId, (node) => {
          if (target.kind === "prop") {
            const props = { ...(node.props ?? {}), [target.key]: canonicalValue };
            return { ...node, props };
          }
          if (visualStyleScope !== "base") {
            const responsiveStyles = { ...(node.responsiveStyles ?? {}) };
            responsiveStyles[visualStyleScope] = {
              ...(responsiveStyles[visualStyleScope] ?? {}),
              [target.key]: canonicalValue,
            };
            return { ...node, responsiveStyles };
          }
          const styles = { ...(node.styles ?? {}), [target.key]: canonicalValue };
          return { ...node, styles };
        });
      }),
      selectedVisualNodeId: selectedVisualNode.nodeId,
    });
    dispatchBuilder({ type: "setMediaUpload", upload: { assetKey, mediaAssetId: result.mediaAssetId, message: result.message, previewUrl: assetRef.src, status: "uploaded" } });
  }

  function removeSelectedVisualNodeMedia(target: CmsVisualMediaUploadTarget, assetKey: string) {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode || !assetKey) return;
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => current.map((block) => {
        if (block.blockId !== selectedBlock.blockId) return block;
        const blockWithoutAsset = removeVisualBlockAssetRef(block, assetKey);
        return updateVisualNodeInBlock(blockWithoutAsset, selectedVisualNode.nodeId, (node) => {
          if (target.kind === "prop") {
            const props = { ...(node.props ?? {}) };
            if (props[target.key] === `asset:${assetKey}`) delete props[target.key];
            return { ...node, props: Object.keys(props).length ? props : undefined };
          }
          if (visualStyleScope !== "base") {
            const responsiveStyles = { ...(node.responsiveStyles ?? {}) };
            const scopedStyles = { ...(responsiveStyles[visualStyleScope] ?? {}) };
            if (scopedStyles[target.key] === `asset:${assetKey}`) delete scopedStyles[target.key];
            if (Object.keys(scopedStyles).length) {
              responsiveStyles[visualStyleScope] = scopedStyles;
            } else {
              delete responsiveStyles[visualStyleScope];
            }
            return { ...node, responsiveStyles: Object.keys(responsiveStyles).length ? responsiveStyles : undefined };
          }
          const styles = { ...(node.styles ?? {}) };
          if (styles[target.key] === `asset:${assetKey}`) delete styles[target.key];
          return { ...node, styles: Object.keys(styles).length ? styles : undefined };
        });
      }),
      selectedVisualNodeId: selectedVisualNode.nodeId,
    });
    dispatchBuilder({ type: "setMediaUpload", upload: { assetKey, message: "Referencia retirada del modulo.", status: "idle" } });
  }

  async function copySelectedVisualNodeJson() {
    if (!selectedVisualNode) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedVisualNode, null, 2));
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "Nodo visual copiado." });
    } catch {
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "No se pudo copiar el nodo." });
    }
  }

  async function copyVisualTreeJson() {
    if (!selectedVisualTree) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedVisualTree, null, 2));
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "Arbol visual copiado." });
    } catch {
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "No se pudo copiar el arbol." });
    }
  }

  function loadSelectedVisualNodeIntoImport() {
    if (!selectedVisualNode) return;
    dispatchBuilder({ type: "setVisualImportDraft", draft: JSON.stringify(selectedVisualNode, null, 2) });
    dispatchBuilder({ type: "setVisualPortabilityMessage", message: "Nodo cargado en import." });
  }

  function loadVisualTreeIntoImport() {
    if (!selectedVisualTree) return;
    dispatchBuilder({ type: "setVisualImportDraft", draft: JSON.stringify(selectedVisualTree, null, 2) });
    dispatchBuilder({ type: "setVisualPortabilityMessage", message: "Arbol cargado en import." });
  }

  function parseVisualImportNode() {
    return remapVisualNodeIds(normalizeCmsVisualNode(JSON.parse(visualImportDraft)));
  }

  function applyVisualImportAsChild() {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode) return;
    try {
      const node = parseVisualImportNode();
      dispatchBuilder({
        type: "mutateBlocks",
        mutate: (current) => current.map((block) =>
          block.blockId === selectedBlock.blockId
            ? addVisualNodeToParent(block, selectedVisualNode.nodeId, node)
            : block,
        ),
        selectedVisualNodeId: node.nodeId,
      });
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "Nodo importado como hijo." });
    } catch {
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "JSON visual invalido." });
    }
  }

  function replaceSelectedVisualNodeFromImport() {
    if (!selectedBlock || selectedBlock.type !== "visual.module" || !selectedVisualNode) return;
    try {
      const node = parseVisualImportNode();
      const nextSelectedNodeId = selectedVisualTree?.nodeId === selectedVisualNode.nodeId
        ? selectedVisualNode.nodeId
        : node.nodeId;
      dispatchBuilder({
        type: "mutateBlocks",
        mutate: (current) => current.map((block) =>
          block.blockId === selectedBlock.blockId
            ? replaceVisualNodeInBlock(block, selectedVisualNode.nodeId, node)
            : block,
        ),
        selectedVisualNodeId: nextSelectedNodeId,
      });
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "Nodo visual reemplazado." });
    } catch {
      dispatchBuilder({ type: "setVisualPortabilityMessage", message: "JSON visual invalido." });
    }
  }

  function saveSelectedVisualModulePreset() {
    const fallbackPreset = systemVisualModulePresets[0];
    const sourceModuleProps = selectedBlock?.type === "visual.module"
      ? normalizeCmsVisualModuleProps(selectedBlock.props)
      : null;
    const sourceTree = selectedBlock?.type === "visual.module" && selectedVisualTree
      ? selectedVisualTree
      : fallbackPreset?.tree;
    const sourceName = selectedBlock?.type === "visual.module"
      ? visualModulePresetBaseName(sourceModuleProps?.name ?? "")
      : fallbackPreset?.name;
    const sourceModuleId = selectedBlock?.type === "visual.module"
      ? sourceModuleProps?.tree.nodeId
      : fallbackPreset?.moduleId;

    if (!sourceTree || !sourceModuleId) {
      dispatchBuilder({ type: "setVisualPresetMessage", message: "No hay un modulo visual disponible para guardar." });
      return;
    }

    const name = visualPresetName.trim() || sourceName || "Modulo visual";
    const nextVersion = visualModulePresets
      .filter((preset) => preset.name === name)
      .reduce((version, preset) => Math.max(version, preset.version + 1), 1);
    const now = new Date().toISOString();
    const presetId = makeVisualModulePresetId();
    const contentSchema = inferredVisualContentSchema(sourceTree, sourceModuleProps?.contentSchema ?? fallbackPreset?.contentSchema ?? {});
    const contentValues = {
      ...(fallbackPreset?.contentValues ?? {}),
      ...(sourceModuleProps?.contentValues ?? {}),
    };
    const preset: CmsVisualModulePreset = {
      assetRefs: sourceModuleProps?.assetRefs,
      contentSchema,
      contentValues,
      createdAt: now,
      definitionId: presetId,
      moduleId: sourceModuleId,
      name,
      presetId,
      revision: nextVersion,
      schemaMinorVersion: 0,
      schemaVersion: 2,
      status: "ACTIVE",
      tree: remapVisualNodeIds(sourceTree, "root"),
      updatedAt: now,
      version: nextVersion,
    };
    const nextPresets = [preset, ...localVisualModulePresets(visualModulePresets)];
    if (persistVisualModulePresets(nextPresets)) {
      dispatchBuilder({ type: "setVisualPresetName", name });
      dispatchBuilder({ type: "setVisualPresetMessage", message: `${name} v${nextVersion} guardado y agregado a la lista de bloques.` });
    }
  }

  function applyVisualModulePresetAsBlock(presetId: string) {
    const preset = visualModulePresets.find((item) => item.presetId === presetId);
    if (!preset) return;
    const block = withPagePlacementDefaults(createCmsBlockFromPreset("visual.module"), resolvedCanvas, blocks.length + 1);
    const nextBlock: CmsBlock = {
      ...block,
      props: {
        ...block.props,
        assetRefs: preset.assetRefs,
        contentSchema: preset.contentSchema ?? {},
        contentValues: preset.contentValues ?? {},
        name: visualModulePresetDisplayName(preset),
        schemaVersion: 1,
        surface: "page",
        tree: remapVisualNodeIds(preset.tree, "root"),
      },
    };
    dispatchBuilder({
      type: "mutateBlocks",
      mutate: (current) => [...current, nextBlock],
      selectedBlockId: nextBlock.blockId,
      selectedVisualNodeId: "root",
      surface: "page",
    });
    dispatchBuilder({ type: "setVisualPresetMessage", message: `${visualModulePresetDisplayName(preset)} insertado como modulo.` });
  }

  function replaceSelectedVisualModuleWithPreset(presetId: string) {
    const preset = visualModulePresets.find((item) => item.presetId === presetId);
    if (!preset || !selectedBlock || selectedBlock.type !== "visual.module") {
      dispatchBuilder({ type: "setVisualPresetMessage", message: "Selecciona un modulo visual para reemplazarlo." });
      return;
    }
    updateSelectedBlock((block) => ({
      ...block,
      props: {
        ...block.props,
        assetRefs: preset.assetRefs,
        contentSchema: preset.contentSchema ?? {},
        contentValues: preset.contentValues ?? {},
        name: preset.name,
        schemaVersion: 1,
        tree: remapVisualNodeIds(preset.tree, "root"),
      },
    }));
    dispatchBuilder({ type: "selectVisualNode", nodeId: "root" });
    dispatchBuilder({ type: "setVisualPresetMessage", message: `${visualModulePresetDisplayName(preset)} aplicado al modulo seleccionado.` });
  }

  function deleteVisualModulePreset(presetId: string) {
    const preset = visualModulePresets.find((item) => item.presetId === presetId);
    if (preset?.source === "system") {
      dispatchBuilder({ type: "setVisualPresetMessage", message: "Los presets del sistema no se eliminan desde el navegador." });
      return;
    }
    const nextPresets = visualModulePresets.filter((item) => item.presetId !== presetId);
    if (persistVisualModulePresets(nextPresets)) {
      dispatchBuilder({ type: "setVisualPresetMessage", message: preset ? `${visualModulePresetDisplayName(preset)} eliminado.` : "Preset eliminado." });
    }
  }

  async function copyExportJson() {
    try {
      await navigator.clipboard.writeText(serialized);
      dispatchBuilder({ type: "setExportMessage", message: "JSON copiado." });
    } catch {
      dispatchBuilder({ type: "setExportMessage", message: "No se pudo copiar." });
    }
  }

  function loadCurrentExportIntoImport() {
    dispatchBuilder({ type: "setImportDraft", draft: serialized });
    dispatchBuilder({ type: "setImportMessage", message: "Export actual cargado." });
  }

  function applyImportedBlocks() {
    try {
      const importedBlocks = blocksFromJson(importDraft);
      const normalizedBlocks = importedBlocks.map((block, index) =>
        withPagePlacementDefaults(block, resolvedCanvas, index + 1),
      );
      const nextSelectedBlockIdValue = nextSelectedBlockId(normalizedBlocks);
      const nextSelectedBlock = normalizedBlocks.find((block) => block.blockId === nextSelectedBlockIdValue);
      dispatchBuilder({
        type: "applyBlocks",
        blocks: normalizedBlocks,
        selectedBlockId: nextSelectedBlockIdValue,
        selectedVisualNodeId: nextSelectedBlock?.type === "visual.module" ? "root" : null,
        surface: normalizedBlocks.some((block) => getCmsBlockSurface(block) !== "plp") ? "page" : "plp",
      });
      dispatchBuilder({ type: "setImportMessage", message: `${normalizedBlocks.length} bloques importados.` });
    } catch (error) {
      dispatchBuilder({ type: "setImportMessage", message: error instanceof Error ? error.message : "JSON importado invalido." });
    }
  }

  const selectedVisualNodeInspector = selectedVisualNode ? (
    <VisualNodeInspector
      assetRefs={selectedVisualAssetRefs}
      mediaUploads={mediaUploads}
      node={selectedVisualNode}
      onContentBindingChange={updateSelectedVisualNodeContentBinding}
      onLabelChange={updateSelectedVisualNodeLabel}
      onAnimationChange={updateSelectedVisualNodeAnimation}
      onClearHover={clearSelectedVisualNodeHover}
      onHoverStylesChange={updateSelectedVisualNodeHoverStyles}
      onHoverTransitionChange={updateSelectedVisualNodeHoverTransition}
      onPropChange={updateSelectedVisualNodeProp}
      onResponsiveStyleChange={updateSelectedVisualNodeResponsiveStyle}
      onVisibilityChange={updateSelectedVisualNodeVisibility}
      onMoveOut={moveSelectedVisualNodeOut}
      onMoveToParent={moveSelectedVisualNodeToParent}
      onMediaRemove={removeSelectedVisualNodeMedia}
      onMediaUpload={uploadSelectedVisualNodeMedia}
      onReplaceStyleScope={replaceSelectedVisualNodeStyleScope}
      onStyleScopeChange={(scope) => dispatchBuilder({ type: "setVisualStyleScope", scope })}
      onStyleChange={updateSelectedVisualNodeStyle}
      onApplyVisualImportAsChild={applyVisualImportAsChild}
      onCopySelectedVisualNodeJson={copySelectedVisualNodeJson}
      onCopyVisualTreeJson={copyVisualTreeJson}
      onLoadSelectedVisualNodeIntoImport={loadSelectedVisualNodeIntoImport}
      onLoadVisualTreeIntoImport={loadVisualTreeIntoImport}
      onReplaceSelectedVisualNodeFromImport={replaceSelectedVisualNodeFromImport}
      onVisualImportDraftChange={(draft) => dispatchBuilder({ type: "setVisualImportDraft", draft })}
      canMoveOut={selectedVisualCanMoveOut}
      moveTargets={selectedVisualMoveTargets}
      styleScope={visualStyleScope}
      visualImportDraft={visualImportDraft}
      visualPortabilityMessage={visualPortabilityMessage}
    />
  ) : null;

  return (
    <section className="cmsBlockBuilderShell" aria-label="CMS Block Builder">
      <header className="pricingPanel cmsBlockBuilderTopbar">
        <div>
          <span>Contexto</span>
          <strong>{contextLabel}</strong>
        </div>
        <form className="cmsBlockBuilderPageSelector" action="/admin/cms/builder">
          <input name="locale" type="hidden" value={locale} />
          <label className="adminField">
            <span>Pagina</span>
            <select name="pageId" defaultValue={initialPageId ?? ""}>
              <option value="">Canvas libre</option>
              {initialPageId && !pageOptions.some((page) => page.pageId === initialPageId) ? (
                <option value={initialPageId}>{initialPageId}</option>
              ) : null}
              {pageOptions.map((page) => (
                <option key={page.pageId} value={page.pageId}>
                  {page.title} - {page.status} - {page.pageType}
                </option>
              ))}
            </select>
          </label>
          <button className="adminButton" type="submit">Abrir</button>
        </form>
      </header>

      <section className="pricingPanel cmsBlockBuilderLoadedPage" aria-label="Pagina cargada">
        {pageSummary ? (
          <>
            <div>
              <span>Pagina cargada</span>
              <strong>{pageSummary.title}</strong>
              <small>{pageSummary.path} - {pageSummary.status} - {pageSummary.versionLabel}</small>
            </div>
            <dl className="pricingDefinitionGrid">
              <div>
                <dt>Template</dt>
                <dd>{resolvedSummary?.templateId ?? "sin plantilla"}</dd>
              </div>
              <div>
                <dt>Slots</dt>
                <dd>{resolvedSummary?.moduleSlots ?? 0}</dd>
              </div>
              <div>
                <dt>Modulos resueltos</dt>
                <dd>{resolvedSummary?.modules ?? blocks.length}</dd>
              </div>
              <div>
                <dt>Max width</dt>
                <dd>{resolvedSummary?.maxWidth ?? "pendiente"}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{resolvedCanvas ? "aplicados" : "pendientes"}</dd>
              </div>
            </dl>
            <form action={saveDraftAction} className="cmsBlockBuilderSavePanel">
              <input name="pageId" type="hidden" value={pageSummary.pageId} />
              <input name="locale" type="hidden" value={locale} />
              <input name="pageType" type="hidden" value={pageSummary.pageType} />
              <input name="title" type="hidden" value={pageSummary.title} />
              <input name="path" type="hidden" value={pageSummary.path} />
              <input name="seoTitle" type="hidden" value={pageSummary.seoTitle} />
              <input name="seoDescription" type="hidden" value={pageSummary.seoDescription} />
              <input name="blocksJson" type="hidden" value={serialized} />
              <div>
                <strong>{hasLocalChanges ? "Cambios locales pendientes" : "Sin cambios locales"}</strong>
                <small>{pageSummary.canSaveDraft ? "Guarda el canvas como draft CMS." : "Publica o despublica desde Paginas; los cambios solo se guardan en borradores."}</small>
                {visualModulesForSave.length > 0 ? (
                  <small>
                    {visualModulesForSave.length} visual.module listo(s): {visualModulesForSave.map((module) => `${module.name} (${module.nodes} nodos)`).join(", ")}
                  </small>
                ) : null}
                {saveDisabledReason ? <small className="cmsBlockBuilderSaveBlocked">{saveDisabledReason}</small> : null}
              </div>
              <button className="adminButton adminButtonPrimary" disabled={!canSubmitDraft} title={saveDisabledReason ?? undefined} type="submit">
                Guardar draft desde Builder
              </button>
            </form>
          </>
        ) : (
          <div>
            <span>Canvas libre</span>
            <strong>Sin pagina cargada</strong>
            <small>Selecciona una pagina para inicializar el Builder con bloques reales de CMS.</small>
          </div>
        )}
      </section>

      <section
        className={`cmsBlockBuilderValidation ${validationErrorCount > 0 ? "cmsBlockBuilderValidationError" : validationWarningCount > 0 ? "cmsBlockBuilderValidationWarning" : "cmsBlockBuilderValidationOk"}`}
        role={validationErrorCount > 0 ? "alert" : "status"}
      >
        <div>
          <strong>{validationErrorCount > 0 ? `${validationErrorCount} errores de builder` : validationWarningCount > 0 ? `${validationWarningCount} avisos de builder` : "Builder listo"}</strong>
          <span>{validationStatusMessage}</span>
        </div>
        {validationIssues.length > 0 ? (
          <ul>
            {validationIssues.slice(0, 6).map((issue) => (
              <li key={`${issue.severity}-${issue.blockId ?? "canvas"}-${issue.message}`}>
                <button
                  className="cmsBlockBuilderIssueButton"
                  disabled={!issue.blockId}
                  onClick={() => issue.blockId ? dispatchBuilder({ type: "selectBlock", blockId: issue.blockId }) : undefined}
                  type="button"
                >
                  <strong>{issue.severity === "error" ? "Error" : "Aviso"}</strong>
                  <span>{issue.message}</span>
                </button>
              </li>
            ))}
            {validationIssues.length > 6 ? <li>{validationIssues.length - 6} avisos adicionales.</li> : null}
          </ul>
        ) : null}
      </section>

      <div className="cmsBlockBuilderWorkspace">
        <aside className="cmsBlockBuilderLibrary" aria-label="Biblioteca de bloques">
          <div className="pricingPanelHeader">
            <div>
              <h2>Bloques</h2>
              <p>{totalBlockLibraryItems} bloques disponibles</p>
            </div>
          </div>
          <div className="cmsBlockBuilderPresetList">
            <button
              className="adminButton adminButtonPrimary cmsBlockBuilderCreateVisualButton"
              disabled={!canCreateVisualModules}
              onClick={addBlankVisualModuleBlock}
              type="button"
            >
              <strong>Crear nuevo módulo</strong>
              <span>visual.module editable desde cero</span>
            </button>
            {visualBlockPresets.length > 0 ? (
              <div className="cmsBlockBuilderSavedBlocks" aria-label="Bloques visuales">
                <span>Bloques visuales</span>
                {visualBlockPresets.map((preset) => (
                  <button
                    className="adminButton"
                    key={`visual-${preset.presetId}`}
                    onClick={() => applyVisualModulePresetAsBlock(preset.presetId)}
                    type="button"
                  >
                    <strong>{visualModulePresetDisplayName(preset)}</strong>
                    <span>{preset.source === "system" ? "SYSTEM visual.module" : "CMS visual.module guardado"}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {definitions.map((definition) => (
              definition.type === "visual.module" ? null : (
              <button
                className="adminButton"
                key={definition.type}
                onClick={() => addBlock(definition.type)}
                type="button"
              >
                <strong>{definition.label}</strong>
                <span>{definition.surface === "plp" ? "PLP" : definition.supportedSurfaces.join(" / ")}</span>
              </button>
              )
            ))}
          </div>
          <VisualNodeLibrary
            onAddNode={addVisualNodeToSelectedBlock}
            selectedNode={selectedVisualNode}
            selectedBlock={selectedBlock}
          />
          <VisualModulePresetLibrary
            currentBlocksJson={serialized}
            initialPageId={initialPageId}
            locale={locale}
            onApplyPresetAsBlock={applyVisualModulePresetAsBlock}
            onInsertDefinitionReference={addCmsVisualModuleReference}
            onDeletePreset={deleteVisualModulePreset}
            onPresetNameChange={(name) => dispatchBuilder({ type: "setVisualPresetName", name })}
            onReplaceSelectedWithPreset={replaceSelectedVisualModuleWithPreset}
            onSavePreset={saveSelectedVisualModulePreset}
            presets={visualModulePresets}
            pageSummary={pageSummary}
            saveDefinitionAction={saveVisualModuleDefinitionAction}
            selectedBlock={selectedBlock}
            selectedVisualDefinitionModuleJson={selectedVisualDefinitionModuleJson}
            selectedVisualDefinitionName={selectedVisualDefinitionName}
            visualDefinitions={visualModules}
            visualPresetMessage={visualPresetMessage}
            visualPresetName={visualPresetName}
          />
          {mediaUploads.length > 0 ? (
            <section className="cmsBlockBuilderMediaUploads" aria-label="Uploads de media del Builder">
              <div className="pricingPanelHeader">
                <div>
                  <h2>Media</h2>
                  <p>{mediaUploads.length} operacion(es)</p>
                </div>
              </div>
              <ul>
                {mediaUploads.map((upload) => (
                  <li key={upload.assetKey}>
                    <strong>{upload.assetKey}</strong>
                    <span>{upload.status}{upload.message ? ` - ${upload.message}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        <section className="cmsBlockBuilderCanvas" aria-label="Canvas">
          <div className="cmsBlockBuilderCanvasToolbar">
            <div className="adminButtonRow" role="group" aria-label="Superficie">
              {(["page", "plp"] as const).map((item) => (
                <button
                  className={surface === item ? "adminButton adminButtonPrimary" : "adminButton"}
                  key={item}
                  onClick={() => dispatchBuilder({ type: "setSurface", surface: item })}
                  type="button"
                >
                  {item === "page" ? "Pagina" : "PLP"}
                </button>
              ))}
            </div>
            <div className="adminButtonRow" role="group" aria-label="Viewport">
              {(Object.keys(viewportLabels) as BuilderViewport[]).map((item) => (
                <button
                  className={viewport === item ? "adminButton adminButtonPrimary" : "adminButton"}
                  key={item}
                  onClick={() => dispatchBuilder({ type: "setViewport", viewport: item })}
                  type="button"
                >
                  {viewportLabels[item]}
                </button>
              ))}
            </div>
            <div className="adminButtonRow" role="group" aria-label="Historial del Builder">
              <button className="adminIconButton" disabled={!canUndo} onClick={() => dispatchBuilder({ type: "undo" })} type="button" aria-label="Deshacer cambio">
                <Undo2 size={16} aria-hidden="true" />
              </button>
              <button className="adminIconButton" disabled={!canRedo} onClick={() => dispatchBuilder({ type: "redo" })} type="button" aria-label="Rehacer cambio">
                <Redo2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className={`cmsBlockBuilderPreviewFrame cmsBlockBuilderPreviewFrame${viewportLabels[viewport]}`}>
            {surface === "plp" ? (
              <CmsPlpStorefrontPreviewRenderer blocks={blocks} />
            ) : resolvedCanvas ? (
              <ResolvedPageCanvas
                blocks={filteredBlocks}
                onDuplicateBlock={duplicateBlock}
                onMoveBlock={moveBlock}
                onRemoveBlock={removeBlock}
                onSelectBlock={(blockId) => dispatchBuilder({ type: "selectBlock", blockId })}
                resolvedCanvas={resolvedCanvas}
                selectedBlockId={selectedBlockId}
                unplacedBlocks={pageUnplacedBlocks}
                viewport={viewport}
              />
            ) : filteredBlocks.length > 0 ? (
              filteredBlocks.map((block) => (
                <BuilderPreviewItem
                  active={selectedBlockId === block.blockId}
                  block={block}
                  key={block.blockId}
                  onDuplicate={duplicateBlock}
                  onMove={moveBlock}
                  onRemove={removeBlock}
                  onSelect={(blockId) => dispatchBuilder({ type: "selectBlock", blockId })}
                  viewport={viewport}
                />
              ))
            ) : (
              <div className="adminEmptyState">No hay bloques de pagina en el canvas.</div>
            )}
          </div>
        </section>

        <aside className="cmsBlockBuilderInspector" aria-label="Inspector">
          <div className="pricingPanelHeader">
            <div>
              <h2>Inspector</h2>
              <p>{selectedBlock ? blockTitle(selectedBlock) : "Sin seleccion"}</p>
            </div>
          </div>

          {selectedBlock ? (
            <>
              <dl className="pricingDefinitionGrid cmsBlockBuilderMeta">
                <div>
                  <dt>Tipo</dt>
                  <dd>{selectedBlock.type}</dd>
                </div>
                <div>
                  <dt>Superficie</dt>
                  <dd>{blockSurfaceLabel(selectedBlock)}</dd>
                </div>
                <div>
                  <dt>Block ID</dt>
                  <dd>{selectedBlock.blockId}</dd>
                </div>
              </dl>
              <div className="adminButtonRow">
                <button className="adminIconButton" onClick={() => moveSelectedBlock(-1)} type="button" aria-label="Subir bloque seleccionado">
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button className="adminIconButton" onClick={() => moveSelectedBlock(1)} type="button" aria-label="Bajar bloque seleccionado">
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button className="adminIconButton" onClick={duplicateSelectedBlock} type="button" aria-label="Duplicar bloque seleccionado">
                  <CopyPlus size={16} aria-hidden="true" />
                </button>
                <button className="adminIconButton adminIconButtonDanger" onClick={removeSelectedBlock} type="button" aria-label="Eliminar bloque seleccionado">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              {selectedVisualTree ? (
                <VisualNodeTreeEditor
                  onDuplicateNode={duplicateVisualNode}
                  onMoveNode={moveVisualNode}
                  onRemoveNode={removeVisualNode}
                  onSelectNode={(nodeId) => dispatchBuilder({ type: "selectVisualNode", nodeId })}
                  selectedNodeId={selectedVisualNode?.nodeId ?? selectedVisualTree.nodeId}
                  tree={selectedVisualTree}
                />
              ) : null}
              {selectedVisualTreeIsEmpty ? (
                <VisualModuleStarter onAddNode={addVisualNodeToSelectedBlock} />
              ) : null}
              {selectedVisualTree && !selectedVisualTreeIsEmpty && selectedVisualNode?.nodeId !== selectedVisualTree.nodeId ? (
                <button
                  className="adminButton cmsBlockBuilderVisualRootAction"
                  onClick={() => dispatchBuilder({ type: "selectVisualNode", nodeId: selectedVisualTree.nodeId })}
                  type="button"
                >
                  Editar root avanzado
                </button>
              ) : null}
              {!selectedVisualTreeIsEmpty ? selectedVisualNodeInspector : null}
              {selectedVisualNode && selectedVisualTreeIsEmpty ? (
                <details className="cmsBlockBuilderVisualAdvancedRoot">
                  <summary>Editar root avanzado</summary>
                  {selectedVisualNodeInspector}
                </details>
              ) : null}
              <BuilderBlockFields
                block={selectedBlock}
                moduleSlots={moduleSlots}
                onPlacementChange={updateSelectedPlacement}
                onPropChange={updateSelectedProp}
                onSurfaceChange={updateSelectedSurface}
                onTargetChange={updateSelectedTarget}
                placement={completePlacement(selectedBlock, resolvedCanvas, selectedBlockIndex + 1)}
              />
            </>
          ) : (
            <div className="adminEmptyState">Selecciona un bloque del canvas.</div>
          )}

          <section className="cmsBlockBuilderPortablePanel" aria-label="Portabilidad JSON">
            <div className="pricingPanelHeader">
              <div>
                <h2>Portabilidad JSON</h2>
                <p>Import / export</p>
              </div>
            </div>
            <div className="cmsBlockBuilderPortabilityActions">
              <button className="adminIconButton" onClick={copyExportJson} type="button" aria-label="Copiar JSON">
                <Clipboard size={16} aria-hidden="true" />
              </button>
              <button className="adminIconButton" onClick={loadCurrentExportIntoImport} type="button" aria-label="Cargar export actual">
                <FileJson size={16} aria-hidden="true" />
              </button>
            </div>
            {exportMessage ? <small className="cmsBlockBuilderImportMessage">{exportMessage}</small> : null}
            <label className="adminField cmsBlockBuilderJson">
              <span>Export JSON</span>
              <textarea readOnly value={serialized} />
            </label>
            <label className="adminField cmsBlockBuilderJson">
              <span>Import JSON</span>
              <textarea value={importDraft} onChange={(event) => dispatchBuilder({ type: "setImportDraft", draft: event.target.value })} />
            </label>
            <button className="adminButton" onClick={applyImportedBlocks} type="button">
              <Upload size={16} aria-hidden="true" />
              <span>Aplicar JSON</span>
            </button>
            {importMessage ? <small className="cmsBlockBuilderImportMessage">{importMessage}</small> : null}
          </section>
        </aside>
      </div>
    </section>
  );
}

function VisualModulePresetLibrary({
  currentBlocksJson,
  initialPageId,
  locale,
  onApplyPresetAsBlock,
  onInsertDefinitionReference,
  onDeletePreset,
  onPresetNameChange,
  onReplaceSelectedWithPreset,
  onSavePreset,
  pageSummary,
  presets,
  saveDefinitionAction,
  selectedBlock,
  selectedVisualDefinitionModuleJson,
  selectedVisualDefinitionName,
  visualDefinitions,
  visualPresetMessage,
  visualPresetName,
}: {
  currentBlocksJson: string;
  initialPageId?: string;
  locale: string;
  onApplyPresetAsBlock: (presetId: string) => void;
  onInsertDefinitionReference: (definitionId: string) => void;
  onDeletePreset: (presetId: string) => void;
  onPresetNameChange: (value: string) => void;
  onReplaceSelectedWithPreset: (presetId: string) => void;
  onSavePreset: () => void;
  pageSummary: CmsBlockBuilderPageSummary | null;
  presets: CmsVisualModulePreset[];
  saveDefinitionAction: (formData: FormData) => void | Promise<void>;
  selectedBlock: CmsBlock | null;
  selectedVisualDefinitionModuleJson: string;
  selectedVisualDefinitionName: string;
  visualDefinitions: CmsVisualModuleDefinitionsList;
  visualPresetMessage: string | null;
  visualPresetName: string;
}) {
  const canSaveOrReplace = selectedBlock?.type === "visual.module";
  const selectedVisualDefinitionId = typeof selectedBlock?.props.definitionId === "string" && selectedBlock.props.definitionId.trim()
    ? selectedBlock.props.definitionId.trim()
    : "";
  const selectedBlockIsCmsReference = selectedBlock?.props.visualDefinitionReference === true || Boolean(selectedVisualDefinitionId);
  const canPublishSelectedBlock = canSaveOrReplace && !selectedBlockIsCmsReference;
  const canCreateDefinitionFromSelectedBlock = canSaveOrReplace && !selectedBlockIsCmsReference;
  const canSaveBlock = canSaveOrReplace || presets.length > 0;
  const activeDefinitions = visualDefinitions.items.filter((definition) => definition.status === "ACTIVE");
  const draftDefinitions = visualDefinitions.items.filter((definition) => definition.status === "DRAFT");

  return (
    <section className="cmsBlockBuilderVisualPresets" aria-label="Presets visuales">
      <div className="pricingPanelHeader">
        <div>
          <h2>Presets visuales</h2>
          <p>{presets.length ? `${presets.length} presets disponibles` : "Sin presets visuales"}</p>
        </div>
      </div>
      <label className="adminField">
        <span>Nombre preset local</span>
        <input value={visualPresetName} onChange={(event) => onPresetNameChange(event.target.value)} />
      </label>
      <button className="adminButton" disabled={!canSaveBlock} onClick={onSavePreset} type="button">
        Guardar en lista de bloques
      </button>
      {activeDefinitions.length > 0 ? (
        <div className="cmsBlockBuilderVisualDefinitionList" aria-label="Definiciones CMS activas">
          {activeDefinitions.map((definition) => (
            <article className="cmsBlockBuilderVisualDefinitionItem" key={definition.definitionId}>
              <div>
                <strong>{definition.name}</strong>
                <span>ACTIVE - rev {definition.revision} - {definition.moduleId}</span>
              </div>
              <div className="cmsBlockBuilderVisualDefinitionItemActions">
                <button className="adminButton" onClick={() => onInsertDefinitionReference(definition.definitionId)} type="button">
                  Insertar referencia
                </button>
                <form action={saveDefinitionAction} className="cmsBlockBuilderVisualDefinitionArchiveForm">
                  <input name="pageId" type="hidden" value={initialPageId ?? ""} />
                  <input name="locale" type="hidden" value={locale} />
                  <input name="visualDefinitionId" type="hidden" value={definition.definitionId} />
                  <button className="adminButton" name="visualDefinitionIntent" type="submit" value="createDraftRevision">
                    Nueva revision
                  </button>
                </form>
                <form action={saveDefinitionAction} className="cmsBlockBuilderVisualDefinitionArchiveForm">
                  <input name="pageId" type="hidden" value={initialPageId ?? ""} />
                  <input name="locale" type="hidden" value={locale} />
                  <input name="visualDefinitionId" type="hidden" value={definition.definitionId} />
                  <button className="adminButton adminButtonDanger" name="visualDefinitionIntent" type="submit" value="archive">
                    Archivar
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <form action={saveDefinitionAction} className="cmsBlockBuilderVisualDefinitionForm">
        <input name="pageId" type="hidden" value={initialPageId ?? ""} />
        <input name="locale" type="hidden" value={locale} />
        <input name="visualBlockId" type="hidden" value={selectedBlock?.blockId ?? ""} />
        <input name="blocksJson" type="hidden" value={currentBlocksJson} />
        {pageSummary ? (
          <>
            <input name="pageType" type="hidden" value={pageSummary.pageType} />
            <input name="title" type="hidden" value={pageSummary.title} />
            <input name="path" type="hidden" value={pageSummary.path} />
            <input name="seoTitle" type="hidden" value={pageSummary.seoTitle} />
            <input name="seoDescription" type="hidden" value={pageSummary.seoDescription} />
          </>
        ) : null}
        <input name="visualModuleJson" type="hidden" value={selectedVisualDefinitionModuleJson} />
        <label className="adminField">
          <span>Nombre CMS</span>
          <input
            key={selectedBlock?.blockId ?? "cms-visual-definition-name"}
            defaultValue={selectedVisualDefinitionName}
            name="visualDefinitionName"
          />
        </label>
        {selectedBlockIsCmsReference ? (
          <button className="adminButton" disabled type="button">
            Publicado en CMS
          </button>
        ) : (
          <button className="adminButton adminButtonPrimary" disabled={!canPublishSelectedBlock} name="visualDefinitionIntent" type="submit" value="publish">
            Publicar modulo
          </button>
        )}
        <button className="adminButton" disabled={!canCreateDefinitionFromSelectedBlock} name="visualDefinitionIntent" type="submit" value="create">
          Guardar en CMS
        </button>
        <label className="adminField">
          <span>Draft CMS</span>
          <select name="visualDefinitionId" defaultValue="" disabled={draftDefinitions.length === 0}>
            <option value="">Selecciona draft CMS</option>
            {draftDefinitions.map((definition) => (
              <option key={definition.definitionId} value={definition.definitionId}>
                {definition.name} rev {definition.revision}
              </option>
            ))}
          </select>
        </label>
        <div className="cmsBlockBuilderVisualDefinitionActions">
          <button className="adminButton" disabled={!canSaveOrReplace || draftDefinitions.length === 0} name="visualDefinitionIntent" type="submit" value="updateDraft">
            Actualizar draft
          </button>
          <button className="adminButton" disabled={draftDefinitions.length === 0} name="visualDefinitionIntent" type="submit" value="activate">
            Activar
          </button>
          <button className="adminButton adminButtonDanger" disabled={draftDefinitions.length === 0} name="visualDefinitionIntent" type="submit" value="archive">
            Archivar
          </button>
        </div>
      </form>
      {presets.length > 0 ? (
        <div className="cmsBlockBuilderVisualPresetList">
          {presets.map((preset) => (
            <article className="cmsBlockBuilderVisualPresetItem" key={preset.presetId}>
              <div>
                <strong>{preset.name} v{preset.version}</strong>
                <span>{preset.source === "system" ? "SYSTEM" : preset.status} · rev {preset.revision} · schema {preset.schemaVersion}.{preset.schemaMinorVersion} · {countVisualNodes(preset.tree)} nodos</span>
              </div>
              <div className="cmsBlockBuilderVisualPresetActions">
                <button className="adminButton" onClick={() => onApplyPresetAsBlock(preset.presetId)} type="button">
                  Insertar
                </button>
                <button className="adminButton" disabled={!canSaveOrReplace} onClick={() => onReplaceSelectedWithPreset(preset.presetId)} type="button">
                  Reemplazar
                </button>
                <button className="adminIconButton adminIconButtonDanger" disabled={preset.source === "system"} onClick={() => onDeletePreset(preset.presetId)} type="button" aria-label={`Eliminar preset ${preset.name} v${preset.version}`}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="cmsBlockBuilderVisualHint">
          Guarda versiones de cualquier modulo visual para reutilizarlas desde la lista de bloques.
        </div>
      )}
      {visualPresetMessage ? <small className="cmsBlockBuilderImportMessage">{visualPresetMessage}</small> : null}
    </section>
  );
}

function VisualNodeLibrary({
  onAddNode,
  selectedNode,
  selectedBlock,
}: {
  onAddNode: (type: CmsVisualNodeType) => void;
  selectedNode: CmsVisualNode | null;
  selectedBlock: CmsBlock | null;
}) {
  const isVisualModule = selectedBlock?.type === "visual.module";
  const visualTree = isVisualModule ? normalizeCmsVisualModuleProps(selectedBlock.props).tree : null;
  const currentNodeCount = visualTree ? countVisualNodes(visualTree) : 0;

  return (
    <section className="cmsBlockBuilderVisualNodes" aria-label="Nodos visuales">
      <div className="pricingPanelHeader">
        <div>
          <h2>Nodos visuales</h2>
          <p>{isVisualModule ? `${currentNodeCount} nodos - destino: ${selectedNode?.label ?? selectedNode?.type ?? "root"}` : "Selecciona visual.module"}</p>
        </div>
      </div>
      {!isVisualModule ? (
        <div className="cmsBlockBuilderVisualHint">
          Selecciona o crea un bloque Modulo visual para activar esta biblioteca.
        </div>
      ) : (
        <div className="cmsBlockBuilderVisualNodeGrid">
          {visualNodeCatalog.map((node) => (
            <button
              className="cmsBlockBuilderVisualNodeButton"
              key={node.type}
              onClick={() => onAddNode(node.type)}
              type="button"
            >
              <strong>{node.label}</strong>
              <span>{node.description}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function VisualModuleStarter({ onAddNode }: { onAddNode: (type: CmsVisualNodeType) => void }) {
  const starterNodes = visualStarterNodeTypes
    .map((type) => visualNodeCatalog.find((node) => node.type === type))
    .filter((node): node is typeof visualNodeCatalog[number] => Boolean(node));

  return (
    <section className="cmsBlockBuilderVisualStarter" aria-label="Construir modulo visual">
      <div className="pricingPanelHeader">
        <div>
          <h2>Construir modulo</h2>
          <p>Agrega el primer nodo dentro de root.</p>
        </div>
      </div>
      <div className="cmsBlockBuilderVisualStarterGrid">
        {starterNodes.map((node) => (
          <button
            className="cmsBlockBuilderVisualNodeButton"
            key={`starter-${node.type}`}
            onClick={() => onAddNode(node.type)}
            type="button"
          >
            <strong>{node.label}</strong>
            <span>{node.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function VisualNodeTreeEditor({
  onDuplicateNode,
  onMoveNode,
  onRemoveNode,
  onSelectNode,
  selectedNodeId,
  tree,
}: {
  onDuplicateNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, direction: -1 | 1) => void;
  onRemoveNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string;
  tree: CmsVisualNode;
}) {
  return (
    <section className="cmsBlockBuilderVisualTree" aria-label="Arbol visual">
      <div className="pricingPanelHeader">
        <div>
          <h2>Arbol visual</h2>
          <p>Selecciona el nodo destino para insertar hijos.</p>
        </div>
      </div>
      <ul className="cmsBlockBuilderVisualTreeList">
        <VisualNodeTreeItem
          depth={0}
          node={tree}
          onDuplicateNode={onDuplicateNode}
          onMoveNode={onMoveNode}
          onRemoveNode={onRemoveNode}
          onSelectNode={onSelectNode}
          selectedNodeId={selectedNodeId}
        />
      </ul>
    </section>
  );
}

function VisualNodeTreeItem({
  depth,
  node,
  onDuplicateNode,
  onMoveNode,
  onRemoveNode,
  onSelectNode,
  selectedNodeId,
}: {
  depth: number;
  node: CmsVisualNode;
  onDuplicateNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, direction: -1 | 1) => void;
  onRemoveNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  selectedNodeId: string;
}) {
  const isRoot = depth === 0;
  const isActive = selectedNodeId === node.nodeId;
  return (
    <li className="cmsBlockBuilderVisualTreeItem">
      <div className={isActive ? "cmsBlockBuilderVisualTreeRow cmsBlockBuilderVisualTreeRowActive" : "cmsBlockBuilderVisualTreeRow"} style={{ paddingLeft: depth * 12 }}>
        <button
          className="cmsBlockBuilderVisualTreeSelect"
          onClick={() => onSelectNode(node.nodeId)}
          type="button"
        >
          <strong>{node.label ?? node.type}</strong>
          <span>{node.type} - {node.children?.length ?? 0} hijos</span>
        </button>
        <div className="cmsBlockBuilderVisualTreeActions" aria-label={`Acciones ${node.label ?? node.type}`}>
          <button className="adminIconButton" disabled={isRoot} onClick={() => onMoveNode(node.nodeId, -1)} type="button" aria-label="Subir nodo">
            <ArrowUp size={13} aria-hidden="true" />
          </button>
          <button className="adminIconButton" disabled={isRoot} onClick={() => onMoveNode(node.nodeId, 1)} type="button" aria-label="Bajar nodo">
            <ArrowDown size={13} aria-hidden="true" />
          </button>
          <button className="adminIconButton" disabled={isRoot} onClick={() => onDuplicateNode(node.nodeId)} type="button" aria-label="Duplicar nodo">
            <CopyPlus size={13} aria-hidden="true" />
          </button>
          <button className="adminIconButton adminIconButtonDanger" disabled={isRoot} onClick={() => onRemoveNode(node.nodeId)} type="button" aria-label="Eliminar nodo">
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
      {node.children?.length ? (
        <ul className="cmsBlockBuilderVisualTreeList">
          {node.children.map((child) => (
            <VisualNodeTreeItem
              depth={depth + 1}
              key={child.nodeId}
              node={child}
              onDuplicateNode={onDuplicateNode}
              onMoveNode={onMoveNode}
              onRemoveNode={onRemoveNode}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function VisualNodeInspector({
  assetRefs,
  canMoveOut,
  mediaUploads,
  moveTargets,
  node,
  onApplyVisualImportAsChild,
  onContentBindingChange,
  onCopySelectedVisualNodeJson,
  onCopyVisualTreeJson,
  onClearHover,
  onLabelChange,
  onAnimationChange,
  onHoverStylesChange,
  onHoverTransitionChange,
  onLoadSelectedVisualNodeIntoImport,
  onLoadVisualTreeIntoImport,
  onMoveOut,
  onMoveToParent,
  onMediaRemove,
  onMediaUpload,
  onPropChange,
  onReplaceSelectedVisualNodeFromImport,
  onReplaceStyleScope,
  onResponsiveStyleChange,
  onStyleScopeChange,
  onStyleChange,
  onVisibilityChange,
  onVisualImportDraftChange,
  styleScope,
  visualImportDraft,
  visualPortabilityMessage,
}: {
  assetRefs: CmsVisualAssetRef[];
  canMoveOut: boolean;
  mediaUploads: CmsBlockBuilderMediaUploadState[];
  moveTargets: CmsVisualNodeMoveTarget[];
  node: CmsVisualNode;
  onApplyVisualImportAsChild: () => void;
  onContentBindingChange: (value: string) => void;
  onCopySelectedVisualNodeJson: () => void | Promise<void>;
  onCopyVisualTreeJson: () => void | Promise<void>;
  onClearHover: () => void;
  onLabelChange: (value: string) => void;
  onAnimationChange: (key: keyof NonNullable<CmsVisualNode["animation"]>, value: string) => void;
  onHoverStylesChange: (styles: Partial<Record<CmsVisualHoverStyleKey, string>>) => void;
  onHoverTransitionChange: (
    key: keyof CmsVisualInteractionTransition,
    value: string,
  ) => void;
  onLoadSelectedVisualNodeIntoImport: () => void;
  onLoadVisualTreeIntoImport: () => void;
  onMoveOut: () => void;
  onMoveToParent: (targetParentNodeId: string) => void;
  onMediaRemove: (target: CmsVisualMediaUploadTarget, assetKey: string) => void;
  onMediaUpload: (target: CmsVisualMediaUploadTarget, file: File, requestedAssetKey?: string) => void | Promise<void>;
  onPropChange: (key: CmsVisualNodeEditableProp, value: string) => void;
  onReplaceSelectedVisualNodeFromImport: () => void;
  onReplaceStyleScope: (scope: CmsVisualStyleScope, styles: CmsVisualNodeStyle) => void;
  onResponsiveStyleChange: (breakpoint: CmsVisualBreakpoint, key: keyof CmsVisualNodeStyle, value: string) => void;
  onStyleScopeChange: (scope: CmsVisualStyleScope) => void;
  onStyleChange: (key: keyof CmsVisualNodeStyle, value: string) => void;
  onVisibilityChange: (breakpoint: CmsVisualBreakpoint, value: boolean) => void;
  onVisualImportDraftChange: (value: string) => void;
  styleScope: CmsVisualStyleScope;
  visualImportDraft: string;
  visualPortabilityMessage: string | null;
}) {
  const propFields = visualNodePropFields.filter((field) => !field.nodeTypes || field.nodeTypes.includes(node.type));
  const scopedStyles = styleScope === "base" ? node.styles : node.responsiveStyles?.[styleScope];
  const styleTarget = visualStyleTargetForNode(node);
  const styleJsonValue = useMemo(() => JSON.stringify(scopedStyles ?? {}, null, 2), [scopedStyles]);
  const styleDraftKey = `${node.nodeId}:${styleScope}:${styleJsonValue}`;
  const [styleJsonState, setStyleJsonState] = useState<{ draft: string; key: string; message: string | null }>({
    draft: styleJsonValue,
    key: styleDraftKey,
    message: null,
  });
  const styleJsonDraft = styleJsonState.key === styleDraftKey ? styleJsonState.draft : styleJsonValue;
  const styleJsonMessage = styleJsonState.key === styleDraftKey ? styleJsonState.message : null;
  const hoverJsonValue = useMemo(
    () => JSON.stringify(node.interactions?.hover?.styles ?? {}, null, 2),
    [node.interactions?.hover?.styles],
  );
  const hoverDraftKey = `${node.nodeId}:hover:${hoverJsonValue}`;
  const [hoverJsonState, setHoverJsonState] = useState<{ draft: string; key: string; message: string | null }>({
    draft: hoverJsonValue,
    key: hoverDraftKey,
    message: null,
  });
  const hoverJsonDraft = hoverJsonState.key === hoverDraftKey ? hoverJsonState.draft : hoverJsonValue;
  const hoverJsonMessage = hoverJsonState.key === hoverDraftKey ? hoverJsonState.message : null;
  const visibleStyleFields = useMemo(
    () => visualStylePropertyRegistry.filter((field) => visualStylePropertyVisible(field, node, scopedStyles)),
    [node, scopedStyles],
  );
  const uploadByAssetKey = useMemo(
    () => new Map(mediaUploads.map((upload) => [upload.assetKey, upload])),
    [mediaUploads],
  );

  function setStyleJsonFeedback(draft: string, message: string | null) {
    setStyleJsonState({ draft, key: styleDraftKey, message });
  }

  function setScopedStyleValue(key: keyof CmsVisualNodeStyle, value: string) {
    if (!isVisualStyleValueSafe(key, value)) {
      setStyleJsonFeedback(styleJsonDraft, "Valor CSS no permitido.");
      return;
    }
    if (styleScope === "base") {
      onStyleChange(key, value);
      return;
    }
    onResponsiveStyleChange(styleScope, key, value);
  }

  function applyStyleJsonDraft(value: string) {
    if (!value.trim()) {
      onReplaceStyleScope(styleScope, {});
      setStyleJsonFeedback(value, "Scope limpio.");
      return;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      const nextStyles = normalizeVisualStyleJsonObject(parsed);
      if (!nextStyles) {
        setStyleJsonFeedback(value, "JSON de estilos invalido o con keys fuera del registry.");
        return;
      }
      const invalidTargetKey = Object.keys(nextStyles).find((key) => {
        const field = visualStylePropertyRegistry.find((candidate) => candidate.key === key);
        return !field || !field.appliesTo.includes(styleTarget);
      });
      if (invalidTargetKey) {
        setStyleJsonFeedback(value, `${invalidTargetKey} no aplica a ${styleTarget}.`);
        return;
      }
      onReplaceStyleScope(styleScope, nextStyles);
      setStyleJsonFeedback(value, "JSON sincronizado con inputs y preview.");
    } catch {
      setStyleJsonFeedback(value, "JSON pendiente de completar.");
    }
  }

  function setHoverJsonFeedback(draft: string, message: string | null) {
    setHoverJsonState({ draft, key: hoverDraftKey, message });
  }

  function applyHoverJsonDraft(value: string) {
    if (!value.trim()) {
      onHoverStylesChange({});
      setHoverJsonFeedback(value, "Hover limpio.");
      return;
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      const result = normalizeVisualHoverStyleJsonObject(parsed);
      if (result.error) {
        setHoverJsonFeedback(value, result.error);
        return;
      }
      const invalidTargetKey = Object.keys(result.styles).find((key) => {
        const field = visualStylePropertyRegistry.find((candidate) => candidate.key === key);
        return !field || !field.appliesTo.includes(styleTarget);
      });
      if (invalidTargetKey) {
        setHoverJsonFeedback(value, `${invalidTargetKey} no aplica a ${styleTarget}.`);
        return;
      }
      onHoverStylesChange(result.styles);
      setHoverJsonFeedback(value, "Hover sincronizado con preview.");
    } catch {
      setHoverJsonFeedback(value, "JSON hover pendiente de completar.");
    }
  }

  return (
    <section className="cmsBlockBuilderVisualInspector" aria-label="Inspector de nodo visual">
      <div className="pricingPanelHeader">
        <div>
          <h2>Nodo seleccionado</h2>
          <p>{node.type} - {node.nodeId}</p>
        </div>
      </div>
      <label className="adminField">
        <span>Label</span>
        <input value={node.label ?? ""} onChange={(event) => onLabelChange(event.target.value)} />
      </label>
      <label className="adminField">
        <span>Content binding</span>
        <input value={node.contentBinding ?? ""} onChange={(event) => onContentBindingChange(event.target.value)} placeholder="heading, text, buttonText" />
      </label>
      <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>Visibility</legend>
        <div className="cmsBlockBuilderSegmentedControl" role="group" aria-label="Visibilidad por viewport">
          {(["desktop", "tablet", "mobile"] as const).map((breakpoint) => (
            <label className="cmsBlockBuilderTogglePill" key={breakpoint}>
              <input
                checked={node.visibility?.[breakpoint] !== false}
                onChange={(event) => onVisibilityChange(breakpoint, event.target.checked)}
                type="checkbox"
              />
              <span>{viewportLabels[breakpoint]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>Motion</legend>
        <div className="cmsBlockBuilderVisualMotionGrid">
          <label className="adminField">
            <span>Preset</span>
            <select value={node.animation?.preset ?? "none"} onChange={(event) => onAnimationChange("preset", event.target.value)}>
              {visualAnimationPresets.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
            </select>
          </label>
          <label className="adminField">
            <span>Duration</span>
            <input max="2000" min="0" step="50" type="number" value={node.animation?.durationMs ?? 600} onChange={(event) => onAnimationChange("durationMs", event.target.value)} />
          </label>
          <label className="adminField">
            <span>Delay</span>
            <input max="2000" min="0" step="50" type="number" value={node.animation?.delayMs ?? 0} onChange={(event) => onAnimationChange("delayMs", event.target.value)} />
          </label>
          <label className="adminField">
            <span>Easing</span>
            <select value={node.animation?.easing ?? "standard"} onChange={(event) => onAnimationChange("easing", event.target.value)}>
              {visualAnimationEasings.map((easing) => <option key={easing} value={easing}>{easing}</option>)}
            </select>
          </label>
          <label className="adminField">
            <span>Trigger</span>
            <select value={node.animation?.trigger ?? "load"} onChange={(event) => onAnimationChange("trigger", event.target.value)}>
              {visualAnimationTriggers.map((trigger) => <option key={trigger} value={trigger}>{trigger}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>Hover</legend>
        <label className="adminField">
          <span>Hover styles JSON</span>
          <textarea
            onBlur={() => applyHoverJsonDraft(hoverJsonDraft)}
            onChange={(event) => {
              const draft = event.target.value;
              setHoverJsonFeedback(draft, null);
            }}
            rows={6}
            spellCheck={false}
            value={hoverJsonDraft}
          />
        </label>
        <div className="cmsBlockBuilderVisualMotionGrid">
          <label className="adminField">
            <span>Duration</span>
            <input
              max="2000"
              min="0"
              step="50"
              type="number"
              value={node.interactions?.hover?.transition?.durationMs ?? 160}
              onChange={(event) => onHoverTransitionChange("durationMs", event.target.value)}
            />
          </label>
          <label className="adminField">
            <span>Delay</span>
            <input
              max="2000"
              min="0"
              step="50"
              type="number"
              value={node.interactions?.hover?.transition?.delayMs ?? 0}
              onChange={(event) => onHoverTransitionChange("delayMs", event.target.value)}
            />
          </label>
          <label className="adminField">
            <span>Easing</span>
            <select
              value={node.interactions?.hover?.transition?.easing ?? "standard"}
              onChange={(event) => onHoverTransitionChange("easing", event.target.value)}
            >
              {visualAnimationEasings.map((easing) => <option key={easing} value={easing}>{easing}</option>)}
            </select>
          </label>
        </div>
        <div className="cmsBlockBuilderVisualActions">
          <button type="button" onClick={() => applyHoverJsonDraft(hoverJsonDraft)}>Aplicar hover</button>
          <button type="button" onClick={onClearHover}>Limpiar hover</button>
        </div>
        {hoverJsonMessage ? <p className="cmsBlockBuilderInlineNotice">{hoverJsonMessage}</p> : null}
      </fieldset>
      <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>Mover nodo</legend>
        <div className="cmsBlockBuilderVisualMoveControls">
          <label className="adminField">
            <span>Mover dentro de</span>
            <select value="" onChange={(event) => onMoveToParent(event.target.value)}>
              <option value="">Selecciona destino</option>
              {moveTargets.map((target) => (
                <option key={target.nodeId} value={target.nodeId}>
                  {"- ".repeat(target.depth)}{target.label} ({target.type})
                </option>
              ))}
            </select>
          </label>
          <button className="adminButton" disabled={!canMoveOut} onClick={onMoveOut} type="button">
            Sacar un nivel
          </button>
        </div>
      </fieldset>
      <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>Props</legend>
        {propFields.map((field) => (
          field.key === "src" && (node.type === "image" || node.type === "video") ? (
            <VisualMediaReferenceControl
              assetRef={visualAssetRefForValue(node.props?.[field.key] ?? "", assetRefs)}
              key={field.key}
              label={field.label}
              onChange={(value) => onPropChange(field.key, value)}
              onRemove={(assetKey) => onMediaRemove({ kind: "prop", key: field.key, role: node.type === "video" ? "video" : "image" }, assetKey)}
              onUpload={(file, assetKey) => onMediaUpload({ kind: "prop", key: field.key, role: node.type === "video" ? "video" : "image" }, file, assetKey)}
              upload={uploadByAssetKey.get(visualAssetRefForValue(node.props?.[field.key] ?? "", assetRefs)?.assetKey ?? "")}
              value={node.props?.[field.key] ?? ""}
            />
          ) :
          field.multiline ? (
            <label className="adminField cmsJsonField" key={field.key}>
              <span>{field.label}</span>
              <textarea
                value={node.props?.[field.key] ?? ""}
                onChange={(event) => onPropChange(field.key, event.target.value)}
              />
            </label>
          ) : (
            <label className="adminField" key={field.key}>
              <span>{field.label}</span>
              <input
                value={node.props?.[field.key] ?? ""}
                onChange={(event) => onPropChange(field.key, event.target.value)}
              />
            </label>
          )
        ))}
      </fieldset>
      <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>Styles responsive</legend>
        <div className="cmsBlockBuilderInspectorMeta">
          <span>Target: {styleTarget}</span>
          <span>{visibleStyleFields.length} controles activos</span>
        </div>
        <div className="cmsBlockBuilderVisualStyleScopes" role="group" aria-label="Scope de estilos visuales">
          {visualStyleScopes.map((scope) => (
            <button
              className={styleScope === scope ? "adminButton adminButtonPrimary" : "adminButton"}
              key={scope}
              onClick={() => onStyleScopeChange(scope)}
              type="button"
            >
              {visualStyleScopeLabels[scope]}
            </button>
          ))}
        </div>
        <div className="cmsBlockBuilderVisualStyleGrid">
          {visibleStyleFields.map((field) => (
            <VisualStylePropertyControl
              assetRef={visualAssetRefForValue(scopedStyles?.[field.key] ?? "", assetRefs)}
              field={field}
              key={field.key}
              onMediaRemove={(assetKey) => onMediaRemove({ kind: "style", key: field.key, role: "background" }, assetKey)}
              onMediaUpload={(file, assetKey) => onMediaUpload({ kind: "style", key: field.key, role: "background" }, file, assetKey)}
              onChange={(value) => setScopedStyleValue(field.key, value)}
              upload={uploadByAssetKey.get(visualAssetRefForValue(scopedStyles?.[field.key] ?? "", assetRefs)?.assetKey ?? "")}
              value={scopedStyles?.[field.key] ?? ""}
            />
          ))}
        </div>
        <label className="adminField cmsJsonField cmsBlockBuilderStyleJsonField">
          <span>Styles JSON directo</span>
          <textarea value={styleJsonDraft} onChange={(event) => applyStyleJsonDraft(event.target.value)} />
        </label>
        {styleJsonMessage ? <small className="cmsBlockBuilderImportMessage">{styleJsonMessage}</small> : null}
      </fieldset>
      <label className="adminField cmsJsonField">
        <span>Nodo JSON</span>
        <textarea readOnly value={JSON.stringify(node, null, 2)} />
      </label>
      <section className="cmsBlockBuilderVisualPortability" aria-label="Portabilidad visual JSON">
        <div className="pricingPanelHeader">
          <div>
            <h2>Portabilidad visual</h2>
            <p>Nodo o arbol JSON</p>
          </div>
        </div>
        <div className="cmsBlockBuilderPortabilityActions">
          <button className="adminIconButton" onClick={onCopySelectedVisualNodeJson} type="button" aria-label="Copiar nodo visual JSON">
            <Clipboard size={16} aria-hidden="true" />
          </button>
          <button className="adminIconButton" onClick={onCopyVisualTreeJson} type="button" aria-label="Copiar arbol visual JSON">
            <FileJson size={16} aria-hidden="true" />
          </button>
          <button className="adminButton" onClick={onLoadSelectedVisualNodeIntoImport} type="button">
            Cargar nodo
          </button>
          <button className="adminButton" onClick={onLoadVisualTreeIntoImport} type="button">
            Cargar arbol
          </button>
        </div>
        <label className="adminField cmsJsonField">
          <span>Import visual JSON</span>
          <textarea value={visualImportDraft} onChange={(event) => onVisualImportDraftChange(event.target.value)} />
        </label>
        <div className="cmsBlockBuilderVisualImportActions">
          <button className="adminButton" onClick={onApplyVisualImportAsChild} type="button">
            Importar como hijo
          </button>
          <button className="adminButton" onClick={onReplaceSelectedVisualNodeFromImport} type="button">
            Reemplazar nodo
          </button>
        </div>
        {visualPortabilityMessage ? <small className="cmsBlockBuilderImportMessage">{visualPortabilityMessage}</small> : null}
      </section>
    </section>
  );
}

function VisualStylePropertyControl({
  assetRef,
  field,
  onMediaRemove,
  onMediaUpload,
  onChange,
  upload,
  value,
}: {
  assetRef?: CmsVisualAssetRef;
  field: CmsVisualStylePropertyDefinition;
  onMediaRemove?: (assetKey: string) => void;
  onMediaUpload?: (file: File, requestedAssetKey?: string) => void | Promise<void>;
  onChange: (value: string) => void;
  upload?: CmsBlockBuilderMediaUploadState;
  value: string;
}) {
  const datalistId = `cms-style-${field.key}-suggestions`;
  const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#111827";
  const opacityValue = Number.isFinite(Number(value)) ? String(Math.max(0, Math.min(1, Number(value)))) : "1";

  if (field.control === "select") {
    return (
      <label className="adminField cmsBlockBuilderStyleControl" data-style-key={field.key}>
        <span>{field.label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? [""]).map((option) => (
            <option key={option || "empty"} value={option}>{option || "Sin valor"}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.control === "color") {
    return (
      <label className="adminField cmsBlockBuilderStyleControl cmsBlockBuilderColorControl" data-style-key={field.key}>
        <span>{field.label}</span>
        <div className="cmsBlockBuilderColorInputRow">
          <input aria-label={`${field.label} swatch`} type="color" value={colorValue} onChange={(event) => onChange(event.target.value)} />
          <input list={field.suggestions?.length ? datalistId : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder="var:color.primary" />
        </div>
        {field.suggestions?.length ? <VisualStyleSuggestions id={datalistId} suggestions={field.suggestions} /> : null}
      </label>
    );
  }

  if (field.control === "slider") {
    return (
      <label className="adminField cmsBlockBuilderStyleControl" data-style-key={field.key}>
        <span>{field.label}: {opacityValue}</span>
        <input max="1" min="0" step="0.05" type="range" value={opacityValue} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (field.control === "media") {
    return (
      <VisualMediaReferenceControl
        assetRef={assetRef}
        dataStyleKey={field.key}
        helper={field.helper}
        label={field.label}
        onChange={onChange}
        onRemove={onMediaRemove}
        onUpload={onMediaUpload}
        upload={upload}
        value={value}
      />
    );
  }

  return (
    <label className="adminField cmsBlockBuilderStyleControl" data-style-key={field.key}>
      <span>{field.label}</span>
      <input
        list={field.suggestions?.length ? datalistId : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.control === "radius" ? "var:radius.md" : field.control === "tokenOrLength" ? "var:spacing.md o 24px" : field.cssProperty}
      />
      {field.suggestions?.length ? <VisualStyleSuggestions id={datalistId} suggestions={field.suggestions} /> : null}
    </label>
  );
}

function VisualMediaReferenceControl({
  assetRef,
  dataStyleKey,
  helper,
  label,
  onChange,
  onRemove,
  onUpload,
  upload,
  value,
}: {
  assetRef?: CmsVisualAssetRef;
  dataStyleKey?: keyof CmsVisualNodeStyle;
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  onRemove?: (assetKey: string) => void;
  onUpload?: (file: File, requestedAssetKey?: string) => void | Promise<void>;
  upload?: CmsBlockBuilderMediaUploadState;
  value: string;
}) {
  const assetKey = value.startsWith("asset:") ? value.slice("asset:".length) : assetRef?.assetKey ?? "";
  const previewUrl = assetRef?.src ?? visualBuilderAssetPreviewUrl(assetRef?.mediaAssetId) ?? upload?.previewUrl;
  const status = upload?.status;

  return (
    <div className="adminField cmsBlockBuilderStyleControl cmsBlockBuilderMediaControl" data-style-key={dataStyleKey}>
      <span>{label}</span>
      <div className="cmsBlockBuilderMediaControlRow">
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="asset:hero-background" />
        <input
          accept="image/*,video/*"
          aria-label={`${label} upload`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && onUpload) void onUpload(file, assetKey || visualBuilderAssetKey(file.name));
            event.currentTarget.value = "";
          }}
          type="file"
        />
      </div>
      {previewUrl ? (
        <div className="cmsBlockBuilderMediaPreview">
          <span aria-label={assetRef?.alt ?? (assetKey || label)} role="img" style={{ backgroundImage: `url(${previewUrl})` }} />
        </div>
      ) : null}
      <div className="cmsBlockBuilderMediaControlActions">
        <button className="adminButton" disabled={!assetKey || !onRemove} onClick={() => assetKey && onRemove?.(assetKey)} type="button">
          Quitar media
        </button>
        {status ? <small>{status}{upload?.message ? ` - ${upload.message}` : ""}</small> : null}
      </div>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function VisualStyleSuggestions({ id, suggestions }: { id: string; suggestions: string[] }) {
  return (
    <datalist id={id}>
      {suggestions.map((suggestion) => (
        <option key={suggestion} value={suggestion} />
      ))}
    </datalist>
  );
}

function countVisualNodes(node: CmsVisualNode): number {
  return 1 + (node.children ?? []).reduce((total, child) => total + countVisualNodes(child), 0);
}

function ResolvedPageCanvas({
  blocks,
  onDuplicateBlock,
  onMoveBlock,
  onRemoveBlock,
  onSelectBlock,
  resolvedCanvas,
  selectedBlockId,
  unplacedBlocks,
  viewport,
}: {
  blocks: CmsBlock[];
  onDuplicateBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onRemoveBlock: (blockId: string) => void;
  onSelectBlock: (blockId: string) => void;
  resolvedCanvas: CmsBlockBuilderResolvedCanvas;
  selectedBlockId: string | null;
  unplacedBlocks: CmsBlock[];
  viewport: BuilderViewport;
}) {
  return (
    <div className="cmsBlockBuilderResolvedCanvas" style={canvasTokenStyle(resolvedCanvas)}>
      {cmsRegionCodes.map((region) => {
        const regionLayout = resolvedCanvas.layout.regions[region];
        if (!regionLayout || regionLayout.areas.length === 0) return null;

        return (
          <section className="cmsBlockBuilderRegion" key={region}>
            <header>
              <span>{region}</span>
              <strong>{regionLayout.areas.length} area(s)</strong>
            </header>
            {regionLayout.areas.map((area) => (
              <article className="cmsBlockBuilderArea" key={`${region}-${area.areaId}`}>
                <header>
                  <span>{area.areaId}</span>
                  <strong>{area.name ?? area.containerMode}</strong>
                </header>
                <div
                  className="cmsBlockBuilderColumns"
                  style={columnGridStyle(area.columns, area.columnGap, resolvedCanvas.tokens)}
                >
                  {area.columnSlots.map((slot) => {
                    const columnBlocks = blocksForColumn(blocks, resolvedCanvas, region, area.areaId, slot.columnIndex);
                    return (
                      <section className="cmsBlockBuilderColumn" key={`${region}-${area.areaId}-${slot.columnIndex}`}>
                        <header>
                          <span>Col {slot.columnIndex}</span>
                          <strong>{slot.width}</strong>
                        </header>
                        {columnBlocks.length > 0 ? columnBlocks.map((block) => (
                          <BuilderPreviewItem
                            active={selectedBlockId === block.blockId}
                            block={block}
                            key={block.blockId}
                            onDuplicate={onDuplicateBlock}
                            onMove={onMoveBlock}
                            onRemove={onRemoveBlock}
                            onSelect={onSelectBlock}
                            viewport={viewport}
                          />
                        )) : (
                          <div className="cmsBlockBuilderSlotEmpty">Slot vacio</div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        );
      })}
      {unplacedBlocks.length > 0 ? (
        <section className="cmsBlockBuilderUnplaced">
          <h3>Sin slot valido</h3>
          {unplacedBlocks.map((block) => (
            <BuilderPreviewItem
              active={selectedBlockId === block.blockId}
              block={block}
              key={block.blockId}
              onDuplicate={onDuplicateBlock}
              onMove={onMoveBlock}
              onRemove={onRemoveBlock}
              onSelect={onSelectBlock}
              viewport={viewport}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function BuilderPreviewItem({
  active,
  block,
  onDuplicate,
  onMove,
  onRemove,
  onSelect,
  viewport,
}: {
  active: boolean;
  block: CmsBlock;
  onDuplicate: (blockId: string) => void;
  onMove: (blockId: string, direction: -1 | 1) => void;
  onRemove: (blockId: string) => void;
  onSelect: (blockId: string) => void;
  viewport: BuilderViewport;
}) {
  return (
    <article className={active ? "cmsBlockBuilderPreviewItem cmsBlockBuilderPreviewItemActive" : "cmsBlockBuilderPreviewItem"}>
      <div className="cmsBlockBuilderPreviewActions" aria-label={`Acciones ${blockTitle(block)}`}>
        <button className="adminIconButton" onClick={() => onMove(block.blockId, -1)} type="button" aria-label="Subir bloque">
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <button className="adminIconButton" onClick={() => onMove(block.blockId, 1)} type="button" aria-label="Bajar bloque">
          <ArrowDown size={14} aria-hidden="true" />
        </button>
        <button className="adminIconButton" onClick={() => onDuplicate(block.blockId)} type="button" aria-label="Duplicar bloque">
          <CopyPlus size={14} aria-hidden="true" />
        </button>
        <button className="adminIconButton adminIconButtonDanger" onClick={() => onRemove(block.blockId)} type="button" aria-label="Eliminar bloque">
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
      <div
        className="cmsBlockBuilderPreviewContent"
        onClick={() => onSelect(block.blockId)}
        onKeyDown={(event) => handlePreviewItemKey(event, () => onSelect(block.blockId))}
        role="button"
        tabIndex={0}
      >
        <CmsBlockRenderer block={block} mode="admin-preview" visualViewport={viewport} />
      </div>
    </article>
  );
}

function BuilderBlockFields({
  block,
  moduleSlots,
  onPlacementChange,
  onPropChange,
  onSurfaceChange,
  onTargetChange,
  placement,
}: {
  block: CmsBlock;
  moduleSlots: CmsModuleSlot[];
  onPlacementChange: (placement: Partial<CmsBlockModulePlacement>) => void;
  onPropChange: (key: string, value: unknown) => void;
  onSurfaceChange: (surface: CmsSurface) => void;
  onTargetChange: (key: keyof ReturnType<typeof getCmsBlockPlpTarget>, value: string) => void;
  placement?: CmsBlockModulePlacement;
}) {
  const definition = getCmsBlockDefinition(block.type);
  const supportedSurfaces = definition?.supportedSurfaces ?? (["page", "plp"] as CmsSurface[]);
  const blockSurface = getCmsBlockSurface(block);
  const plpPlacement = getCmsBlockPlacement(block);
  const visualModuleProps = block.type === "visual.module" ? normalizeCmsVisualModuleProps(block.props) : null;

  return (
    <div className="cmsBlockFields cmsBlockBuilderFields">
      <label className="adminField">
        <span>Superficie</span>
        <select
          value={blockSurface}
          onChange={(event) => onSurfaceChange(event.target.value as CmsSurface)}
        >
          {supportedSurfaces.map((item) => (
            <option key={item} value={item}>{item === "page" ? "Pagina CMS" : "PLP / listing"}</option>
          ))}
        </select>
      </label>

      {blockSurface === "plp" ? (
        <label className="adminField">
          <span>Ubicacion PLP</span>
          <select value={plpPlacement} onChange={(event) => onPropChange("placement", event.target.value)}>
            <option value="beforeList">Antes de lista PLP</option>
            <option value="afterList">Despues de lista PLP</option>
          </select>
        </label>
      ) : null}

      {blockSurface === "page" ? (
        <BuilderPlacementFields
          moduleSlots={moduleSlots}
          onPlacementChange={onPlacementChange}
          placement={placement}
        />
      ) : null}

      {visualModuleProps ? (
        <VisualModuleContentEditor
          block={block}
          moduleProps={visualModuleProps}
          onContentSchemaChange={(schema) => onPropChange("contentSchema", schema)}
          onContentValuesChange={(values) => onPropChange("contentValues", values)}
        />
      ) : null}

      {definition?.editorFields.map((field) => {
        if (field.type === "plpTarget" && blockSurface !== "plp") return null;
        if (field.type === "plpTarget") {
          return (
            <BuilderPlpTargetFields
              block={block}
              key={field.key}
              onTargetChange={onTargetChange}
            />
          );
        }
        if (field.type === "boolean") {
          return (
            <label className="adminCheckbox cmsBlockBuilderBooleanField" key={field.key}>
              <input
                checked={boolProp(block, field.key)}
                onChange={(event) => onPropChange(field.key, event.target.checked)}
                type="checkbox"
              />
              <span>{field.label}</span>
            </label>
          );
        }
        if (field.type === "textarea") {
          return (
            <label className="adminField cmsJsonField" key={field.key}>
              <span>{field.label}</span>
              <textarea value={textProp(block, field.key)} onChange={(event) => onPropChange(field.key, event.target.value)} />
            </label>
          );
        }
        if (field.type === "json") {
          return (
            <BuilderJsonField
              key={`${block.blockId}-${field.key}`}
              label={field.label}
              onChange={(value) => onPropChange(field.key, value)}
              value={block.props[field.key]}
            />
          );
        }
        return (
          <label className="adminField" key={field.key}>
            <span>{field.label}</span>
            <input
              type={field.type === "url" ? "url" : "text"}
              value={textProp(block, field.key)}
              onChange={(event) => onPropChange(field.key, event.target.value)}
            />
          </label>
        );
      })}

      <label className="adminField cmsJsonField">
        <span>Props JSON</span>
        <textarea readOnly value={JSON.stringify(block.props, null, 2)} />
      </label>
    </div>
  );
}

function BuilderPlacementFields({
  moduleSlots,
  onPlacementChange,
  placement,
}: {
  moduleSlots: CmsModuleSlot[];
  onPlacementChange: (placement: Partial<CmsBlockModulePlacement>) => void;
  placement?: CmsBlockModulePlacement;
}) {
  const selectedKey = placement ? `${placement.region}|${placement.areaId}|${placement.columnIndex}` : "";

  return (
    <fieldset className="cmsBlockFieldset cmsModulePlacementFieldset">
      <legend>Placement del modulo</legend>
      <div className="cmsModulePlacementTopRow">
        <label className="adminField">
          <span>Region / area / columna</span>
          <select
            disabled={moduleSlots.length === 0}
            value={selectedKey}
            onChange={(event) => {
              const selectedSlot = moduleSlots.find((slot) => `${slot.region}|${slot.areaId}|${slot.columnIndex}` === event.target.value);
              if (!selectedSlot) return;
              onPlacementChange({
                region: selectedSlot.region,
                areaId: selectedSlot.areaId,
                columnIndex: selectedSlot.columnIndex,
                width: selectedSlot.width,
              });
            }}
          >
            {moduleSlots.length === 0 ? <option value="">Sin slots disponibles</option> : null}
            {moduleSlots.map((slot) => (
              <option key={`${slot.region}|${slot.areaId}|${slot.columnIndex}`} value={`${slot.region}|${slot.areaId}|${slot.columnIndex}`}>
                {slot.region} / {slot.areaId} / col {slot.columnIndex} ({slot.width})
              </option>
            ))}
          </select>
        </label>
        <label className="adminField cmsModulePlacementWidthField">
          <span>Ancho modulo</span>
          <input value={placement?.width ?? "100%"} onChange={(event) => onPlacementChange({ width: event.target.value })} />
        </label>
        <label className="adminField">
          <span>Alineacion</span>
          <select value={placement?.align ?? "stretch"} onChange={(event) => onPlacementChange({ align: event.target.value as CmsBlockModulePlacement["align"] })}>
            <option value="stretch">Stretch</option>
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
          </select>
        </label>
        <label className="adminField">
          <span>Container</span>
          <select value={placement?.containerMode ?? "inherit"} onChange={(event) => onPlacementChange({ containerMode: event.target.value as CmsBlockModulePlacement["containerMode"] })}>
            <option value="inherit">Heredado</option>
            <option value="container">Container</option>
            <option value="full-width">Full width</option>
          </select>
        </label>
      </div>
      <div className="cmsAreaVisibility">
        {(["mobile", "tablet", "desktop"] as const).map((device) => (
          <label className="adminCheckbox" key={device}>
            <input
              checked={placement?.visibility?.[device] !== false}
              type="checkbox"
              onChange={(event) => onPlacementChange({
                visibility: {
                  mobile: placement?.visibility?.mobile !== false,
                  tablet: placement?.visibility?.tablet !== false,
                  desktop: placement?.visibility?.desktop !== false,
                  [device]: event.target.checked,
                },
              })}
            />
            <span>{device}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BuilderPlpTargetFields({
  block,
  onTargetChange,
}: {
  block: CmsBlock;
  onTargetChange: (key: keyof ReturnType<typeof getCmsBlockPlpTarget>, value: string) => void;
}) {
  const target = getCmsBlockPlpTarget(block);
  return (
    <fieldset className="cmsBlockFieldset">
      <legend>Target PLP</legend>
      <label className="adminField">
        <span>Tipo listing</span>
        <select value={target.listingKind} onChange={(event) => onTargetChange("listingKind", event.target.value as CmsPlpListingKind)}>
          <option value="CATEGORY">Categoria</option>
          <option value="SEARCH">Busqueda</option>
          <option value="COLLECTION">Coleccion</option>
        </select>
      </label>
      <label className="adminField">
        <span>URL PLP</span>
        <input value={target.routePath} onChange={(event) => onTargetChange("routePath", event.target.value)} />
      </label>
      <label className="adminField">
        <span>Slug categoria</span>
        <input value={target.categorySlug} onChange={(event) => onTargetChange("categorySlug", event.target.value)} />
      </label>
    </fieldset>
  );
}

function VisualModuleContentEditor({
  block,
  moduleProps,
  onContentSchemaChange,
  onContentValuesChange,
}: {
  block: CmsBlock;
  moduleProps: ReturnType<typeof normalizeCmsVisualModuleProps>;
  onContentSchemaChange: (schema: CmsVisualContentSchema) => void;
  onContentValuesChange: (values: Record<string, unknown>) => void;
}) {
  const schema = moduleProps.contentSchema ?? {};
  const values = visualContentValues(block);
  const bindings = visualContentBindings(moduleProps.tree);
  const schemaKeys = Object.keys(schema);
  const orphanValueKeys = Object.keys(values).filter((key) => !schema[key]);

  return (
    <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset cmsBlockBuilderContentSchemaPanel">
      <legend>Contenido por pagina</legend>
      <div className="cmsBlockBuilderInspectorMeta">
        <span>{bindings.length} binding(s)</span>
        <span>{schemaKeys.length} campo(s) schema</span>
      </div>
      <div className="cmsBlockBuilderContentActions">
        <button className="adminButton" onClick={() => onContentSchemaChange(inferredVisualContentSchema(moduleProps.tree, schema))} type="button">
          Inferir schema desde bindings
        </button>
      </div>
      <VisualContentSchemaJsonField
        onChange={onContentSchemaChange}
        value={schema}
      />
      <VisualContentValuesEditor
        onChange={onContentValuesChange}
        schema={schema}
        values={values}
      />
      {orphanValueKeys.length ? (
        <div className="cmsBlockBuilderVisualHint">
          Valores sin schema actual: {orphanValueKeys.join(", ")}. Se conservan para evitar perdida de contenido si el modulo cambio.
        </div>
      ) : null}
    </fieldset>
  );
}

function VisualContentSchemaJsonField({
  onChange,
  value,
}: {
  onChange: (value: CmsVisualContentSchema) => void;
  value: CmsVisualContentSchema;
}) {
  const serialized = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(nextDraft: string) {
    setDraft(nextDraft);
    try {
      onChange(normalizeVisualContentSchemaDraft(nextDraft.trim() ? JSON.parse(nextDraft) as unknown : {}));
      setError(null);
    } catch {
      setError("JSON de contentSchema invalido");
    }
  }

  return (
    <label className="adminField cmsJsonField cmsBlockBuilderContentSchemaJson">
      <span>Content schema JSON</span>
      <textarea value={draft} onChange={(event) => updateDraft(event.target.value)} />
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}

function normalizeVisualContentSchemaDraft(value: unknown): CmsVisualContentSchema {
  const record = recordValue(value);
  const schema: CmsVisualContentSchema = {};
  for (const [key, rawField] of Object.entries(record)) {
    const field = recordValue(rawField);
    const type = field.type === "richText" || field.type === "url" || field.type === "media" || field.type === "boolean" || field.type === "number" || field.type === "color"
      ? field.type
      : "text";
    schema[key] = {
      type,
      required: field.required === true,
      ...(typeof field.label === "string" && field.label.trim() ? { label: field.label.trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(field, "defaultValue") ? { defaultValue: field.defaultValue } : {}),
    };
  }
  return schema;
}

function VisualContentValuesEditor({
  onChange,
  schema,
  values,
}: {
  onChange: (values: Record<string, unknown>) => void;
  schema: CmsVisualContentSchema;
  values: Record<string, unknown>;
}) {
  const fields = Object.entries(schema);

  function updateValue(key: string, value: unknown) {
    onChange({
      ...values,
      [key]: value,
    });
  }

  if (!fields.length) {
    return <div className="cmsBlockBuilderVisualHint">Define `contentBinding` en nodos visuales e infiere el schema para generar inputs de pagina.</div>;
  }

  return (
    <div className="cmsBlockBuilderContentValues" aria-label="Contenido de instancia">
      <strong>Contenido de instancia</strong>
      {fields.map(([key, field]) => (
        <VisualContentValueField
          field={field}
          key={key}
          name={key}
          onChange={(value) => updateValue(key, value)}
          value={values[key] ?? field.defaultValue ?? ""}
        />
      ))}
    </div>
  );
}

function VisualContentValueField({
  field,
  name,
  onChange,
  value,
}: {
  field: CmsVisualContentField;
  name: string;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const label = field.label ?? name;
  const textValue = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const isColumnRatio = field.type === "number" && /(?:column|ratio|proporcion|split)/i.test(`${name} ${label}`);

  if (isColumnRatio) {
    const rawRatio = Number(value);
    const leftRatio = Number.isFinite(rawRatio) ? Math.max(20, Math.min(80, Math.round(rawRatio))) : 50;
    return (
      <label className="adminField cmsBlockBuilderColumnRatioField">
        <span>{label}{field.required ? " *" : ""}</span>
        <input
          aria-label={`${label}: imagen left`}
          max="80"
          min="20"
          step="1"
          type="range"
          value={leftRatio}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output>{leftRatio}% imagen / {100 - leftRatio}% contenido</output>
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="adminCheckbox cmsBlockBuilderBooleanField">
        <input checked={value === true} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span>{label}{field.required ? " *" : ""}</span>
      </label>
    );
  }

  if (field.type === "richText") {
    return (
      <label className="adminField cmsJsonField">
        <span>{label}{field.required ? " *" : ""}</span>
        <textarea value={textValue} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (field.type === "color") {
    return (
      <label className="adminField cmsBlockBuilderColorInputRow">
        <span>{label}{field.required ? " *" : ""}</span>
        <input type="color" value={textValue || "#000000"} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  return (
    <label className="adminField">
      <span>{label}{field.required ? " *" : ""}</span>
      <input
        inputMode={field.type === "number" ? "decimal" : undefined}
        placeholder={field.type === "media" ? "asset:key" : undefined}
        type={field.type === "url" ? "url" : field.type === "number" ? "number" : "text"}
        value={textValue}
        onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)}
      />
    </label>
  );
}

function BuilderJsonField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const serialized = useMemo(() => JSON.stringify(value ?? [], null, 2), [value]);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(nextDraft: string) {
    setDraft(nextDraft);
    try {
      onChange(nextDraft.trim() ? JSON.parse(nextDraft) as unknown : []);
      setError(null);
    } catch {
      setError("JSON invalido");
    }
  }

  return (
    <label className="adminField cmsJsonField">
      <span>{label}</span>
      <textarea value={draft} onChange={(event) => updateDraft(event.target.value)} />
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}
