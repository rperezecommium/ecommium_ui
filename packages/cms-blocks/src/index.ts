export type CmsPlacement = "main" | "beforeList" | "afterList";
export type CmsSurface = "page" | "plp";
export type CmsBlockModulePlacement = {
  region: "header" | "main" | "footer";
  areaId: string;
  columnIndex: number;
  order: number;
  width?: string | null;
  align?: "start" | "center" | "end" | "stretch";
  spacing?: {
    marginTop?: string;
    marginBottom?: string;
    paddingTop?: string;
    paddingBottom?: string;
  };
  visibility?: {
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  };
  containerMode?: "inherit" | "full-width" | "container";
};
export type CmsPlpListingKind = "CATEGORY" | "SEARCH" | "COLLECTION";
export type CmsVisualBreakpoint = "mobile" | "tablet" | "desktop";
export type CmsVisualResponsiveVisibility = Partial<Record<CmsVisualBreakpoint, boolean>>;
export type CmsVisualAnimationPreset = "none" | "fadeIn" | "slideUp" | "scaleIn";
export type CmsVisualAnimationEasing = "standard" | "emphasized" | "linear";
export type CmsVisualAnimationTrigger = "load" | "inView";
export type CmsVisualAnimation = {
  preset: CmsVisualAnimationPreset;
  durationMs?: number;
  delayMs?: number;
  easing?: CmsVisualAnimationEasing;
  trigger?: CmsVisualAnimationTrigger;
};
export const cmsVisualHoverStyleKeys = [
  "backgroundColor",
  "borderColor",
  "boxShadow",
  "color",
  "opacity",
  "transform",
] as const;
export type CmsVisualHoverStyleKey = typeof cmsVisualHoverStyleKeys[number];
export type CmsVisualInteractionTransition = {
  durationMs?: number;
  delayMs?: number;
  easing?: CmsVisualAnimationEasing;
};
export type CmsVisualHoverInteraction = {
  styles?: Partial<Record<CmsVisualHoverStyleKey, string>>;
  transition?: CmsVisualInteractionTransition;
};
export type CmsVisualInteractions = {
  hover?: CmsVisualHoverInteraction;
};
export type CmsVisualNodeType =
  | "container"
  | "section"
  | "div"
  | "grid"
  | "flex"
  | "heading"
  | "paragraph"
  | "richText"
  | "image"
  | "button"
  | "link"
  | "icon"
  | "spacer"
  | "video"
  | "htmlEmbed";
export type CmsVisualNodeStyle = {
  alignItems?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundPosition?: string;
  backgroundSize?: string;
  border?: string;
  borderColor?: string;
  borderRadius?: string;
  borderStyle?: string;
  borderWidth?: string;
  boxShadow?: string;
  color?: string;
  columnGap?: string;
  display?: string;
  aspectRatio?: string;
  flexDirection?: string;
  flexWrap?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  gap?: string;
  gridTemplateColumns?: string;
  height?: string;
  justifyContent?: string;
  letterSpacing?: string;
  lineHeight?: string;
  margin?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  marginTop?: string;
  maxHeight?: string;
  maxWidth?: string;
  minHeight?: string;
  minWidth?: string;
  objectFit?: string;
  opacity?: string;
  overflow?: string;
  padding?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  position?: string;
  rowGap?: string;
  textAlign?: string;
  transform?: string;
  width?: string;
};
export type CmsVisualResponsiveStyles = Partial<Record<CmsVisualBreakpoint, CmsVisualNodeStyle>>;
export type CmsVisualStyleScope = "base" | CmsVisualBreakpoint;
export type CmsVisualStyleDeclaration = Record<string, string>;
export type CmsVisualStylesByScope = Partial<Record<CmsVisualStyleScope, CmsVisualStyleDeclaration>>;
export type CmsVisualNodeProps = {
  alt?: string;
  ariaLabel?: string;
  headingLevel?: string;
  href?: string;
  html?: string;
  level?: string;
  rel?: string;
  src?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  text?: string;
  title?: string;
};
export type CmsVisualNode = {
  nodeId: string;
  type: CmsVisualNodeType;
  label?: string;
  contentBinding?: string;
  visibility?: CmsVisualResponsiveVisibility;
  animation?: CmsVisualAnimation;
  interactions?: CmsVisualInteractions;
  props?: CmsVisualNodeProps;
  styles?: CmsVisualNodeStyle;
  responsiveStyles?: CmsVisualResponsiveStyles;
  children?: CmsVisualNode[];
};
export type CmsVisualModuleProps = {
  schemaVersion: 1;
  name?: string;
  assetRefs?: CmsVisualAssetRef[];
  contentSchema?: CmsVisualContentSchema;
  contentValues?: Record<string, unknown>;
  tree: CmsVisualNode;
};
export type CmsVisualContentFieldType = "text" | "richText" | "url" | "media" | "boolean" | "number" | "color";
export type CmsVisualContentField = {
  type: CmsVisualContentFieldType;
  required: boolean;
  label?: string | null;
  defaultValue?: unknown;
};
export type CmsVisualContentSchema = Record<string, CmsVisualContentField>;
export type CmsVisualAssetRef = {
  assetKey: string;
  mediaAssetId?: string;
  role?: "background" | "image" | "video" | "icon";
  src?: string;
  url?: string;
  alt?: string | null;
  focalPoint?: {
    x: number;
    y: number;
  } | null;
};
export type CmsVisualElement = {
  elementId: string;
  elementType: CmsVisualNodeType;
  label?: string | null;
  contentBinding?: string | null;
  visibility?: CmsVisualResponsiveVisibility;
  animation?: CmsVisualAnimation;
  interactions?: CmsVisualInteractions;
  props?: Record<string, unknown>;
  styles?: CmsVisualStylesByScope;
  children?: CmsVisualElement[];
  elements?: CmsVisualElement[];
};
export type CmsVisualPanel = {
  panelId: string;
  label?: string | null;
  visibility?: CmsVisualResponsiveVisibility;
  animation?: CmsVisualAnimation;
  interactions?: CmsVisualInteractions;
  props?: Record<string, unknown>;
  styles?: CmsVisualStylesByScope;
  elements?: CmsVisualElement[];
  panels?: CmsVisualPanel[];
};
export type CmsVisualModuleV2Props = {
  schemaVersion: 2;
  schemaMinorVersion?: number;
  moduleId: string;
  type: string;
  name?: string | null;
  visibility?: CmsVisualResponsiveVisibility;
  animation?: CmsVisualAnimation;
  interactions?: CmsVisualInteractions;
  styles?: CmsVisualStylesByScope;
  panels: CmsVisualPanel[];
  elements?: CmsVisualElement[];
  contentSchema: CmsVisualContentSchema;
  contentValues?: Record<string, unknown>;
  assetRefs?: CmsVisualAssetRef[];
};
export type CmsVisualModuleDefinitionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type CmsVisualModuleDefinition = {
  definitionId: string;
  organizationId?: string;
  shopId?: string;
  moduleId: string;
  name: string;
  schemaVersion: 2;
  schemaMinorVersion: number;
  revision: number;
  status: CmsVisualModuleDefinitionStatus;
  module: CmsVisualModuleV2Props;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string | null;
  archivedAt?: string | null;
};
export type CmsVisualModuleRendererProps = CmsVisualModuleProps | CmsVisualModuleV2Props;
export type CmsBlockType =
  | "banner.hero"
  | "slider.fullWidth"
  | "plp.categoryIntro"
  | "plp.subcategoryTiles"
  | "accordion"
  | "carousel"
  | "visual.module";

export type CmsBlock = {
  blockId: string;
  type: CmsBlockType | string;
  placement?: CmsBlockModulePlacement;
  props: Record<string, unknown>;
  children?: CmsBlock[];
};

export type CmsBlockEditorFieldType =
  | "text"
  | "textarea"
  | "url"
  | "boolean"
  | "json"
  | "plpTarget";

export type CmsBlockEditorField = {
  key: string;
  label: string;
  type: CmsBlockEditorFieldType;
  required?: boolean;
  helperText?: string;
};

export type CmsBlockPreset = {
  type: CmsBlockType;
  label: string;
  description: string;
  placement: CmsPlacement;
  surface: CmsSurface;
  create: () => CmsBlock;
};

export type CmsBlockDefinition = CmsBlockPreset & {
  schemaVersion: number;
  supportedSurfaces: CmsSurface[];
  editorFields: CmsBlockEditorField[];
};

export type CmsPlpTarget = {
  listingKind: CmsPlpListingKind;
  routePath: string;
  categorySlug: string;
};

function makeBlockId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createEmptyPlpTarget(): CmsPlpTarget {
  return {
    listingKind: "CATEGORY",
    routePath: "",
    categorySlug: "",
  };
}

function makeVisualNodeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultVisualModuleTree(): CmsVisualNode {
  return {
    nodeId: "heroModule-prototype-images-001",
    type: "container",
    label: "Prototype hero",
    styles: {
      backgroundColor: "#f47db8",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.78fr)",
      minHeight: "488px",
      overflow: "hidden",
      padding: "60px 72px",
    },
    responsiveStyles: {
      mobile: {
        gridTemplateColumns: "1fr",
        minHeight: "720px",
        padding: "36px 22px",
      },
    },
    children: [
      {
        nodeId: "heroModule-prototype-images-001-copy",
        type: "section",
        label: "Copy panel",
        styles: {
          alignItems: "flex-start",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        },
        children: [
          {
            nodeId: "heroModule-prototype-images-001-heading",
            type: "heading",
            label: "Heading",
            contentBinding: "heading",
            props: {
              level: "1",
              text: "Design and prototype hero images for your website",
            },
            styles: {
              color: "#111111",
              fontSize: "44px",
              fontWeight: "800",
              lineHeight: "1.28",
              maxWidth: "860px",
            },
            responsiveStyles: {
              mobile: {
                fontSize: "38px",
              },
            },
            children: [],
          },
          {
            nodeId: "heroModule-prototype-images-001-cta",
            type: "button",
            label: "CTA",
            contentBinding: "buttonText",
            props: {
              text: "Download Free",
            },
            styles: {
              alignItems: "center",
              backgroundColor: "#111111",
              borderRadius: "6px",
              color: "#ffffff",
              display: "inline-flex",
              fontSize: "30px",
              fontWeight: "800",
              justifyContent: "center",
              marginTop: "52px",
              minWidth: "542px",
              padding: "28px 42px",
              textAlign: "center",
            },
            responsiveStyles: {
              mobile: {
                fontSize: "22px",
                minWidth: "0",
                width: "100%",
              },
            },
            children: [],
          },
        ],
      },
      {
        nodeId: "heroModule-prototype-images-001-art",
        type: "section",
        label: "Art panel",
        styles: {
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          minHeight: "360px",
          position: "relative",
          width: "100%",
        },
        children: [
          {
            nodeId: "heroModule-prototype-images-001-card-back",
            type: "div",
            label: "Back card",
            styles: {
              backgroundColor: "#f6a3cb",
              borderRadius: "4px",
              boxShadow: "0 16px 40px rgba(150, 42, 96, 0.18)",
              height: "292px",
              marginLeft: "-210px",
              marginTop: "-28px",
              opacity: "0.76",
              position: "absolute",
              width: "172px",
            },
            children: [
              {
                nodeId: "heroModule-prototype-images-001-card-circle",
                type: "div",
                label: "Back card circle",
                styles: {
                  backgroundColor: "#e78abd",
                  borderRadius: "999px",
                  height: "48px",
                  marginLeft: "28px",
                  marginTop: "82px",
                  position: "absolute",
                  width: "48px",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-card-line-a",
                type: "div",
                label: "Back card line",
                styles: {
                  backgroundColor: "#c4699c",
                  borderRadius: "999px",
                  height: "4px",
                  marginLeft: "18px",
                  marginTop: "236px",
                  position: "absolute",
                  width: "42px",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-card-line-b",
                type: "div",
                label: "Back card line",
                styles: {
                  backgroundColor: "#c4699c",
                  borderRadius: "999px",
                  height: "4px",
                  marginLeft: "18px",
                  marginTop: "262px",
                  opacity: "0.5",
                  position: "absolute",
                  width: "82px",
                },
                children: [],
              },
            ],
          },
          {
            nodeId: "heroModule-prototype-images-001-phone",
            type: "div",
            label: "Phone",
            styles: {
              backgroundColor: "#f8fafc",
              border: "4px solid #111111",
              borderRadius: "24px",
              boxShadow: "0 18px 32px rgba(80, 12, 44, 0.22)",
              height: "338px",
              marginLeft: "-48px",
              marginTop: "-48px",
              position: "absolute",
              width: "172px",
            },
            children: [
              {
                nodeId: "heroModule-prototype-images-001-phone-title",
                type: "paragraph",
                label: "Phone title",
                props: { text: "Products" },
                styles: {
                  color: "#111111",
                  fontSize: "12px",
                  fontWeight: "800",
                  marginLeft: "18px",
                  marginTop: "38px",
                  position: "absolute",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-phone-arc",
                type: "div",
                label: "Phone arc",
                styles: {
                  backgroundColor: "#cad5e8",
                  borderRadius: "80px 0 0 0",
                  height: "54px",
                  marginLeft: "64px",
                  marginTop: "72px",
                  position: "absolute",
                  width: "92px",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-phone-tile",
                type: "div",
                label: "Phone tile",
                styles: {
                  backgroundColor: "#c6d0e4",
                  borderRadius: "2px",
                  height: "54px",
                  marginLeft: "84px",
                  marginTop: "138px",
                  position: "absolute",
                  width: "60px",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-phone-dot",
                type: "div",
                label: "Phone dot",
                styles: {
                  backgroundColor: "#c8d3e7",
                  borderRadius: "999px",
                  height: "18px",
                  marginLeft: "54px",
                  marginTop: "168px",
                  position: "absolute",
                  width: "18px",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-phone-block-a",
                type: "div",
                label: "Phone block",
                styles: {
                  backgroundColor: "#c8d3e7",
                  borderRadius: "0 32px 0 0",
                  height: "44px",
                  marginLeft: "0",
                  marginTop: "200px",
                  position: "absolute",
                  width: "62px",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-phone-line-a",
                type: "div",
                label: "Phone line",
                styles: {
                  backgroundColor: "#c8d3e7",
                  borderRadius: "999px",
                  height: "4px",
                  marginLeft: "28px",
                  marginTop: "282px",
                  position: "absolute",
                  width: "24px",
                },
                children: [],
              },
              {
                nodeId: "heroModule-prototype-images-001-phone-line-b",
                type: "div",
                label: "Phone line",
                styles: {
                  backgroundColor: "#111111",
                  borderRadius: "999px",
                  height: "4px",
                  marginLeft: "28px",
                  marginTop: "292px",
                  position: "absolute",
                  width: "24px",
                },
                children: [],
              },
            ],
          },
          {
            nodeId: "heroModule-prototype-images-001-hand",
            type: "div",
            label: "Hand",
            styles: {
              backgroundColor: "#ff83bd",
              border: "3px solid #111111",
              borderRadius: "70px 70px 0 0",
              height: "186px",
              marginLeft: "162px",
              marginTop: "166px",
              position: "absolute",
              transform: "rotate(14deg)",
              width: "82px",
            },
            children: [
              {
                nodeId: "heroModule-prototype-images-001-finger",
                type: "div",
                label: "Finger",
                styles: {
                  backgroundColor: "#ff83bd",
                  border: "3px solid #111111",
                  borderRadius: "30px 12px 12px 30px",
                  height: "34px",
                  marginLeft: "-10px",
                  marginTop: "-42px",
                  position: "absolute",
                  transform: "rotate(-18deg)",
                  width: "72px",
                },
                children: [],
              },
            ],
          },
          {
            nodeId: "heroModule-prototype-images-001-gesture-list",
            type: "div",
            label: "Gesture list",
            styles: {
              backgroundColor: "#f8fafc",
              borderRadius: "4px",
              boxShadow: "0 8px 24px rgba(70, 18, 48, 0.16)",
              display: "flex",
              flexDirection: "column",
              gap: "7px",
              marginLeft: "340px",
              marginTop: "-116px",
              padding: "11px 12px",
              position: "absolute",
              width: "146px",
            },
            children: [
              "on Tap Hold",
              "on Swipe Up",
              "on Swipe Down",
              "on Swipe Left",
              "on Swipe Right",
              "on Pinch Open",
              "on Rotate Left",
            ].map((label, index) => ({
              nodeId: `heroModule-prototype-images-001-gesture-${index + 1}`,
              type: "paragraph",
              label: `Gesture ${index + 1}`,
              props: { text: label },
              styles: {
                color: "#373737",
                fontSize: "10px",
                lineHeight: "1",
                margin: "0",
                paddingLeft: "22px",
              },
              children: [],
            })),
          },
        ],
      },
    ],
  };
}

const textContentFields: CmsBlockEditorField[] = [
  { key: "heading", label: "Titulo", type: "text", required: true },
  { key: "body", label: "Texto", type: "textarea" },
  { key: "imageUrl", label: "Imagen URL", type: "url" },
  { key: "imageAlt", label: "Imagen alt", type: "text" },
];

const ctaFields: CmsBlockEditorField[] = [
  { key: "ctaLabel", label: "CTA label", type: "text" },
  { key: "ctaHref", label: "CTA href", type: "url" },
];

const plpTargetField: CmsBlockEditorField = {
  key: "target",
  label: "Target PLP",
  type: "plpTarget",
  helperText: "Necesario para asociar el bloque editorial a una categoria, busqueda o coleccion.",
};

const blockDefinitions: CmsBlockDefinition[] = [
  {
    type: "banner.hero",
    label: "Banner hero",
    description: "Bloque principal con imagen, titular y CTA.",
    schemaVersion: 1,
    placement: "main",
    surface: "page",
    supportedSurfaces: ["page"],
    editorFields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      ...textContentFields,
      ...ctaFields,
    ],
    create: () => ({
      blockId: makeBlockId("hero"),
      type: "banner.hero",
      props: {
        surface: "page",
        placement: "main",
        eyebrow: "Nueva temporada",
        heading: "Construye una pagina memorable",
        body: "Presenta una coleccion, campana o contenido editorial con una llamada clara.",
        imageUrl: "",
        imageAlt: "",
        ctaLabel: "Ver mas",
        ctaHref: "/",
      },
      children: [],
    }),
  },
  {
    type: "slider.fullWidth",
    label: "Slider full width",
    description: "Carrusel editorial de ancho completo para campanas.",
    schemaVersion: 1,
    placement: "main",
    surface: "page",
    supportedSurfaces: ["page"],
    editorFields: [
      { key: "autoplay", label: "Autoplay", type: "boolean" },
      { key: "slides", label: "Slides JSON", type: "json", required: true },
    ],
    create: () => ({
      blockId: makeBlockId("slider"),
      type: "slider.fullWidth",
      props: {
        surface: "page",
        placement: "main",
        autoplay: false,
        slides: [
          {
            title: "Slide principal",
            body: "Mensaje destacado para la tienda.",
            imageUrl: "",
            imageAlt: "",
            ctaLabel: "Comprar ahora",
            ctaHref: "/",
          },
        ],
      },
      children: [],
    }),
  },
  {
    type: "plp.categoryIntro",
    label: "Cabecera PLP",
    description: "Hero compacto de categoria con descripcion e imagen lateral.",
    schemaVersion: 1,
    placement: "beforeList",
    surface: "plp",
    supportedSurfaces: ["plp"],
    editorFields: [
      plpTargetField,
      ...textContentFields,
    ],
    create: () => ({
      blockId: makeBlockId("plp-intro"),
      type: "plp.categoryIntro",
      props: {
        surface: "plp",
        placement: "beforeList",
        target: createEmptyPlpTarget(),
        heading: "Clothes",
        body: "Discover our favorites fashionable discoveries, a selection of cool items to integrate in your wardrobe.",
        imageUrl: "",
        imageAlt: "",
      },
      children: [],
    }),
  },
  {
    type: "plp.subcategoryTiles",
    label: "Subcategorias PLP",
    description: "Tiles de subcategorias como entrada rapida al listing.",
    schemaVersion: 1,
    placement: "beforeList",
    surface: "plp",
    supportedSurfaces: ["plp"],
    editorFields: [
      plpTargetField,
      { key: "heading", label: "Titulo", type: "text", required: true },
      { key: "items", label: "Items JSON", type: "json", required: true },
    ],
    create: () => ({
      blockId: makeBlockId("plp-subcats"),
      type: "plp.subcategoryTiles",
      props: {
        surface: "plp",
        placement: "beforeList",
        target: createEmptyPlpTarget(),
        heading: "Subcategorias",
        items: [
          {
            title: "Men",
            imageUrl: "",
            href: "/4-men",
          },
          {
            title: "Women",
            imageUrl: "",
            href: "/5-women",
          },
        ],
      },
      children: [],
    }),
  },
  {
    type: "accordion",
    label: "Acordeon",
    description: "Preguntas, politicas o contenido plegable.",
    schemaVersion: 1,
    placement: "afterList",
    surface: "plp",
    supportedSurfaces: ["page", "plp"],
    editorFields: [
      plpTargetField,
      { key: "heading", label: "Titulo grupo", type: "text", required: true },
      { key: "items", label: "Items JSON", type: "json", required: true },
    ],
    create: () => ({
      blockId: makeBlockId("accordion"),
      type: "accordion",
      props: {
        surface: "plp",
        placement: "afterList",
        target: createEmptyPlpTarget(),
        heading: "Informacion importante",
        items: [
          {
            title: "Primera pregunta",
            content: "Respuesta editable para soporte, envios o categorias.",
          },
        ],
      },
      children: [],
    }),
  },
  {
    type: "carousel",
    label: "Carousel",
    description: "Tarjetas para colecciones, marcas o enlaces destacados.",
    schemaVersion: 1,
    placement: "beforeList",
    surface: "plp",
    supportedSurfaces: ["page", "plp"],
    editorFields: [
      plpTargetField,
      { key: "heading", label: "Titulo", type: "text", required: true },
      { key: "items", label: "Items JSON", type: "json", required: true },
    ],
    create: () => ({
      blockId: makeBlockId("carousel"),
      type: "carousel",
      props: {
        surface: "plp",
        placement: "beforeList",
        target: createEmptyPlpTarget(),
        heading: "Destacados",
        items: [
          {
            title: "Tarjeta destacada",
            body: "Describe el contenido o coleccion.",
            imageUrl: "",
            imageAlt: "",
            ctaLabel: "Explorar",
            ctaHref: "/",
          },
        ],
      },
      children: [],
    }),
  },
  {
    type: "visual.module",
    label: "Hero prototype images",
    description: "Hero banner CMS construido con arbol visual, panels, elements y estilos editables.",
    schemaVersion: 1,
    placement: "main",
    surface: "page",
    supportedSurfaces: ["page"],
    editorFields: [
      { key: "name", label: "Nombre interno", type: "text" },
      { key: "tree", label: "Visual tree JSON", type: "json", required: true },
    ],
    create: () => ({
      blockId: makeBlockId("visual-module"),
      type: "visual.module",
      props: {
        surface: "page",
        placement: "main",
        schemaVersion: 1,
        name: "Hero prototype images",
        contentSchema: {
          heading: { type: "text", required: true, label: "Titulo" },
          buttonText: { type: "text", required: true, label: "Texto boton" },
        },
        contentValues: {
          heading: "Design and prototype hero images for your website",
          buttonText: "Download Free",
        },
        tree: createDefaultVisualModuleTree(),
      },
      children: [],
    }),
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

const visualNodeTypes: CmsVisualNodeType[] = [
  "container",
  "section",
  "div",
  "grid",
  "flex",
  "heading",
  "paragraph",
  "richText",
  "image",
  "button",
  "link",
  "icon",
  "spacer",
  "video",
  "htmlEmbed",
];
const visualStyleKeys = [
  "alignItems",
  "backgroundColor",
  "backgroundImage",
  "backgroundPosition",
  "backgroundSize",
  "border",
  "borderColor",
  "borderRadius",
  "borderStyle",
  "borderWidth",
  "boxShadow",
  "color",
  "columnGap",
  "display",
  "aspectRatio",
  "flexDirection",
  "flexWrap",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "gap",
  "gridTemplateColumns",
  "height",
  "justifyContent",
  "letterSpacing",
  "lineHeight",
  "margin",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginTop",
  "maxHeight",
  "maxWidth",
  "minHeight",
  "minWidth",
  "objectFit",
  "opacity",
  "overflow",
  "padding",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "position",
  "rowGap",
  "textAlign",
  "transform",
  "width",
] as const;
const visualPropKeys = ["alt", "ariaLabel", "href", "html", "rel", "src", "text", "title"] as const;
const visualStyleKeyAliases = visualStyleKeys.reduce<Record<string, typeof visualStyleKeys[number]>>((aliases, key) => {
  aliases[key] = key;
  aliases[key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)] = key;
  return aliases;
}, {});

function visualStyleKey(value: string): typeof visualStyleKeys[number] | null {
  return visualStyleKeyAliases[value] ?? null;
}

function normalizeVisualNodeStyle(value: unknown): CmsVisualNodeStyle {
  const record = asRecord(value);
  const styles: CmsVisualNodeStyle = {};
  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = visualStyleKey(rawKey);
    const text = stringValue(rawValue);
    if (key && text) styles[key] = text;
  }
  return styles;
}

function normalizeVisualStylesByScope(value: unknown): CmsVisualStylesByScope {
  const record = asRecord(value);
  const styles: CmsVisualStylesByScope = {};
  const directBase = normalizeVisualNodeStyle(record);
  const scopedBase = normalizeVisualNodeStyle(record.base);
  const base = { ...directBase, ...scopedBase };
  if (Object.keys(base).length) styles.base = base;
  for (const scope of ["mobile", "tablet", "desktop"] as const) {
    const scoped = normalizeVisualNodeStyle(record[scope]);
    if (Object.keys(scoped).length) styles[scope] = scoped;
  }
  return styles;
}

function normalizeVisualResponsiveStyles(value: unknown): CmsVisualResponsiveStyles {
  const record = asRecord(value);
  const responsiveStyles: CmsVisualResponsiveStyles = {};
  for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
    const styles = normalizeVisualNodeStyle(record[breakpoint]);
    if (Object.keys(styles).length) {
      responsiveStyles[breakpoint] = styles;
    }
  }
  return responsiveStyles;
}

function normalizeVisualVisibility(value: unknown): CmsVisualResponsiveVisibility | undefined {
  const record = asRecord(value);
  const visibility: CmsVisualResponsiveVisibility = {};
  for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
    if (typeof record[breakpoint] === "boolean") visibility[breakpoint] = record[breakpoint];
  }
  return Object.keys(visibility).length ? visibility : undefined;
}

function normalizeVisualAnimation(value: unknown): CmsVisualAnimation | undefined {
  const record = asRecord(value);
  const preset = record.preset === "fadeIn" || record.preset === "slideUp" || record.preset === "scaleIn" || record.preset === "none"
    ? record.preset
    : undefined;
  if (!preset) return undefined;
  if (preset === "none") return { preset: "none" };
  const easing = record.easing === "emphasized" || record.easing === "linear" ? record.easing : "standard";
  const trigger = record.trigger === "inView" ? "inView" : "load";
  return {
    preset,
    durationMs: boundedInteger(record.durationMs, 0, 2000, 600),
    delayMs: boundedInteger(record.delayMs, 0, 2000, 0),
    easing,
    trigger,
  };
}

function normalizeVisualInteractions(value: unknown): CmsVisualInteractions | undefined {
  const record = asRecord(value);
  const hover = normalizeVisualHoverInteraction(record.hover);
  return hover ? { hover } : undefined;
}

function normalizeVisualHoverInteraction(value: unknown): CmsVisualHoverInteraction | undefined {
  const record = asRecord(value);
  const rawStyles = normalizeVisualNodeStyle(record.styles);
  const styles = cmsVisualHoverStyleKeys.reduce<NonNullable<CmsVisualHoverInteraction["styles"]>>((current, key) => {
    return rawStyles[key] ? { ...current, [key]: rawStyles[key] } : current;
  }, {});
  const transition = normalizeVisualInteractionTransition(record.transition);
  return Object.keys(styles).length || transition
    ? {
        ...(Object.keys(styles).length ? { styles } : {}),
        ...(transition ? { transition } : {}),
      }
    : undefined;
}

function normalizeVisualInteractionTransition(value: unknown): CmsVisualInteractionTransition | undefined {
  const record = asRecord(value);
  if (!Object.keys(record).length) return undefined;
  const easing = record.easing === "emphasized" || record.easing === "linear" ? record.easing : "standard";
  return {
    durationMs: boundedInteger(record.durationMs, 0, 2000, 160),
    delayMs: boundedInteger(record.delayMs, 0, 2000, 0),
    easing,
  };
}

function normalizeVisualNodeProps(value: unknown): CmsVisualNodeProps {
  const record = asRecord(value);
  const props = visualPropKeys.reduce<CmsVisualNodeProps>((current, key) => {
    const text = stringValue(record[key]);
    return text ? { ...current, [key]: text } : current;
  }, {});
  const target = record.target;
  if (target === "_blank" || target === "_self" || target === "_parent" || target === "_top") {
    props.target = target;
  }
  return props;
}

function boundedInteger(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

export function normalizeCmsVisualNode(value: unknown, fallbackType: CmsVisualNodeType = "div"): CmsVisualNode {
  const record = asRecord(value);
  const type = visualNodeTypes.includes(record.type as CmsVisualNodeType)
    ? record.type as CmsVisualNodeType
    : fallbackType;
  const children = Array.isArray(record.children)
    ? record.children.map((child) => normalizeCmsVisualNode(child))
    : [];
  const props = normalizeVisualNodeProps(record.props);
  const styles = normalizeVisualNodeStyle(record.styles);
  const responsiveStyles = normalizeVisualResponsiveStyles(record.responsiveStyles);
  const visibility = normalizeVisualVisibility(record.visibility);
  const animation = normalizeVisualAnimation(record.animation);
  const interactions = normalizeVisualInteractions(record.interactions);

  return {
    nodeId: stringValue(record.nodeId, makeVisualNodeId(type)),
    type,
    ...(stringValue(record.label) ? { label: stringValue(record.label) } : {}),
    ...(stringValue(record.contentBinding) ? { contentBinding: stringValue(record.contentBinding) } : {}),
    ...(visibility ? { visibility } : {}),
    ...(animation ? { animation } : {}),
    ...(interactions ? { interactions } : {}),
    ...(Object.keys(props).length ? { props } : {}),
    ...(Object.keys(styles).length ? { styles } : {}),
    ...(Object.keys(responsiveStyles).length ? { responsiveStyles } : {}),
    children,
  };
}

export function normalizeCmsVisualModuleProps(value: unknown): CmsVisualModuleProps {
  const record = asRecord(value);
  if (record.schemaVersion === 2) {
    return visualModuleV2ToEditableProps(record);
  }
  return {
    schemaVersion: 1,
    ...(stringValue(record.name) ? { name: stringValue(record.name) } : {}),
    assetRefs: normalizeVisualAssetRefs(record.assetRefs),
    contentSchema: normalizeVisualContentSchema(record.contentSchema),
    contentValues: asRecord(record.contentValues),
    tree: normalizeCmsVisualNode(record.tree ?? createDefaultVisualModuleTree(), "container"),
  };
}

function visualNodeStyleFromScope(styles: CmsVisualStylesByScope | undefined) {
  const { base, ...responsive } = styles ?? {};
  return {
    ...(base && Object.keys(base).length ? { styles: { ...base } } : {}),
    ...(Object.keys(responsive).length ? { responsiveStyles: responsive as CmsVisualResponsiveStyles } : {}),
  };
}

function visualElementToEditableNode(element: CmsVisualElement): CmsVisualNode {
  return {
    nodeId: element.elementId,
    type: element.elementType,
    ...(element.label ? { label: element.label } : {}),
    ...(element.contentBinding ? { contentBinding: element.contentBinding } : {}),
    ...(element.visibility ? { visibility: element.visibility } : {}),
    ...(element.animation ? { animation: element.animation } : {}),
    ...(element.interactions ? { interactions: element.interactions } : {}),
    ...(element.props ? { props: element.props as CmsVisualNodeProps } : {}),
    ...visualNodeStyleFromScope(element.styles),
    children: (element.children ?? element.elements ?? []).map(visualElementToEditableNode),
  };
}

function visualPanelToEditableNode(panel: CmsVisualPanel): CmsVisualNode {
  return {
    nodeId: panel.panelId,
    type: "section",
    ...(panel.label ? { label: panel.label } : {}),
    ...(panel.visibility ? { visibility: panel.visibility } : {}),
    ...(panel.animation ? { animation: panel.animation } : {}),
    ...(panel.interactions ? { interactions: panel.interactions } : {}),
    ...(panel.props ? { props: panel.props as CmsVisualNodeProps } : {}),
    ...visualNodeStyleFromScope(panel.styles),
    children: [
      ...(panel.elements ?? []).map(visualElementToEditableNode),
      ...(panel.panels ?? []).map(visualPanelToEditableNode),
    ],
  };
}

function visualModuleV2ToEditableProps(value: unknown): CmsVisualModuleProps {
  const moduleProps = normalizeCmsVisualModuleV2Props(value);
  return {
    schemaVersion: 1,
    ...(moduleProps.name ? { name: moduleProps.name } : {}),
    assetRefs: moduleProps.assetRefs,
    contentSchema: moduleProps.contentSchema,
    contentValues: moduleProps.contentValues,
    tree: {
      nodeId: moduleProps.moduleId,
      type: "container",
      ...(moduleProps.name ? { label: moduleProps.name } : {}),
      ...(moduleProps.visibility ? { visibility: moduleProps.visibility } : {}),
      ...(moduleProps.animation ? { animation: moduleProps.animation } : {}),
      ...(moduleProps.interactions ? { interactions: moduleProps.interactions } : {}),
      ...visualNodeStyleFromScope(moduleProps.styles),
      children: [
        ...moduleProps.panels.map(visualPanelToEditableNode),
        ...(moduleProps.elements ?? []).map(visualElementToEditableNode),
      ],
    },
  };
}

function visualNodeStylesByScope(node: CmsVisualNode): CmsVisualStylesByScope {
  const styles: CmsVisualStylesByScope = {};
  if (node.styles && Object.keys(node.styles).length) {
    styles.base = { ...node.styles };
  }
  for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
    const responsiveStyle = node.responsiveStyles?.[breakpoint];
    if (responsiveStyle && Object.keys(responsiveStyle).length) {
      styles[breakpoint] = { ...responsiveStyle };
    }
  }
  return styles;
}

function visualElementFromNode(node: CmsVisualNode): CmsVisualElement {
  const styles = visualNodeStylesByScope(node);
  const children = (node.children ?? []).map(visualElementFromNode);
  return {
    elementId: node.nodeId,
    elementType: node.type,
    ...(node.label ? { label: node.label } : {}),
    ...(node.contentBinding ? { contentBinding: node.contentBinding } : {}),
    ...(node.visibility ? { visibility: node.visibility } : {}),
    ...(node.animation ? { animation: node.animation } : {}),
    ...(node.interactions ? { interactions: node.interactions } : {}),
    ...(node.props ? { props: { ...node.props } } : {}),
    ...(Object.keys(styles).length ? { styles } : {}),
    ...(children.length ? { children } : {}),
  };
}

function visualPanelFromNode(node: CmsVisualNode): CmsVisualPanel {
  const styles = visualNodeStylesByScope(node);
  return {
    panelId: node.nodeId,
    ...(node.label ? { label: node.label } : {}),
    ...(node.visibility ? { visibility: node.visibility } : {}),
    ...(node.animation ? { animation: node.animation } : {}),
    ...(node.interactions ? { interactions: node.interactions } : {}),
    ...(node.props ? { props: { ...node.props } } : {}),
    ...(Object.keys(styles).length ? { styles } : {}),
    ...((node.children ?? []).length
      ? { elements: (node.children ?? []).map(visualElementFromNode) }
      : {}),
  };
}

function visualNodeIdSet(node: CmsVisualNode): Set<string> {
  return new Set([node.nodeId, ...(node.children ?? []).flatMap((child) => Array.from(visualNodeIdSet(child)))]);
}

function visualUniqueId(baseId: string, usedIds: Set<string>) {
  if (!usedIds.has(baseId)) return baseId;
  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;
  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }
  return nextId;
}

export function migrateCmsVisualModuleV1ToV2ForRenderer(value: unknown): CmsVisualModuleV2Props {
  const record = asRecord(value);
  if (record.schemaVersion === 2) {
    return normalizeCmsVisualModuleV2Props(record);
  }
  const moduleProps = normalizeCmsVisualModuleProps(value);
  const tree = moduleProps.tree;
  const moduleId = tree.nodeId || makeVisualNodeId("visual-module");
  const mainPanelId = visualUniqueId(`${moduleId}-panel-1`, visualNodeIdSet(tree));
  const rootChildren = tree.children ?? [];
  const panelNodeTypes = new Set<CmsVisualNodeType>(["container", "section", "div", "grid", "flex"]);
  const panelNodes = rootChildren.filter((node) => panelNodeTypes.has(node.type));
  const rootElements = rootChildren.filter((node) => !panelNodeTypes.has(node.type));
  const panels = panelNodes.length
    ? panelNodes.map(visualPanelFromNode)
    : [{
        panelId: mainPanelId,
        label: tree.label ?? "Panel principal",
        elements: rootElements.map(visualElementFromNode),
      }];
  return normalizeCmsVisualModuleV2Props({
    schemaVersion: 2,
    schemaMinorVersion: 0,
    moduleId,
    type: "visual.module",
    name: moduleProps.name ?? tree.label ?? "Modulo visual",
    visibility: tree.visibility,
    animation: tree.animation,
    interactions: tree.interactions,
    styles: visualNodeStylesByScope(tree),
    panels,
    elements: panelNodes.length ? rootElements.map(visualElementFromNode) : undefined,
    contentSchema: moduleProps.contentSchema,
    contentValues: moduleProps.contentValues,
    assetRefs: moduleProps.assetRefs,
  });
}

function normalizeVisualContentSchema(value: unknown): CmsVisualContentSchema {
  const record = asRecord(value);
  const contentSchema: CmsVisualContentSchema = {};
  for (const [key, rawField] of Object.entries(record)) {
    const field = asRecord(rawField);
    const type = field.type === "richText" || field.type === "url" || field.type === "media" || field.type === "boolean" || field.type === "number" || field.type === "color"
      ? field.type
      : "text";
    contentSchema[key] = {
      type,
      required: booleanValue(field.required, false),
      ...(stringValue(field.label) ? { label: stringValue(field.label) } : {}),
      ...(Object.prototype.hasOwnProperty.call(field, "defaultValue") ? { defaultValue: field.defaultValue } : {}),
    };
  }
  return contentSchema;
}

function normalizeVisualAssetRefs(value: unknown): CmsVisualAssetRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const assetRefs = value.map((asset): CmsVisualAssetRef | null => {
    const record = asRecord(asset);
    const assetKey = stringValue(record.assetKey);
    if (!assetKey) return null;
    const role = record.role === "background" || record.role === "image" || record.role === "video" || record.role === "icon"
      ? record.role
      : undefined;
    return {
      assetKey,
      ...(stringValue(record.mediaAssetId) ? { mediaAssetId: stringValue(record.mediaAssetId) } : {}),
      ...(role ? { role } : {}),
      ...(stringValue(record.src) ? { src: stringValue(record.src) } : {}),
      ...(stringValue(record.url) ? { url: stringValue(record.url) } : {}),
      ...(stringValue(record.alt) ? { alt: stringValue(record.alt) } : {}),
    } satisfies CmsVisualAssetRef;
  }).filter((asset): asset is CmsVisualAssetRef => Boolean(asset));
  return assetRefs.length ? assetRefs : undefined;
}

function normalizeCmsVisualElements(value: unknown): CmsVisualElement[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const elements = value.map((element) => {
    const record = asRecord(element);
    const elementId = stringValue(record.elementId, stringValue(record.nodeId, makeVisualNodeId("element")));
    const elementType = visualNodeTypes.includes(record.elementType as CmsVisualNodeType)
      ? record.elementType as CmsVisualNodeType
      : visualNodeTypes.includes(record.type as CmsVisualNodeType)
        ? record.type as CmsVisualNodeType
        : "div";
    const styles = normalizeVisualStylesByScope(record.styles);
    const children = normalizeCmsVisualElements(record.children ?? record.elements);
    const visibility = normalizeVisualVisibility(record.visibility);
    const animation = normalizeVisualAnimation(record.animation);
    const interactions = normalizeVisualInteractions(record.interactions);
    return {
      elementId,
      elementType,
      ...(stringValue(record.label) ? { label: stringValue(record.label) } : {}),
      ...(stringValue(record.contentBinding) ? { contentBinding: stringValue(record.contentBinding) } : {}),
      ...(visibility ? { visibility } : {}),
      ...(animation ? { animation } : {}),
      ...(interactions ? { interactions } : {}),
      props: asRecord(record.props),
      ...(Object.keys(styles).length ? { styles } : {}),
      ...(children?.length ? { children } : {}),
    } satisfies CmsVisualElement;
  });
  return elements.length ? elements : undefined;
}

function normalizeCmsVisualPanels(value: unknown): CmsVisualPanel[] {
  if (!Array.isArray(value)) return [];
  return value.map((panel, index) => {
    const record = asRecord(panel);
    const styles = normalizeVisualStylesByScope(record.styles);
    const elements = normalizeCmsVisualElements(record.elements);
    const panels = normalizeCmsVisualPanels(record.panels);
    const visibility = normalizeVisualVisibility(record.visibility);
    const animation = normalizeVisualAnimation(record.animation);
    const interactions = normalizeVisualInteractions(record.interactions);
    return {
      panelId: stringValue(record.panelId, `panel-${index + 1}`),
      ...(stringValue(record.label) ? { label: stringValue(record.label) } : {}),
      ...(visibility ? { visibility } : {}),
      ...(animation ? { animation } : {}),
      ...(interactions ? { interactions } : {}),
      props: asRecord(record.props),
      ...(Object.keys(styles).length ? { styles } : {}),
      ...(elements?.length ? { elements } : {}),
      ...(panels.length ? { panels } : {}),
    } satisfies CmsVisualPanel;
  });
}

export function normalizeCmsVisualModuleV2Props(value: unknown): CmsVisualModuleV2Props {
  const record = asRecord(value);
  const visibility = normalizeVisualVisibility(record.visibility);
  const animation = normalizeVisualAnimation(record.animation);
  const interactions = normalizeVisualInteractions(record.interactions);
  return {
    schemaVersion: 2,
    schemaMinorVersion: numberValue(record.schemaMinorVersion, 0),
    moduleId: stringValue(record.moduleId, stringValue(record.nodeId, makeVisualNodeId("visual-module"))),
    type: stringValue(record.type, "visual.module"),
    ...(stringValue(record.name) ? { name: stringValue(record.name) } : {}),
    ...(visibility ? { visibility } : {}),
    ...(animation ? { animation } : {}),
    ...(interactions ? { interactions } : {}),
    styles: normalizeVisualStylesByScope(record.styles),
    panels: normalizeCmsVisualPanels(record.panels),
    elements: normalizeCmsVisualElements(record.elements),
    contentSchema: normalizeVisualContentSchema(record.contentSchema),
    contentValues: asRecord(record.contentValues),
    assetRefs: normalizeVisualAssetRefs(record.assetRefs),
  };
}

export function normalizeCmsVisualModuleForRenderer(value: unknown): CmsVisualModuleRendererProps {
  const record = asRecord(value);
  return record.schemaVersion === 2
    ? normalizeCmsVisualModuleV2Props(record)
    : normalizeCmsVisualModuleProps(record);
}

function asPlacement(value: unknown): CmsPlacement {
  return value === "beforeList" || value === "afterList" ? value : "main";
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function asAlignment(value: unknown): CmsBlockModulePlacement["align"] {
  if (value === "start" || value === "center" || value === "end") return value;
  return "stretch";
}

function asPlacementContainerMode(value: unknown): CmsBlockModulePlacement["containerMode"] {
  if (value === "full-width" || value === "container") return value;
  return "inherit";
}

function normalizeSpacing(value: unknown): NonNullable<CmsBlockModulePlacement["spacing"]> {
  const record = asRecord(value);
  const spacing: NonNullable<CmsBlockModulePlacement["spacing"]> = {};
  for (const key of ["marginTop", "marginBottom", "paddingTop", "paddingBottom"] as const) {
    const text = stringValue(record[key]);
    if (text) spacing[key] = text;
  }
  return spacing;
}

function normalizeVisibility(value: unknown): NonNullable<CmsBlockModulePlacement["visibility"]> {
  const record = asRecord(value);
  return {
    mobile: booleanValue(record.mobile, true),
    tablet: booleanValue(record.tablet, true),
    desktop: booleanValue(record.desktop, true),
  };
}

export function normalizeCmsBlockModulePlacement(value: unknown): CmsBlockModulePlacement | undefined {
  const record = asRecord(value);
  const areaId = stringValue(record.areaId);
  if (!areaId) return undefined;

  return {
    region: record.region === "header" || record.region === "footer" ? record.region : "main",
    areaId,
    columnIndex: Math.max(1, Math.trunc(numberValue(record.columnIndex, 1))),
    order: Math.max(1, Math.trunc(numberValue(record.order, 1))),
    width: stringValue(record.width) || null,
    align: asAlignment(record.align),
    spacing: normalizeSpacing(record.spacing),
    visibility: normalizeVisibility(record.visibility),
    containerMode: asPlacementContainerMode(record.containerMode),
  };
}

function asSurface(value: unknown, placement: CmsPlacement): CmsSurface {
  if (value === "plp" || placement === "beforeList" || placement === "afterList") {
    return "plp";
  }
  return "page";
}

function asPlpListingKind(value: unknown): CmsPlpListingKind {
  if (value === "SEARCH" || value === "COLLECTION") {
    return value;
  }
  return "CATEGORY";
}

export function getCmsBlockPlacement(block: CmsBlock): CmsPlacement {
  return asPlacement(block.props.placement);
}

export function getCmsBlockSurface(block: CmsBlock): CmsSurface {
  return asSurface(block.props.surface, getCmsBlockPlacement(block));
}

export function getCmsBlockPlpTarget(block: CmsBlock): CmsPlpTarget {
  const target = asRecord(block.props.target);
  return {
    listingKind: asPlpListingKind(target.listingKind),
    routePath: stringValue(target.routePath),
    categorySlug: stringValue(target.categorySlug),
  };
}

export function normalizeCmsBlock(value: unknown): CmsBlock {
  const record = asRecord(value);
  const rawProps = asRecord(record.props);
  const modulePlacement = normalizeCmsBlockModulePlacement(record.placement ?? rawProps.placement);
  const placement = asPlacement(rawProps.placement);
  const surface = asSurface(rawProps.surface, placement);
  const type = stringValue(record.type, "banner.hero");
  const props = {
    ...rawProps,
    surface,
    placement,
    ...(type === "visual.module" ? normalizeCmsVisualModuleForRenderer(rawProps) : {}),
    ...(surface === "plp" ? { target: getCmsBlockPlpTarget({ blockId: "", type: "", props: rawProps }) } : {}),
  };

  return {
    blockId: stringValue(record.blockId, makeBlockId("block")),
    type,
    ...(modulePlacement ? { placement: modulePlacement } : {}),
    props,
    children: Array.isArray(record.children)
      ? record.children.map(normalizeCmsBlock)
      : [],
  };
}

export function getCmsBlockDefinitions() {
  return blockDefinitions;
}

export function getCmsBlockDefinition(type: string) {
  return blockDefinitions.find((definition) => definition.type === type);
}

export function getCmsBlockRegistry() {
  return Object.fromEntries(blockDefinitions.map((definition) => [definition.type, definition]));
}

export function getCmsBlockPresets(): CmsBlockPreset[] {
  return blockDefinitions.map(({ type, label, description, placement, surface, create }) => ({
    type,
    label,
    description,
    placement,
    surface,
    create,
  }));
}

export function createCmsBlockFromPreset(type: string): CmsBlock {
  return (
    blockDefinitions.find((definition) => definition.type === type)?.create() ??
    blockDefinitions[0].create()
  );
}

export function blocksToJson(blocks: CmsBlock[]) {
  return JSON.stringify(blocks, null, 2);
}

export function blocksFromJson(value: string | undefined): CmsBlock[] {
  if (!value?.trim()) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("blocks payload must be an array");
  }
  return parsed.map(normalizeCmsBlock);
}

export function summarizePlacements(blocks: CmsBlock[]) {
  return blocks.reduce(
    (summary, block) => {
      const placement = getCmsBlockPlacement(block);
      if (placement === "beforeList") summary.beforeList += 1;
      else if (placement === "afterList") summary.afterList += 1;
      else summary.main += 1;
      return summary;
    },
    { main: 0, beforeList: 0, afterList: 0 },
  );
}

export function summarizePlpComposition(blocks: CmsBlock[]) {
  return blocks.reduce(
    (summary, block) => {
      if (getCmsBlockSurface(block) !== "plp") {
        return summary;
      }
      const placement = getCmsBlockPlacement(block);
      const target = getCmsBlockPlpTarget(block);
      const key = target.routePath || target.categorySlug || "sin-target";
      summary.total += 1;
      if (placement === "beforeList") summary.beforeList += 1;
      if (placement === "afterList") summary.afterList += 1;
      if (!summary.targets.includes(key)) summary.targets.push(key);
      return summary;
    },
    { total: 0, beforeList: 0, afterList: 0, targets: [] as string[] },
  );
}
