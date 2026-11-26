"use client";
import type { CmsVisualContentField } from "./cms-blocks";

import dynamic from "next/dynamic";
import { CmsIconPicker } from "../../shared/ui/cms-icon-picker";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Clipboard, CopyPlus, FileJson, Trash2 } from "lucide-react";
import { createCmsBlockFromPreset, getCmsBlockSurface, migrateCmsVisualModuleV1ToV2ForRenderer, normalizeCmsVisualModuleProps, normalizeCmsVisualModuleV2Props, normalizeCmsVisualNode, normalizeCmsBlock, type CmsBlock, type CmsBlockModulePlacement, type CmsVisualAssetRef, type CmsVisualBreakpoint, type CmsVisualContentSchema, type CmsVisualElement, type CmsVisualHoverStyleKey, type CmsVisualInteractionTransition, type CmsVisualModuleV2Props, type CmsVisualNode, type CmsVisualNodeProps, type CmsVisualNodeStyle, type CmsVisualNodeType, type CmsVisualPanel, cmsVisualHoverStyleKeys } from "./cms-blocks";
import type { CmsDesignTokens, CmsLayout, CmsModulePlacement, CmsModuleSlot, CmsResolvedModule, CmsRegionCode, CmsVisualModuleDefinition } from "./cms-admin";

const CmsRichTextEditor = dynamic(() => import("../../shared/ui/cms-rich-text-editor").then(module => module.CmsRichTextEditor), { ssr: false });

export type BuilderViewport = "desktop" | "tablet" | "mobile";

export type CmsBlockBuilderResolvedCanvas = {
  layout: CmsLayout;
  modules: CmsResolvedModule[];
  tokens: CmsDesignTokens;
};

export type CmsBlockBuilderMediaUploadState = {
  assetKey: string;
  mediaAssetId?: string;
  message?: string;
  previewUrl?: string;
  status: "idle" | "uploading" | "uploaded" | "failed";
};

export type CmsVisualNodeEditableProp = Exclude<keyof CmsVisualNodeProps, "target">;

export type CmsVisualMediaUploadTarget =
  | { kind: "prop"; key: CmsVisualNodeEditableProp; role: NonNullable<CmsVisualAssetRef["role"]> }
  | { kind: "style"; key: keyof CmsVisualNodeStyle; role: NonNullable<CmsVisualAssetRef["role"]> };

export type CmsVisualStyleScope = "base" | CmsVisualBreakpoint;

export type CmsVisualNodeMoveTarget = {
  depth: number;
  label: string;
  nodeId: string;
  type: CmsVisualNodeType;
};

export type CmsVisualModulePreset = {
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

export const viewportLabels: Record<BuilderViewport, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export const visualStyleScopeLabels: Record<CmsVisualStyleScope, string> = {
  base: "Base",
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export const visualStyleScopes: CmsVisualStyleScope[] = ["base", "desktop", "tablet", "mobile"];

export const visualAnimationPresets = ["none", "fadeIn", "slideUp", "scaleIn"] as const;

export const visualAnimationEasings = ["standard", "emphasized", "linear"] as const;

export const visualAnimationTriggers = ["load", "inView"] as const;

export const cmsRegionCodes: CmsRegionCode[] = ["header", "main", "footer"];

export const visualModulePresetsStorageKey = "ecommium.cms.visualModulePresets.v1";

export function createLocalVisualPreset(module: CmsVisualModulePropsForPreset, name: string, existing: CmsVisualModulePreset[]): CmsVisualModulePreset {
  const revision = existing.filter(item => item.name === name).reduce((value, item) => Math.max(value, item.version + 1), 1);
  const now = new Date().toISOString(), presetId = makeVisualModulePresetId();
  return { presetId, definitionId: presetId, moduleId: module.moduleId, name, revision, version: revision,
    schemaVersion: 2, schemaMinorVersion: 0, status: "ACTIVE", createdAt: now, updatedAt: now,
    assetRefs: module.assetRefs, contentSchema: inferredVisualContentSchema(module.tree, module.contentSchema ?? {}),
    contentValues: module.contentValues, tree: remapVisualNodeIds(module.tree, "root") };
}
type CmsVisualModulePropsForPreset = { moduleId: string; tree: CmsVisualNode; assetRefs?: CmsVisualAssetRef[]; contentSchema?: CmsVisualContentSchema; contentValues?: Record<string, unknown> };

export const visualNodeCatalog: Array<{
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
  { type: "paragraph", label: "Text · simple", description: "Texto corto o descriptivo." },
  { type: "richText", label: "Text · enriquecido", description: "Texto largo preformateado y seguro." },
  { type: "image", label: "Image", description: "Imagen con src y alt." },
  { type: "button", label: "Button", description: "CTA enlazado con estilo de boton." },
  { type: "link", label: "Link", description: "Enlace textual seguro." },
  { type: "icon", label: "Icon", description: "Texto/icono simple para decorar." },
  { type: "spacer", label: "Spacer", description: "Espacio vertical controlado." },
  { type: "video", label: "Video", description: "Enlace seguro a video externo." },
  { type: "htmlEmbed", label: "HTML embed", description: "HTML guardado como texto escapado." },
  { type: "newsletterForm", label: "Form · newsletter", description: "Email y consentimiento comercial; envío exclusivamente por BFF." },
];

export const visualStarterNodeTypes: CmsVisualNodeType[] = ["section", "grid", "flex", "heading", "paragraph", "button", "image"];

export const visualContainerNodeTypes: CmsVisualNodeType[] = ["container", "section", "div", "grid", "flex"];

export function canContainVisualNodes(node: CmsVisualNode | null | undefined): boolean {
  return !!node && visualContainerNodeTypes.includes(node.type);
}

export function assertVisualNodeHierarchy(node: CmsVisualNode): void {
  if (!canContainVisualNodes(node) && node.children?.length) {
    throw new Error("Los nodos de contenido no admiten hijos. Usa Container, Section, Div, Grid o Flex.");
  }
  node.children?.forEach(assertVisualNodeHierarchy);
}


export const visualNodePropFields: Array<{
  key: CmsVisualNodeEditableProp;
  label: string;
  multiline?: boolean;
  nodeTypes?: CmsVisualNodeType[];
}> = [
  { key: "text", label: "Texto", multiline: true, nodeTypes: ["heading", "paragraph", "richText", "button", "link", "icon", "newsletterForm"] },
  { key: "href", label: "Href", nodeTypes: ["button", "link"] },
  { key: "src", label: "Src", nodeTypes: ["image", "video"] },
  { key: "alt", label: "Alt", nodeTypes: ["image"] },
  { key: "newsletterPart", label: "Parte del formulario (email, consent, privacy, feedback)", nodeTypes: ["paragraph", "div", "link"] },
  { key: "title", label: "Title" },
  { key: "ariaLabel", label: "Aria label" },
  { key: "html", label: "HTML escapado", multiline: true, nodeTypes: ["htmlEmbed", "richText"] },
];

export type CmsVisualStyleTarget = "module" | "panel" | "element";

export type CmsVisualStyleControl = "color" | "media" | "radius" | "select" | "slider" | "text" | "tokenOrLength";

export type CmsVisualStylePropertyDefinition = {
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

export const allVisualStyleTargets: CmsVisualStyleTarget[] = ["module", "panel", "element"];

export const visualStylePropertyRegistry: CmsVisualStylePropertyDefinition[] = [
  { key: "display", label: "Display", cssProperty: "display", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "block", "flex", "grid", "none"] },
  { key: "position", label: "Position", cssProperty: "position", group: "layout", control: "select", appliesTo: allVisualStyleTargets, options: ["", "relative", "absolute", "sticky"] },
  { key: "top", label: "Top", cssProperty: "top", group: "layout", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["0px", "25%", "50%"] },
  { key: "left", label: "Left", cssProperty: "left", group: "layout", control: "tokenOrLength", appliesTo: allVisualStyleTargets, suggestions: ["0px", "25%", "50%"] },
  { key: "transform", label: "Transform", cssProperty: "transform", group: "effects", control: "text", appliesTo: allVisualStyleTargets, suggestions: ["rotate(14deg)", "translateX(-50%)", "scale(0.8)"] },
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

export const visualStylePropertyKeys = visualStylePropertyRegistry.map((field) => field.key);

export function makeVisualBuilderNodeId(type: CmsVisualNodeType) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeVisualModulePresetId() {
  return `visual-preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const consultWorksSplitCtaContentSchema: CmsVisualContentSchema = {
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

export const consultWorksSplitCtaContentValues: Record<string, unknown> = {
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

export const consultWorksSplitCtaTree: CmsVisualNode = {
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

export function createBlankVisualModuleBlock(): CmsBlock {
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

export function createSolHighSplitHeroTree(): CmsVisualNode {
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

export function createFourInfoSquaresTree(): CmsVisualNode {
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

export function createCmsVisualModuleReferenceBlock(definition: CmsVisualModuleDefinition): CmsBlock {
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

export function createSystemVisualModulePresets(): CmsVisualModulePreset[] {
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

export const systemVisualModulePresets = createSystemVisualModulePresets();

export function visualStyleTargetForNode(node: CmsVisualNode): CmsVisualStyleTarget {
  if (node.nodeId === "root") return "module";
  return visualContainerNodeTypes.includes(node.type) ? "panel" : "element";
}

export function visualStylePropertyVisible(field: CmsVisualStylePropertyDefinition, node: CmsVisualNode, scopedStyles: CmsVisualNodeStyle | undefined) {
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

export function isVisualStyleValueSafe(key: keyof CmsVisualNodeStyle, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (key === "backgroundImage") return /^asset:[a-z0-9][a-z0-9._:-]*$/i.test(trimmed);
  if (key === "top" || key === "left") return /^-?(?:0|[0-9]+(?:\.[0-9]+)?(?:px|rem|%|vh|vw|ch))$/.test(trimmed);
  if (key === "transform") return /^(?:(?:translate(?:X|Y)?\(-?(?:0|[0-9]+(?:\.[0-9]+)?(?:px|rem|%|vh|vw|ch))\)|scale(?:X|Y)?\((?:0|[0-9]+(?:\.[0-9]+)?)\)|rotate\(-?(?:0|[0-9]+(?:\.[0-9]+)?deg)\))\s*)+$/.test(trimmed);
  return !/(url\s*\(|javascript:|expression\s*\(|@import|<\/?[a-z]|[{};])/i.test(trimmed);
}

export function visualContentTextForSave(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function visualContentValuesForSave(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" ? visualContentTextForSave(value) : value,
    ]),
  );
}

export function visualPropsForSave(props: Record<string, unknown> | undefined) {
  if (!props) return props;
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === "string" ? visualContentTextForSave(value) : value,
    ]),
  );
}

export function visualElementsForSave(elements: CmsVisualElement[] | undefined): CmsVisualElement[] | undefined {
  return elements?.map((element) => ({
    ...element,
    props: visualPropsForSave(element.props),
    children: visualElementsForSave(element.children),
    elements: visualElementsForSave(element.elements),
  }));
}

export function visualPanelsForSave(panels: CmsVisualPanel[] | undefined): CmsVisualPanel[] {
  return (panels ?? []).map((panel) => ({
    ...panel,
    props: visualPropsForSave(panel.props),
    elements: visualElementsForSave(panel.elements),
    panels: visualPanelsForSave(panel.panels),
  }));
}

export function visualModulePropsForSave(moduleProps: CmsVisualModuleV2Props): CmsVisualModuleV2Props {
  return {
    ...moduleProps,
    contentValues: visualContentValuesForSave(recordValue(moduleProps.contentValues)),
    elements: visualElementsForSave(moduleProps.elements),
    panels: visualPanelsForSave(moduleProps.panels),
  };
}

export function normalizeVisualStyleJsonObject(value: unknown): CmsVisualNodeStyle | null {
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

export function visualHoverStyleJsonCandidate(value: unknown): unknown {
  const record = recordValue(value);
  const hoverRecord = recordValue(record.hover);
  if (hoverRecord.styles) return hoverRecord.styles;
  if (record.styles) return record.styles;
  return value;
}

export function normalizeVisualHoverStyleJsonObject(value: unknown): {
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

export function visualBuilderAssetPreviewUrl(mediaAssetId: string | undefined) {
  return mediaAssetId
    ? `/api/admin/media-assets/${encodeURIComponent(mediaAssetId)}/content?variant=large_default`
    : undefined;
}

export function visualBuilderAssetKey(seed: string) {
  const normalizedSeed = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalizedSeed || `asset-${Date.now().toString(36)}`;
}

export function visualAssetRefForValue(value: string | undefined, assetRefs: CmsVisualAssetRef[]) {
  const assetKey = value?.startsWith("asset:") ? value.slice("asset:".length) : "";
  return assetKey ? assetRefs.find((asset) => asset.assetKey === assetKey) : undefined;
}

export function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export const cmsVisualModuleV2RolloutModes = ["disabled", "beta", "default"] as const;

export type CmsVisualModuleV2RolloutMode = (typeof cmsVisualModuleV2RolloutModes)[number];

export function visualModuleBlockForRollout(block: CmsBlock, rolloutMode: CmsVisualModuleV2RolloutMode): CmsBlock {
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

export function normalizeVisualModulePreset(value: unknown): CmsVisualModulePreset | null {
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

export function localVisualModulePresets(presets: CmsVisualModulePreset[]) {
  return presets.filter((preset) => preset.source !== "system");
}

export function visualModulePresetDisplayName(preset: Pick<CmsVisualModulePreset, "name" | "version">) {
  return new RegExp(`\\s+v${preset.version}$`, "i").test(preset.name)
    ? preset.name
    : `${preset.name} v${preset.version}`;
}

export function mergeVisualModulePresets(localPresets: CmsVisualModulePreset[]) {
  const systemPresetIds = new Set(systemVisualModulePresets.map((preset) => preset.presetId));
  return [
    ...systemVisualModulePresets,
    ...localPresets.filter((preset) => !systemPresetIds.has(preset.presetId)),
  ];
}

export function visualModulePresetsFromJson(value: string | null): CmsVisualModulePreset[] {
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

export function visualModulePresetsToJson(presets: CmsVisualModulePreset[]) {
  return JSON.stringify(localVisualModulePresets(presets), null, 2);
}

export function blockPlacement(block: CmsBlock, resolvedCanvas: CmsBlockBuilderResolvedCanvas | null): CmsModulePlacement | undefined {
  if (block.placement) return block.placement as CmsModulePlacement;
  return resolvedCanvas?.modules.find((module) => module.blockId === block.blockId)?.placement;
}

export function resolvedModuleSlots(resolvedCanvas: CmsBlockBuilderResolvedCanvas | null): CmsModuleSlot[] {
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

export function firstModuleSlot(slots: CmsModuleSlot[]) {
  return slots.find((slot) => slot.region === "main") ?? slots[0];
}

export function defaultModulePlacement(resolvedCanvas: CmsBlockBuilderResolvedCanvas | null, order = 1): CmsBlockModulePlacement | undefined {
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

export function completePlacement(
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

export function uniqueVisualNodeId(nodeId: string, seenIds: Set<string>) {
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

export function visualTreeWithUniqueNodeIds(node: CmsVisualNode, seenIds = new Set<string>()): CmsVisualNode {
  return {
    ...node,
    nodeId: uniqueVisualNodeId(node.nodeId, seenIds),
    children: (node.children ?? []).map((child) => visualTreeWithUniqueNodeIds(child, seenIds)),
  };
}

export function visualBlockWithUniqueNodeIds(block: CmsBlock): CmsBlock {
  if (block.type !== "visual.module") return block;
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  return visualBlockWithTree(block, visualTreeWithUniqueNodeIds(moduleProps.tree));
}

export function cloneVisualBuilderNode(node: CmsVisualNode): CmsVisualNode {
  return {
    ...node,
    nodeId: makeVisualBuilderNodeId(node.type),
    label: node.label ? `${node.label} copy` : undefined,
    children: (node.children ?? []).map((child) => cloneVisualBuilderNode(child)),
  };
}

export function findVisualNode(node: CmsVisualNode, nodeId: string | null): CmsVisualNode | null {
  if (!nodeId) return null;
  if (node.nodeId === nodeId) return node;
  for (const child of node.children ?? []) {
    const found = findVisualNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function visualNodeContains(node: CmsVisualNode, nodeId: string): boolean {
  if (node.nodeId === nodeId) return true;
  return (node.children ?? []).some((child) => visualNodeContains(child, nodeId));
}

export function visualNodeMoveTargets(
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

export function findVisualParentId(node: CmsVisualNode, nodeId: string, parentId: string | null = null): string | null {
  if (node.nodeId === nodeId) return parentId;
  for (const child of node.children ?? []) {
    const parent = findVisualParentId(child, nodeId, node.nodeId);
    if (parent) return parent;
  }
  return null;
}

export function updateVisualNodeChildren(
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

export function extractVisualNodeFromChildren(children: CmsVisualNode[], nodeId: string): {
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

export function insertVisualNodeIntoParent(node: CmsVisualNode, parentNodeId: string, insertedNode: CmsVisualNode): CmsVisualNode {
  return updateVisualNodeChildren(node, parentNodeId, (children) => [...children, insertedNode]);
}

export function insertVisualNodeAfterChild(
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

export function updateVisualNodeInTree(
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

export function removeVisualNodeFromTree(node: CmsVisualNode, nodeId: string): CmsVisualNode {
  return {
    ...node,
    children: (node.children ?? [])
      .filter((child) => child.nodeId !== nodeId)
      .map((child) => removeVisualNodeFromTree(child, nodeId)),
  };
}

export function duplicateVisualNodeInTree(node: CmsVisualNode, nodeId: string): { nextNode: CmsVisualNode; copyId: string | null } {
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

export function moveVisualNodeInTree(node: CmsVisualNode, nodeId: string, direction: -1 | 1): CmsVisualNode {
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

export function moveVisualNodeToParentInTree(node: CmsVisualNode, nodeId: string, targetParentNodeId: string): CmsVisualNode {
  if (node.nodeId === nodeId) return node;
  const selectedNode = findVisualNode(node, nodeId);
  const targetParentNode = findVisualNode(node, targetParentNodeId);
  if (!selectedNode || !canContainVisualNodes(targetParentNode) || visualNodeContains(selectedNode, targetParentNodeId)) return node;
  const extracted = extractVisualNodeFromChildren(node.children ?? [], nodeId);
  if (!extracted.extracted) return node;
  return insertVisualNodeIntoParent({
    ...node,
    children: extracted.children,
  }, targetParentNodeId, extracted.extracted);
}

export function moveVisualNodeOutInTree(node: CmsVisualNode, nodeId: string): CmsVisualNode {
  if (node.nodeId === nodeId) return node;
  const parentId = findVisualParentId(node, nodeId);
  const grandParentId = parentId ? findVisualParentId(node, parentId) : null;
  if (!parentId || !grandParentId || !canContainVisualNodes(findVisualNode(node, grandParentId))) return node;
  const extracted = extractVisualNodeFromChildren(node.children ?? [], nodeId);
  if (!extracted.extracted) return node;
  return insertVisualNodeAfterChild({
    ...node,
    children: extracted.children,
  }, grandParentId, parentId, extracted.extracted);
}

export function visualBlockWithTree(block: CmsBlock, tree: CmsVisualNode): CmsBlock {
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

export function addVisualNodeToParent(block: CmsBlock, parentNodeId: string, node: CmsVisualNode): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (!canContainVisualNodes(findVisualNode(moduleProps.tree, parentNodeId))) return block;
  return visualBlockWithTree(
    block,
    updateVisualNodeChildren(moduleProps.tree, parentNodeId, (children) => [...children, node]),
  );
}

export function updateVisualNodeInBlock(
  block: CmsBlock,
  nodeId: string,
  updater: (node: CmsVisualNode) => CmsVisualNode,
): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  return visualBlockWithTree(block, updateVisualNodeInTree(moduleProps.tree, nodeId, updater));
}

export function removeVisualNodeFromBlock(block: CmsBlock, nodeId: string): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, removeVisualNodeFromTree(moduleProps.tree, nodeId));
}

export function duplicateVisualNodeInBlock(block: CmsBlock, nodeId: string): { block: CmsBlock; copyId: string | null } {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  const parentId = findVisualParentId(moduleProps.tree, nodeId);
  if (!parentId || !canContainVisualNodes(findVisualNode(moduleProps.tree, parentId))) return { block, copyId: null };
  const result = duplicateVisualNodeInTree(moduleProps.tree, nodeId);
  return {
    block: visualBlockWithTree(block, result.nextNode),
    copyId: result.copyId,
  };
}

export function moveVisualNodeInBlock(block: CmsBlock, nodeId: string, direction: -1 | 1): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, moveVisualNodeInTree(moduleProps.tree, nodeId, direction));
}

export function moveVisualNodeToParentInBlock(block: CmsBlock, nodeId: string, targetParentNodeId: string): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, moveVisualNodeToParentInTree(moduleProps.tree, nodeId, targetParentNodeId));
}

export function moveVisualNodeOutInBlock(block: CmsBlock, nodeId: string): CmsBlock {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  if (moduleProps.tree.nodeId === nodeId) return block;
  return visualBlockWithTree(block, moveVisualNodeOutInTree(moduleProps.tree, nodeId));
}

export function canMoveVisualNodeOut(tree: CmsVisualNode, nodeId: string) {
  const parentId = findVisualParentId(tree, nodeId);
  const grandParentId = parentId ? findVisualParentId(tree, parentId) : null;
  return Boolean(parentId && grandParentId && canContainVisualNodes(findVisualNode(tree, grandParentId)));
}

export function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1) {
  if (index < 0) return items;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  return copy;
}

export function builderBlocksForSave(
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

export function builderBlocksForCmsDraftPayload(blocks: CmsBlock[]) {
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

export function VisualNodeLibrary({
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
        <>
          {!canContainVisualNodes(selectedNode) ? <p role="status" className="cmsBlockBuilderVisualHint">Selecciona un nodo estructural en el árbol para añadir piezas. Los nodos de contenido no admiten hijos.</p> : null}
          {(["structure", "content"] as const).map(group => (
            <section key={group} aria-label={group === "structure" ? "Nodos estructurales" : "Nodos de contenido"}>
              <h3>{group === "structure" ? "Nodos estructurales" : "Nodos de contenido"}</h3>
              <p>{group === "structure" ? "Organizan el diseño y contienen otras piezas." : "Añaden texto, imágenes, acciones y formularios al contenedor seleccionado."}</p>
              <div className="cmsBlockBuilderVisualNodeGrid">
                {visualNodeCatalog.filter(node => visualContainerNodeTypes.includes(node.type) === (group === "structure")).map(node => (
                  <button className="cmsBlockBuilderVisualNodeButton" key={node.type}
                    disabled={!canContainVisualNodes(selectedNode)}
                    onClick={() => onAddNode(node.type)} type="button">
                    <strong>{node.label}</strong><span>{node.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

export function VisualModuleStarter({ onAddNode }: { onAddNode: (type: CmsVisualNodeType) => void }) {
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

export function VisualNodeTreeEditor({
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
          <p>Selecciona una estructura para insertar piezas o un contenido para editarlo.</p>
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

export function VisualNodeTreeItem({
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
          <span>{canContainVisualNodes(node) ? "Estructura" : "Contenido"} · {node.type} · {node.children?.length ?? 0} hijos</span>
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
      {!canContainVisualNodes(node) && !!node.children?.length ? <small role="status">Este contenido tiene hijos antiguos que pueden no mostrarse. Muévelos a un nodo estructural desde «Mover dentro de».</small> : null}
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

export function VisualNodeInspector({
  sectionContainerOnly = false,
  contentBindingEditor,
  hideDesign = false,
  presentationOnly = false,
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
  sectionContainerOnly?: boolean;
  contentBindingEditor?: ReactNode;
  presentationOnly?: boolean;
  hideDesign?: boolean;
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
  const propFields = visualNodePropFields.filter((field) => (!field.nodeTypes || field.nodeTypes.includes(node.type)) && !(node.type === "richText" && field.key === "html"));
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
  const styleJsonInvalid = Boolean(styleJsonMessage && !/sincronizado|Scope limpio/.test(styleJsonMessage));
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
    () => visualStylePropertyRegistry.filter((field) => (!sectionContainerOnly || field.group !== "typography") && visualStylePropertyVisible(field, node, scopedStyles)),
    [node, scopedStyles, sectionContainerOnly],
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
      {!sectionContainerOnly ? <div className="pricingPanelHeader">
        <div>
          <h2>Nodo seleccionado</h2>
          <p>{node.type} - {node.nodeId}</p>
        </div>
      </div> : null}
      {!presentationOnly ? (<label className="adminField">
        <span>Label</span>
        <input value={node.label ?? ""} onChange={(event) => onLabelChange(event.target.value)} />
      </label>) : null}
      {!presentationOnly ? (<label className="adminField">
        <span>Content binding</span>
        <input value={node.contentBinding ?? ""} onChange={(event) => onContentBindingChange(event.target.value)} placeholder="heading, text, buttonText" />
      </label>) : null}
      {!presentationOnly ? contentBindingEditor : null}
      {!presentationOnly ? (<fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>Props</legend>
        {propFields.map((field) => (
          node.type === "icon" && field.key === "text" ? (
            <CmsIconPicker key={node.nodeId} value={node.props?.text ?? ""} onChange={value => onPropChange("text", value)} />
          ) : node.type === "richText" && field.key === "text" ? (
            <CmsRichTextEditor key={node.nodeId} label="Texto enriquecido" html={node.props?.html} text={node.props?.text ?? ""} onChange={(html) => onPropChange("html", html)} />
          ) : field.key === "src" && (node.type === "image" || node.type === "video") ? (
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
      </fieldset>) : null}
      {!hideDesign ? <>
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
      {!sectionContainerOnly ? <>
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
            <input max="2000" min="0" step="1" type="number" value={node.animation?.durationMs ?? 600} onChange={(event) => onAnimationChange("durationMs", event.target.value)} />
          </label>
          <label className="adminField">
            <span>Delay</span>
            <input max="2000" min="0" step="1" type="number" value={node.animation?.delayMs ?? 0} onChange={(event) => onAnimationChange("delayMs", event.target.value)} />
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
              step="1"
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
              step="1"
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
      </> : null}
      </> : null}
      {!presentationOnly ? (<fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
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
      </fieldset>) : null}
      {!hideDesign ? (
      <fieldset className="cmsBlockFieldset cmsBlockBuilderVisualFieldset">
        <legend>{sectionContainerOnly ? "Estilos del contenedor" : "Styles responsive"}</legend>
        {!sectionContainerOnly ? <div className="cmsBlockBuilderInspectorMeta">
          <span>Target: {styleTarget}</span>
          <span>{visibleStyleFields.length} controles activos</span>
        </div> : null}
        <div className="cmsBlockBuilderVisualStyleScopes" role="group" aria-label="Scope de estilos visuales">
          {visualStyleScopes.map((scope) => (
            <button
              className={styleScope === scope ? "adminTab adminTabActive" : "adminTab"}
              key={scope}
              aria-pressed={styleScope === scope}
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
        {!sectionContainerOnly ? <><label className="adminField cmsJsonField cmsBlockBuilderStyleJsonField">
          <span>Styles JSON directo</span>
          <textarea aria-invalid={styleJsonInvalid} data-cms-editor-error={styleJsonInvalid ? "true" : undefined} value={styleJsonDraft} onChange={(event) => applyStyleJsonDraft(event.target.value)} />
        </label>
        {styleJsonMessage ? <small role={styleJsonInvalid ? "alert" : "status"} className="cmsBlockBuilderImportMessage">{styleJsonMessage}{styleJsonInvalid ? " No se guardará este cambio hasta corregirlo. Usa un objeto plano, por ejemplo: {\"paddingTop\":\"20px\"}." : ""}</small> : null}
        </> : null}
      </fieldset>
      ) : null}
      {!presentationOnly ? (<label className="adminField cmsJsonField">
        <span>Nodo JSON</span>
        <textarea readOnly value={JSON.stringify(node, null, 2)} />
      </label>) : null}
      {!presentationOnly ? (<section className="cmsBlockBuilderVisualPortability" aria-label="Portabilidad visual JSON">
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
          <button className="adminButton" disabled={!canContainVisualNodes(node)} onClick={onApplyVisualImportAsChild} type="button">
            Importar como hijo
          </button>
          <button className="adminButton" onClick={onReplaceSelectedVisualNodeFromImport} type="button">
            Reemplazar nodo
          </button>
        </div>
        {visualPortabilityMessage ? <small className="cmsBlockBuilderImportMessage">{visualPortabilityMessage}</small> : null}
      </section>) : null}
    </section>
  );
}

export function VisualStylePropertyControl({
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

export function VisualMediaReferenceControl({
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

export function VisualStyleSuggestions({ id, suggestions }: { id: string; suggestions: string[] }) {
  return (
    <datalist id={id}>
      {suggestions.map((suggestion) => (
        <option key={suggestion} value={suggestion} />
      ))}
    </datalist>
  );
}

export function countVisualNodes(node: CmsVisualNode): number {
  return 1 + (node.children ?? []).reduce((total, child) => total + countVisualNodes(child), 0);
}

export function normalizeVisualContentSchemaDraft(value: unknown): CmsVisualContentSchema {
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

export function createVisualBuilderNode(type: CmsVisualNodeType): CmsVisualNode {
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
  if (type === "newsletterForm") {
    base.props = { ariaLabel: "Tu correo electrónico", title: "Tu correo electrónico", text: "SUSCRIBIR" };
    base.styles = { backgroundColor: "#525252", color: "#ffffff", borderRadius: "6px", padding: "12px 28px", fontSize: "20px", fontWeight: "700" };
    base.children = [
      { nodeId: makeVisualBuilderNodeId("paragraph"), type: "paragraph", label: "Colores del campo email", props: { newsletterPart: "email" }, styles: { backgroundColor: "#fafafa", color: "#262626", border: "1px solid #737373" } },
      { nodeId: makeVisualBuilderNodeId("paragraph"), type: "paragraph", label: "Estilo del consentimiento", props: { newsletterPart: "consent" }, styles: { color: "#404040", fontSize: "13px" } },
      { nodeId: makeVisualBuilderNodeId("paragraph"), type: "paragraph", label: "Enlace de privacidad", props: { newsletterPart: "privacy", text: "Política de Privacidad" }, styles: { color: "#404040", fontSize: "13px" } },
      { nodeId: makeVisualBuilderNodeId("paragraph"), type: "paragraph", label: "Mensajes del formulario", props: { newsletterPart: "feedback" }, styles: { color: "#404040", fontSize: "14px" } },
    ];
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
    base.props = { text: "lucide:star" };
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

export function VisualContentValuesEditor({
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

export function VisualContentValueField({
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


// Expose only fields explicitly published by the module designer. Existing
// node text supplies the initial form value without rewriting the design.
export function visualInstanceContentValues(tree: CmsVisualNode, schema: CmsVisualContentSchema, values: Record<string, unknown>): Record<string, unknown> {
  const result = { ...values };
  function visit(node: CmsVisualNode) {
    const key = node.contentBinding;
    if (key && schema[key] && result[key] === undefined) {
      const fallback = node.type === "image" || node.type === "video" ? node.props?.src
        : node.type === "richText" || node.type === "htmlEmbed" ? node.props?.html ?? node.props?.text
        : node.props?.text;
      const value = schema[key].defaultValue ?? fallback;
      if (value !== undefined) result[key] = value;
    }
    node.children?.forEach(visit);
  }
  visit(tree);
  return result;
}

export function inferredVisualContentSchema(tree: CmsVisualNode, currentSchema: CmsVisualContentSchema): CmsVisualContentSchema {
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

export function visualContentBindings(node: CmsVisualNode): Array<{ field: CmsVisualContentField; key: string; nodeId: string }> {
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

export function visualContentFieldTypeForNode(node: CmsVisualNode): CmsVisualContentField["type"] {
  if (node.contentBinding?.toLowerCase().includes("color")) return "color";
  if (node.type === "richText" || node.type === "htmlEmbed") return "richText";
  if (node.type === "button" || node.type === "link") return "text";
  if (node.type === "image" || node.type === "video") return "media";
  return "text";
}

export function visualStyleBindingsForNode(node: CmsVisualNode): Array<{ field: CmsVisualContentField; key: string; nodeId: string }> {
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

export function visualContentFieldTypeForStyle(key: keyof CmsVisualNodeStyle, bindingKey: string): CmsVisualContentField["type"] {
  if (bindingKey.toLowerCase().includes("color") || key.toLowerCase().includes("color")) return "color";
  if (key === "backgroundImage") return "media";
  if (key === "gridTemplateColumns") return "number";
  return "text";
}

export function remapVisualNodeIds(node: CmsVisualNode, rootNodeId?: string): CmsVisualNode {
  return {
    ...node,
    nodeId: rootNodeId ?? makeVisualBuilderNodeId(node.type),
    children: (node.children ?? []).map((child) => remapVisualNodeIds(child)),
  };
}
