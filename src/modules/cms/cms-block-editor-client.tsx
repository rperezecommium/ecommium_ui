"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CopyPlus, Trash2 } from "lucide-react";
import {
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockPlacement,
  getCmsBlockPlpTarget,
  getCmsBlockPresets,
  getCmsBlockSurface,
  migrateCmsVisualModuleV1ToV2ForRenderer,
  normalizeCmsVisualModuleProps,
  normalizeCmsVisualModuleV2Props,
  normalizeCmsVisualNode,
  normalizeCmsBlockModulePlacement,
  summarizePlacements,
  type CmsBlock,
  type CmsBlockModulePlacement,
  type CmsPlacement,
  type CmsPlpListingKind,
  type CmsSurface,
  type CmsVisualContentField,
  type CmsVisualContentSchema,
  type CmsVisualModuleV2Props,
  type CmsVisualNode,
} from "./cms-blocks";
import {
  CmsBlockRenderer,
  CmsPlpStorefrontPreviewRenderer,
} from "../../../packages/cms-blocks/src/react";
import type { CmsModulePlacement, CmsModuleSlot, CmsVisualModuleDefinitionsList } from "./cms-admin";

type CmsBlockEditorClientProps = {
  initialBlocks: CmsBlock[];
  locale?: string;
  mode?: "all" | "plp";
  moduleSlots?: CmsModuleSlot[];
  pageId?: string;
  publishVisualModuleAction?: (formData: FormData) => void | Promise<void>;
  visualModules?: CmsVisualModuleDefinitionsList;
};
type SavedVisualModulePreset = {
  contentSchema?: CmsVisualContentSchema;
  contentValues?: Record<string, unknown>;
  definitionId?: string;
  definitionRevision?: number;
  module?: CmsVisualModuleV2Props;
  moduleId: string;
  name: string;
  presetId: string;
  source?: "cms" | "local" | "system";
  tree: CmsVisualNode;
  version: number;
};

const visualModulePresetsStorageKey = "ecommium.cms.visualModulePresets.v1";
const solHighSplitHeroPresetId = "system-sol-high-split-hero-001";
const fourInfoSquaresPresetId = "system-four-info-squares-001";
const consultWorksSplitCtaPresetId = "system-consult-works-split-cta-001";

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

function createSolHighSplitHeroTree(): CmsVisualNode {
  return {
    nodeId: "sol-high-split-hero-001",
    type: "container",
    label: "Sol High split hero",
    animation: { preset: "fadeIn", durationMs: 520, easing: "standard", trigger: "load" },
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
      tablet: { gap: "24px", minHeight: "560px", padding: "40px" },
      mobile: { gap: "32px", gridTemplateColumns: "1fr", minHeight: "0", padding: "24px" },
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
        responsiveStyles: { tablet: { minHeight: "400px" }, mobile: { minHeight: "280px" } },
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
              height: "560px",
              maxWidth: "560px",
              objectFit: "contain",
              width: "100%",
            },
            responsiveStyles: { tablet: { height: "400px" }, mobile: { height: "300px", maxWidth: "420px" } },
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
        responsiveStyles: { mobile: { alignItems: "center", maxWidth: "100%" } },
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
            responsiveStyles: { mobile: { textAlign: "center" } },
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
            responsiveStyles: { tablet: { fontSize: "44px" }, mobile: { fontSize: "38px", textAlign: "center" } },
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
            responsiveStyles: { tablet: { fontSize: "44px" }, mobile: { fontSize: "38px", textAlign: "center" } },
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
            responsiveStyles: { mobile: { textAlign: "center" } },
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
            responsiveStyles: { mobile: { alignItems: "stretch", flexDirection: "column", width: "100%" } },
            children: [
              {
                nodeId: "sol-high-split-hero-001-primary-cta",
                type: "button",
                label: "CTA primary",
                contentBinding: "primaryButtonText",
                props: { ariaLabel: "Book a consultation", href: "/contact", text: "Book a Consultation ->" },
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
                props: { ariaLabel: "Explore our work", href: "/case-study", text: "Explore Our Work" },
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
      mobile: { padding: "48px 18px 72px" },
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
        responsiveStyles: { mobile: { fontSize: "26px" } },
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

function systemSavedVisualModulePresets(): SavedVisualModulePreset[] {
  return [
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
      moduleId: "sol-high-split-hero-001",
      name: "Sol High split hero",
      presetId: solHighSplitHeroPresetId,
      tree: createSolHighSplitHeroTree(),
      version: 1,
    },
    {
      contentSchema: consultWorksSplitCtaContentSchema,
      contentValues: consultWorksSplitCtaContentValues,
      moduleId: "consult-works-split-cta-001",
      name: "Consult works split CTA",
      presetId: consultWorksSplitCtaPresetId,
      tree: consultWorksSplitCtaTree,
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
      moduleId: "four-info-squares-001",
      name: "FourInfoSquares",
      presetId: fourInfoSquaresPresetId,
      tree: createFourInfoSquaresTree(),
      version: 1,
    },
  ];
}

function savedVisualModulePresetsFromDefinitions(visualModules?: CmsVisualModuleDefinitionsList): SavedVisualModulePreset[] {
  if (!visualModules) return [];
  return visualModules.items
    .filter((definition) => definition.status === "ACTIVE")
    .map((definition) => {
      const visualModule = normalizeCmsVisualModuleV2Props(definition.module);
      const moduleId = definition.moduleId || visualModule.moduleId || definition.definitionId;
      return {
        contentSchema: visualModule.contentSchema,
        contentValues: visualModule.contentValues ?? {},
        definitionId: definition.definitionId,
        definitionRevision: definition.revision,
        module: visualModule,
        moduleId,
        name: definition.name || visualModule.name || "Modulo visual",
        presetId: `cms-${definition.definitionId}`,
        source: "cms" as const,
        tree: normalizeCmsVisualNode({ nodeId: moduleId, type: "container", children: [] }),
        version: definition.revision,
      };
    });
}

function mergeSavedVisualModulePresets(
  localPresets: SavedVisualModulePreset[],
  cmsPresets: SavedVisualModulePreset[] = [],
) {
  const merged: SavedVisualModulePreset[] = [];
  const seenPresetIds = new Set<string>();
  const seenModuleIds = new Set<string>();

  function append(preset: SavedVisualModulePreset) {
    if (seenPresetIds.has(preset.presetId) || seenModuleIds.has(preset.moduleId)) return;
    seenPresetIds.add(preset.presetId);
    seenModuleIds.add(preset.moduleId);
    merged.push(preset);
  }

  cmsPresets.forEach(append);
  systemSavedVisualModulePresets().forEach(append);
  localPresets.forEach(append);
  return merged;
}

function textProp(block: CmsBlock, key: string, fallback = "") {
  const value = block.props[key];
  return typeof value === "string" ? value : fallback;
}

function boolProp(block: CmsBlock, key: string) {
  return block.props[key] === true;
}

function arrayProp(block: CmsBlock, key: string) {
  const value = block.props[key];
  return Array.isArray(value) ? value : [];
}

function placementProp(block: CmsBlock): CmsPlacement {
  return getCmsBlockPlacement(block);
}

function surfaceProp(block: CmsBlock): CmsSurface {
  return getCmsBlockSurface(block);
}

function blockLabel(block: CmsBlock) {
  if (block.type === "visual.module") {
    const name = block.props.name;
    return typeof name === "string" && name.trim() ? name : "Modulo visual";
  }
  const preset = getCmsBlockPresets().find((item) => item.type === block.type);
  return preset?.label ?? block.type;
}

function makeVisualEditorNodeId(type: string) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function remapVisualNodeIds(node: CmsVisualNode, forcedNodeId?: string): CmsVisualNode {
  const nodeId = forcedNodeId ?? makeVisualEditorNodeId(node.type);
  return {
    ...node,
    nodeId,
    children: node.children?.map((child) => remapVisualNodeIds(child)),
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeVisualContentSchema(value: unknown): CmsVisualContentSchema {
  const schema: CmsVisualContentSchema = {};
  for (const [key, rawField] of Object.entries(recordValue(value))) {
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

function visualContentFieldTypeForNode(node: CmsVisualNode): CmsVisualContentField["type"] {
  if (node.contentBinding?.toLowerCase().includes("color")) return "color";
  if (node.type === "richText" || node.type === "htmlEmbed") return "richText";
  if (node.type === "image" || node.type === "video") return "media";
  return "text";
}

function visualContentFieldTypeForStyle(key: string, bindingKey: string): CmsVisualContentField["type"] {
  if (bindingKey.toLowerCase().includes("color") || key.toLowerCase().includes("color")) return "color";
  if (key === "backgroundImage") return "media";
  return "text";
}

function visualContentBindings(node: CmsVisualNode): Array<{ field: CmsVisualContentField; key: string }> {
  const nodeBinding = node.contentBinding?.trim()
    ? [{
        key: node.contentBinding.trim(),
        field: {
          type: visualContentFieldTypeForNode(node),
          required: false,
          label: node.label ?? node.contentBinding.trim(),
        } satisfies CmsVisualContentField,
      }]
    : [];
  const styleBindings = Object.entries({
    ...(node.styles ?? {}),
    ...(node.responsiveStyles?.desktop ?? {}),
    ...(node.responsiveStyles?.tablet ?? {}),
    ...(node.responsiveStyles?.mobile ?? {}),
  }).flatMap(([styleKey, rawValue]) => {
    if (typeof rawValue !== "string" || !rawValue.startsWith("binding:")) return [];
    const key = rawValue.slice("binding:".length).trim();
    if (!key) return [];
    return [{
      key,
      field: {
        type: visualContentFieldTypeForStyle(styleKey, key),
        required: false,
        label: key,
      } satisfies CmsVisualContentField,
    }];
  });
  return [
    ...nodeBinding,
    ...styleBindings,
    ...(node.children ?? []).flatMap((child) => visualContentBindings(child)),
  ];
}

function inferVisualContentSchema(tree: CmsVisualNode, schema: CmsVisualContentSchema): CmsVisualContentSchema {
  const nextSchema = { ...schema };
  for (const binding of visualContentBindings(tree)) {
    nextSchema[binding.key] = {
      ...binding.field,
      ...(nextSchema[binding.key] ?? {}),
      label: nextSchema[binding.key]?.label ?? binding.field.label,
    };
  }
  return nextSchema;
}

function savedVisualModulePresetsFromJson(value: string | null): SavedVisualModulePreset[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): SavedVisualModulePreset[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const presetId = typeof record.presetId === "string" && record.presetId.trim() ? record.presetId.trim() : "";
      const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Modulo visual";
      const version = typeof record.version === "number" && Number.isFinite(record.version) && record.version > 0
        ? Math.floor(record.version)
        : 1;
      if (!presetId || !record.tree) return [];
      const tree = normalizeCmsVisualNode(record.tree);
      const contentSchema = inferVisualContentSchema(tree, normalizeVisualContentSchema(record.contentSchema));
      return [{
        contentSchema,
        contentValues: recordValue(record.contentValues),
        moduleId: typeof record.moduleId === "string" && record.moduleId.trim() ? record.moduleId.trim() : tree.nodeId,
        name,
        presetId,
        tree,
        version,
      }];
    });
  } catch {
    return [];
  }
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

function hydrateCmsVisualModuleReferenceBlock(block: CmsBlock, visualModules?: CmsVisualModuleDefinitionsList): CmsBlock {
  if (block.type !== "visual.module") return block;
  const definitionId = typeof block.props.definitionId === "string" ? block.props.definitionId.trim() : "";
  if (!definitionId) return block;
  const definition = visualModules?.items.find((item) => item.definitionId === definitionId && item.status === "ACTIVE");
  if (!definition) return block;
  const visualModule = normalizeCmsVisualModuleV2Props(definition.module);
  return {
    ...block,
    props: {
      ...block.props,
      ...visualModule,
      contentValues: {
        ...recordValue(visualModule.contentValues),
        ...recordValue(block.props.contentValues),
      },
      definitionId,
      definitionRevision: definition.revision,
      name: definition.name || visualModule.name || "Modulo visual",
      surface: "page",
      visualDefinitionReference: true,
    },
  };
}

function hydrateCmsVisualModuleReferences(blocks: CmsBlock[], visualModules?: CmsVisualModuleDefinitionsList): CmsBlock[] {
  return blocks.map((block) => hydrateCmsVisualModuleReferenceBlock(block, visualModules));
}

function editorBlocksForCmsDraftPayload(blocks: CmsBlock[]) {
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

function createCmsBlockFromSavedVisualPreset(preset: SavedVisualModulePreset): CmsBlock {
  const block = createCmsBlockFromPreset("visual.module");
  if (preset.module) {
    const visualModule = normalizeCmsVisualModuleV2Props(preset.module);
    return {
      ...block,
      props: {
        ...block.props,
        ...visualModule,
        contentValues: visualModule.contentValues ?? {},
        definitionId: preset.definitionId,
        definitionRevision: preset.definitionRevision ?? preset.version,
        name: `${preset.name} v${preset.version}`,
        surface: "page",
        visualDefinitionReference: true,
      },
      children: [],
    };
  }

  return {
    ...block,
    props: {
      ...block.props,
      contentSchema: preset.contentSchema ?? inferVisualContentSchema(preset.tree, {}),
      contentValues: preset.contentValues ?? {},
      name: `${preset.name} v${preset.version}`,
      schemaVersion: 1,
      surface: "page",
      tree: remapVisualNodeIds(preset.tree, "root"),
    },
    children: [],
  };
}

function visualModuleJsonForPublish(block: CmsBlock) {
  const schemaVersion = (block.props as { schemaVersion?: unknown }).schemaVersion;
  const moduleProps = schemaVersion === 2
    ? normalizeCmsVisualModuleV2Props(block.props)
    : migrateCmsVisualModuleV1ToV2ForRenderer(block.props);
  return JSON.stringify(moduleProps);
}

function plpTargetLabel(block: CmsBlock) {
  const target = getCmsBlockPlpTarget(block);
  return target.routePath || target.categorySlug || "sin target";
}

function withPlpDefaults(block: CmsBlock): CmsBlock {
  const placement = getCmsBlockPlacement(block) === "main" ? "beforeList" : getCmsBlockPlacement(block);
  return {
    ...block,
    props: {
      ...block.props,
      surface: "plp",
      placement,
      target: getCmsBlockPlpTarget(block),
    },
  };
}

function slotKey(slot: CmsModuleSlot) {
  return `${slot.region}|${slot.areaId}|${slot.columnIndex}`;
}

function firstSlot(slots: CmsModuleSlot[]): CmsModuleSlot | undefined {
  return slots.find((slot) => slot.region === "main") ?? slots[0];
}

function defaultModulePlacement(slots: CmsModuleSlot[], order = 1): CmsBlockModulePlacement | undefined {
  const slot = firstSlot(slots);
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

function modulePlacement(block: CmsBlock, slots: CmsModuleSlot[], order: number): CmsBlockModulePlacement | undefined {
  return block.placement ?? normalizeCmsBlockModulePlacement(block.props.placement) ?? defaultModulePlacement(slots, order);
}

function withModulePlacementDefaults(block: CmsBlock, slots: CmsModuleSlot[], order: number): CmsBlock {
  if (getCmsBlockSurface(block) === "plp") return block;
  const placement = modulePlacement(block, slots, order);
  if (!placement) return block;
  return {
    ...block,
    placement: {
      ...placement,
      order,
    },
    props: {
      ...block.props,
      surface: "page",
    },
  };
}

function withVisualPlacementOrders(blocks: CmsBlock[], slots: CmsModuleSlot[]) {
  return blocks.map((block, index) => withModulePlacementDefaults(block, slots, index + 1));
}

function placementLabel(block: CmsBlock, slots: CmsModuleSlot[], order: number) {
  if (getCmsBlockSurface(block) === "plp") return plpTargetLabel(block);
  const placement = modulePlacement(block, slots, order);
  return placement ? `${placement.region}/${placement.areaId}/col ${placement.columnIndex}` : "sin slot";
}

function placementSlotKey(placement: Pick<CmsBlockModulePlacement, "region" | "areaId" | "columnIndex">) {
  return `${placement.region}|${placement.areaId}|${placement.columnIndex}`;
}

function placementMatchesSlot(placement: CmsBlockModulePlacement, slots: CmsModuleSlot[]) {
  return slots.some((slot) => slotKey(slot) === placementSlotKey(placement));
}

function visibilityIsEmpty(placement: CmsBlockModulePlacement) {
  const visibility = placement.visibility ?? { mobile: true, tablet: true, desktop: true };
  return !visibility.mobile && !visibility.tablet && !visibility.desktop;
}

function modulePlacementIssues(blocks: CmsBlock[], slots: CmsModuleSlot[], mode: "all" | "plp") {
  if (mode === "plp") return [];

  const issues: string[] = [];
  const orderMap = new Map<string, string[]>();

  blocks.forEach((block, index) => {
    if (getCmsBlockSurface(block) === "plp") return;
    const placement = modulePlacement(block, slots, index + 1);
    const label = blockLabel(block);

    if (!placement) {
      issues.push(`${label} no tiene slot de layout asignado.`);
      return;
    }

    if (!placementMatchesSlot(placement, slots)) {
      issues.push(`${label} apunta a ${placement.region}/${placement.areaId}/col ${placement.columnIndex}, pero ese slot no existe.`);
    }

    if (visibilityIsEmpty(placement)) {
      issues.push(`${label} esta oculto en mobile, tablet y desktop.`);
    }

    const orderKey = `${placementSlotKey(placement)}|${placement.order}`;
    orderMap.set(orderKey, [...(orderMap.get(orderKey) ?? []), label]);
  });

  orderMap.forEach((labels, key) => {
    if (labels.length < 2) return;
    const [region, areaId, columnIndex, order] = key.split("|");
    issues.push(`Orden ${order} duplicado en ${region}/${areaId}/col ${columnIndex}: ${labels.join(", ")}.`);
  });

  return issues;
}

export function CmsBlockEditorClient({
  initialBlocks,
  locale,
  mode = "all",
  moduleSlots = [],
  pageId,
  publishVisualModuleAction,
  visualModules,
}: CmsBlockEditorClientProps) {
  const [blocks, setBlocks] = useState<CmsBlock[]>(() =>
    hydrateCmsVisualModuleReferences(initialBlocks, visualModules).map((block, index) =>
      withModulePlacementDefaults(block, moduleSlots, index + 1),
    ),
  );
  const [localSavedVisualModulePresets, setLocalSavedVisualModulePresets] = useState<SavedVisualModulePreset[]>(() =>
    typeof window === "undefined"
      ? []
      : savedVisualModulePresetsFromJson(window.localStorage.getItem(visualModulePresetsStorageKey)),
  );
  const cmsSavedVisualModulePresets = useMemo(() => savedVisualModulePresetsFromDefinitions(visualModules), [visualModules]);
  const savedVisualModulePresets = useMemo(
    () => mergeSavedVisualModulePresets(localSavedVisualModulePresets, cmsSavedVisualModulePresets),
    [cmsSavedVisualModulePresets, localSavedVisualModulePresets],
  );
  const orderedBlocks = useMemo(() => withVisualPlacementOrders(blocks, moduleSlots), [blocks, moduleSlots]);
  const serialized = useMemo(() => blocksToJson(editorBlocksForCmsDraftPayload(orderedBlocks)), [orderedBlocks]);
  const summary = useMemo(() => summarizePlacements(orderedBlocks), [orderedBlocks]);
  const visibleBlocks = useMemo(() => blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => mode !== "plp" || getCmsBlockSurface(block) === "plp"), [blocks, mode]);
  const presets = useMemo(() => {
    const all = getCmsBlockPresets();
    return mode === "plp" ? all.filter((preset) => preset.surface === "plp") : all;
  }, [mode]);
  const placementIssues = useMemo(() => modulePlacementIssues(orderedBlocks, moduleSlots, mode), [orderedBlocks, moduleSlots, mode]);

  useEffect(() => {
    function handleVisualPresetStorage(event: StorageEvent) {
      if (event.key === visualModulePresetsStorageKey) {
        setLocalSavedVisualModulePresets(savedVisualModulePresetsFromJson(event.newValue));
      }
    }
    window.addEventListener("storage", handleVisualPresetStorage);
    return () => window.removeEventListener("storage", handleVisualPresetStorage);
  }, []);

  function updateBlock(index: number, updater: (block: CmsBlock) => CmsBlock) {
    setBlocks((current) => current.map((block, currentIndex) =>
      currentIndex === index ? updater(block) : block,
    ));
  }

  function updateProp(index: number, key: string, value: unknown) {
    updateBlock(index, (block) => {
      if (key === "surface" && value === "plp") {
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

      if (key === "surface" && value === "page") {
        return withModulePlacementDefaults({
          ...block,
          props: {
            ...block.props,
            surface: "page",
            placement: "main",
          },
        }, moduleSlots, index + 1);
      }

      return {
        ...block,
        props: {
          ...block.props,
          [key]: value,
        },
      };
    });
  }

  function updateTargetProp(index: number, key: string, value: string) {
    updateBlock(index, (block) => {
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

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  function removeBlock(index: number) {
    setBlocks((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function addBlock(type: string) {
    const nextBlock = createCmsBlockFromPreset(type);
    setBlocks((current) => [...current, mode === "plp"
      ? withPlpDefaults(nextBlock)
      : withModulePlacementDefaults(nextBlock, moduleSlots, current.length + 1),
    ]);
  }

  function addSavedVisualBlock(presetId: string) {
    const preset = savedVisualModulePresets.find((item) => item.presetId === presetId);
    if (!preset) return;
    const nextBlock = createCmsBlockFromSavedVisualPreset(preset);
    setBlocks((current) => [...current, withModulePlacementDefaults(nextBlock, moduleSlots, current.length + 1)]);
  }

  return (
    <div className="cmsBuilder">
      <input type="hidden" name="blocksJson" value={serialized} />
      <div className="cmsBuilderLibrary" aria-label="Biblioteca de bloques">
        <div className="pricingPanelHeader">
          <div>
            <h2>{mode === "plp" ? "Bloques PLP" : "Bloques"}</h2>
            <p>{mode === "plp" ? "Añade zonas antes o despues de la lista." : "Prefabricados y listos para extender."}</p>
          </div>
        </div>
        <div className="cmsPresetList">
          {mode !== "plp" && savedVisualModulePresets.length > 0 ? (
            <div className="cmsSavedVisualPresetList" aria-label="Bloques guardados">
              <span>Bloques guardados</span>
              {savedVisualModulePresets.map((preset) => (
                <button
                  className="adminButton adminButtonSecondary"
                  key={preset.presetId}
                  type="button"
                  onClick={() => addSavedVisualBlock(preset.presetId)}
                >
                  <CopyPlus size={16} aria-hidden="true" />
                  <span>{preset.name} v{preset.version}</span>
                </button>
              ))}
            </div>
          ) : null}
          {presets.map((preset) => (
            <button
              className="adminButton adminButtonSecondary"
              key={preset.type}
              type="button"
              onClick={() => addBlock(preset.type)}
            >
              <CopyPlus size={16} aria-hidden="true" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
        {mode === "plp" ? (
          <div className="cmsBuilderHint">
            Elige un bloque, completa `URL PLP` o `Slug categoria`, ajusta la ubicacion y guarda el draft.
          </div>
        ) : null}
        {mode !== "plp" ? (
          <div className={`cmsEditorValidation ${placementIssues.length > 0 ? "cmsEditorValidationWarning" : "cmsEditorValidationOk"}`} role={placementIssues.length > 0 ? "alert" : "status"}>
            <strong>{placementIssues.length > 0 ? `${placementIssues.length} alertas de placement` : "Placements listos"}</strong>
            {placementIssues.length > 0 ? (
              <ul>
                {placementIssues.slice(0, 5).map((issue) => <li key={issue}>{issue}</li>)}
                {placementIssues.length > 5 ? <li>{placementIssues.length - 5} alertas mas.</li> : null}
              </ul>
            ) : <span>Todos los modulos de pagina apuntan a slots activos.</span>}
          </div>
        ) : null}
        <dl className="pricingDefinitionGrid cmsPlacementSummary">
          <div>
            <dt>Main</dt>
            <dd>{summary.main}</dd>
          </div>
          <div>
            <dt>Antes PLP</dt>
            <dd>{summary.beforeList}</dd>
          </div>
          <div>
            <dt>Despues PLP</dt>
            <dd>{summary.afterList}</dd>
          </div>
        </dl>
      </div>

      <div className="cmsBuilderCanvas">
        {visibleBlocks.length === 0 ? (
          <div className="adminEmptyState">{mode === "plp" ? "Añade un bloque PLP desde la biblioteca de la izquierda." : "Agrega un bloque para empezar la composicion."}</div>
        ) : visibleBlocks.map(({ block, index }, visibleIndex) => (
          <details className="cmsBlockCard cmsBlockDetails" key={block.blockId}>
            <summary className="cmsBlockHeader">
              <div>
                <strong>{visibleIndex + 1}. {blockLabel(block)}</strong>
                <span>{block.blockId} - {getCmsBlockSurface(block)} - {placementLabel(block, moduleSlots, visibleIndex + 1)}</span>
              </div>
              <div className="adminButtonRow">
                <button className="adminIconButton" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); moveBlock(index, -1); }} aria-label="Subir bloque">
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button className="adminIconButton" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); moveBlock(index, 1); }} aria-label="Bajar bloque">
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button className="adminIconButton adminIconButtonDanger" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); removeBlock(index); }} aria-label="Eliminar bloque">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </summary>
            <BlockFields
              block={block}
              locale={locale}
              moduleSlots={moduleSlots}
              onPlacementChange={(placement) => updateBlock(index, (current) => ({ ...current, placement }))}
              onPropChange={(key, value) => updateProp(index, key, value)}
              onTargetChange={(key, value) => updateTargetProp(index, key, value)}
              pageId={pageId}
              publishVisualModuleAction={publishVisualModuleAction}
            />
          </details>
        ))}
      </div>

      <div className="cmsBuilderPreview">
        <div className="pricingPanelHeader">
          <div>
            <h2>Preview draft</h2>
            <p>Render local con los mismos bloques guardados en CMS.</p>
          </div>
        </div>
        <div className="cmsPreviewFrame">
          {mode === "plp" ? <CmsPlpStorefrontPreviewRenderer blocks={orderedBlocks} /> : orderedBlocks.map((block) => (
            <CmsBlockRenderer block={block} key={block.blockId} mode="admin-preview" />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  locale,
  moduleSlots,
  onPlacementChange,
  onPropChange,
  onTargetChange,
  pageId,
  publishVisualModuleAction,
}: {
  block: CmsBlock;
  locale?: string;
  moduleSlots: CmsModuleSlot[];
  onPlacementChange: (placement: CmsModulePlacement) => void;
  onPropChange: (key: string, value: unknown) => void;
  onTargetChange: (key: keyof ReturnType<typeof getCmsBlockPlpTarget>, value: string) => void;
  pageId?: string;
  publishVisualModuleAction?: (formData: FormData) => void | Promise<void>;
}) {
  const surface = surfaceProp(block);
  const target = getCmsBlockPlpTarget(block);
  return (
    <div className="cmsBlockFields">
      <label className="adminField">
        <span>Superficie</span>
        <select
          value={surface}
          onChange={(event) => onPropChange("surface", event.target.value)}
        >
          <option value="page">Pagina CMS</option>
          <option value="plp">PLP / listing</option>
        </select>
      </label>
      <label className="adminField">
        <span>Ubicacion</span>
        <select
          value={placementProp(block)}
          onChange={(event) => onPropChange("placement", event.target.value)}
        >
          <option value="main">Contenido principal</option>
          <option value="beforeList">Antes de lista PLP</option>
          <option value="afterList">Despues de lista PLP</option>
        </select>
      </label>
      {surface === "page" ? (
        <ModulePlacementFields
          block={block}
          moduleSlots={moduleSlots}
          onPlacementChange={onPlacementChange}
        />
      ) : null}
      {surface === "plp" ? (
        <fieldset className="cmsBlockFieldset">
          <legend>Target PLP</legend>
          <label className="adminField">
            <span>Tipo listing</span>
            <select
              value={target.listingKind}
              onChange={(event) => onTargetChange("listingKind", event.target.value as CmsPlpListingKind)}
            >
              <option value="CATEGORY">Categoria</option>
              <option value="SEARCH">Busqueda</option>
              <option value="COLLECTION">Coleccion</option>
            </select>
          </label>
          <TextField
            label="URL PLP"
            value={target.routePath}
            onChange={(value) => onTargetChange("routePath", value)}
          />
          <TextField
            label="Slug categoria"
            value={target.categorySlug}
            onChange={(value) => onTargetChange("categorySlug", value)}
          />
        </fieldset>
      ) : null}
      {block.type === "banner.hero" ? (
        <>
          <TextField label="Eyebrow" value={textProp(block, "eyebrow")} onChange={(value) => onPropChange("eyebrow", value)} />
          <TextField label="Titulo" value={textProp(block, "heading")} onChange={(value) => onPropChange("heading", value)} />
          <TextAreaField label="Texto" value={textProp(block, "body")} onChange={(value) => onPropChange("body", value)} />
          <TextField label="Imagen URL" value={textProp(block, "imageUrl")} onChange={(value) => onPropChange("imageUrl", value)} />
          <TextField label="CTA label" value={textProp(block, "ctaLabel")} onChange={(value) => onPropChange("ctaLabel", value)} />
          <TextField label="CTA href" value={textProp(block, "ctaHref", "/")} onChange={(value) => onPropChange("ctaHref", value)} />
        </>
      ) : null}
      {block.type === "slider.fullWidth" ? (
        <>
          <label className="adminField">
            <span>Autoplay</span>
            <select
              value={String(boolProp(block, "autoplay"))}
              onChange={(event) => onPropChange("autoplay", event.target.value === "true")}
            >
              <option value="false">No</option>
              <option value="true">Si</option>
            </select>
          </label>
          <CollectionTextarea
            label="Slides JSON"
            value={arrayProp(block, "slides")}
            onChange={(value) => onPropChange("slides", value)}
          />
        </>
      ) : null}
      {block.type === "plp.categoryIntro" ? (
        <>
          <TextField label="Titulo categoria" value={textProp(block, "heading")} onChange={(value) => onPropChange("heading", value)} />
          <TextAreaField label="Descripcion" value={textProp(block, "body")} onChange={(value) => onPropChange("body", value)} />
          <TextField label="Imagen URL" value={textProp(block, "imageUrl")} onChange={(value) => onPropChange("imageUrl", value)} />
        </>
      ) : null}
      {block.type === "plp.subcategoryTiles" ? (
        <>
          <TextField label="Titulo" value={textProp(block, "heading")} onChange={(value) => onPropChange("heading", value)} />
          <CollectionTextarea
            label="Subcategorias JSON"
            value={arrayProp(block, "items")}
            onChange={(value) => onPropChange("items", value)}
          />
        </>
      ) : null}
      {block.type === "accordion" ? (
        <>
          <TextField label="Titulo grupo" value={textProp(block, "heading")} onChange={(value) => onPropChange("heading", value)} />
          <CollectionTextarea
            label="Items JSON"
            value={arrayProp(block, "items")}
            onChange={(value) => onPropChange("items", value)}
          />
        </>
      ) : null}
      {block.type === "carousel" ? (
        <>
          <TextField label="Titulo" value={textProp(block, "heading")} onChange={(value) => onPropChange("heading", value)} />
          <CollectionTextarea
            label="Cards JSON"
            value={arrayProp(block, "items")}
            onChange={(value) => onPropChange("items", value)}
          />
        </>
      ) : null}
      {block.type === "visual.module" ? (
        <>
          <VisualModulePublishFields
            block={block}
            locale={locale}
            pageId={pageId}
            publishVisualModuleAction={publishVisualModuleAction}
          />
          <VisualModuleContentFields block={block} onContentValuesChange={(values) => onPropChange("contentValues", values)} />
        </>
      ) : null}
      <label className="adminField cmsJsonField">
        <span>Props JSON</span>
        <textarea value={JSON.stringify(block.props, null, 2)} readOnly />
      </label>
    </div>
  );
}

function VisualModulePublishFields({
  block,
  locale,
  pageId,
  publishVisualModuleAction,
}: {
  block: CmsBlock;
  locale?: string;
  pageId?: string;
  publishVisualModuleAction?: (formData: FormData) => void | Promise<void>;
}) {
  if (!publishVisualModuleAction) return null;
  const name = blockLabel(block).replace(/\s+v\d+$/i, "");
  const definitionId = typeof block.props.definitionId === "string" && block.props.definitionId.trim()
    ? block.props.definitionId.trim()
    : "";
  const isPublishedReference = block.props.visualDefinitionReference === true || Boolean(definitionId);

  return (
    <fieldset className="cmsBlockFieldset">
      <legend>Publicacion del modulo visual</legend>
      {definitionId ? <input name={`visualDefinitionId-${block.blockId}`} type="hidden" value={definitionId} /> : null}
      <input name={`visualDefinitionName-${block.blockId}`} type="hidden" value={name} />
      <input name={`visualModuleJson-${block.blockId}`} type="hidden" value={visualModuleJsonForPublish(block)} />
      <input name="visualDefinitionReturn" type="hidden" value="editor" />
      {pageId ? <input name="pageId" type="hidden" value={pageId} /> : null}
      {locale ? <input name="locale" type="hidden" value={locale} /> : null}
      {isPublishedReference ? (
        <button className="adminButton" disabled type="button">
          Publicado en CMS
        </button>
      ) : (
        <button
          className="adminButton adminButtonPrimary"
          formAction={publishVisualModuleAction}
          name="visualDefinitionIntent"
          type="submit"
          value={`publish:${block.blockId}`}
        >
          Publicar modulo
        </button>
      )}
    </fieldset>
  );
}

function VisualModuleContentFields({
  block,
  onContentValuesChange,
}: {
  block: CmsBlock;
  onContentValuesChange: (values: Record<string, unknown>) => void;
}) {
  const moduleProps = normalizeCmsVisualModuleProps(block.props);
  const schema = inferVisualContentSchema(moduleProps.tree, moduleProps.contentSchema ?? {});
  const values = recordValue(block.props.contentValues);
  const fields = Object.entries(schema);

  function updateValue(key: string, value: unknown) {
    onContentValuesChange({
      ...values,
      [key]: value,
    });
  }

  if (!fields.length) {
    return (
      <div className="cmsBuilderHint">
        Este modulo visual no declara contentSchema. Define bindings en Builder y guardalo otra vez para editar contenido por pagina.
      </div>
    );
  }

  return (
    <fieldset className="cmsBlockFieldset cmsVisualModuleContentFieldset">
      <legend>Contenido del modulo visual</legend>
      {fields.map(([key, field]) => (
        <VisualContentValueField
          field={field}
          key={key}
          name={key}
          onChange={(value) => updateValue(key, value)}
          value={values[key] ?? field.defaultValue ?? ""}
        />
      ))}
    </fieldset>
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

  if (field.type === "boolean") {
    return (
      <label className="adminCheckbox">
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

function ModulePlacementFields({
  block,
  moduleSlots,
  onPlacementChange,
}: {
  block: CmsBlock;
  moduleSlots: CmsModuleSlot[];
  onPlacementChange: (placement: CmsModulePlacement) => void;
}) {
  const placement = modulePlacement(block, moduleSlots, 1);
  const selectedKey = placement ? `${placement.region}|${placement.areaId}|${placement.columnIndex}` : "";

  function changePlacement(partial: Partial<CmsModulePlacement>) {
    const next = {
      ...(placement ?? defaultModulePlacement(moduleSlots, 1)),
      ...partial,
    };
    if (next?.areaId) {
      onPlacementChange(next as CmsModulePlacement);
    }
  }

  return (
    <fieldset className="cmsBlockFieldset cmsModulePlacementFieldset">
      <legend>Placement del modulo</legend>
      <div className="cmsModulePlacementTopRow">
        <label className="adminField">
          <span>Region / area / columna</span>
          <select
            value={selectedKey}
            disabled={moduleSlots.length === 0}
            onChange={(event) => {
              const [region, areaId, columnIndex] = event.target.value.split("|");
              changePlacement({ region: region as CmsModulePlacement["region"], areaId, columnIndex: Number(columnIndex) || 1 });
            }}
          >
            {moduleSlots.length === 0 ? <option value="">Sin slots disponibles</option> : null}
            {moduleSlots.map((slot) => (
              <option key={slotKey(slot)} value={slotKey(slot)}>
                {slot.region} / {slot.areaId} / col {slot.columnIndex} ({slot.width})
              </option>
            ))}
          </select>
        </label>
        <label className="adminField cmsModulePlacementWidthField">
          <span>Ancho modulo</span>
          <input value={placement?.width ?? "100%"} onChange={(event) => changePlacement({ width: event.target.value })} />
        </label>
        <label className="adminField">
          <span>Alineacion</span>
          <select value={placement?.align ?? "stretch"} onChange={(event) => changePlacement({ align: event.target.value as CmsModulePlacement["align"] })}>
            <option value="stretch">Stretch</option>
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
          </select>
        </label>
        <label className="adminField">
          <span>Container</span>
          <select value={placement?.containerMode ?? "inherit"} onChange={(event) => changePlacement({ containerMode: event.target.value as CmsModulePlacement["containerMode"] })}>
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
              type="checkbox"
              checked={placement?.visibility?.[device] !== false}
              onChange={(event) => changePlacement({
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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="adminField">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="adminField">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CollectionTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown[];
  onChange: (value: unknown[]) => void;
}) {
  const [draft, setDraft] = useState(JSON.stringify(value, null, 2));
  return (
    <label className="adminField cmsJsonField">
      <span>{label}</span>
      <textarea
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          try {
            const parsed = JSON.parse(next);
            if (Array.isArray(parsed)) {
              onChange(parsed);
            }
          } catch {
            // Invalid JSON remains editable but is not persisted into hidden payload.
          }
        }}
      />
    </label>
  );
}
