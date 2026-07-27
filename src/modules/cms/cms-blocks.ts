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
export type CmsBlockType =
  | "banner.hero"
  | "slider.fullWidth"
  | "plp.categoryIntro"
  | "plp.subcategoryTiles"
  | "accordion"
  | "carousel";

export type CmsBlock = {
  blockId: string;
  type: CmsBlockType | string;
  placement?: CmsBlockModulePlacement;
  props: Record<string, unknown>;
  children?: CmsBlock[];
};

export type CmsBlockPreset = {
  type: CmsBlockType;
  label: string;
  description: string;
  placement: CmsPlacement;
  surface: CmsSurface;
  create: () => CmsBlock;
};

export type CmsPlpTarget = {
  listingKind: CmsPlpListingKind;
  routePath: string;
  categorySlug: string;
};

function makeBlockId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const blockPresets: CmsBlockPreset[] = [
  {
    type: "banner.hero",
    label: "Banner hero",
    description: "Bloque principal con imagen, titular y CTA.",
    placement: "main",
    surface: "page",
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
    placement: "main",
    surface: "page",
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
    placement: "beforeList",
    surface: "plp",
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
    placement: "beforeList",
    surface: "plp",
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
    placement: "afterList",
    surface: "plp",
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
    placement: "beforeList",
    surface: "plp",
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
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function createEmptyPlpTarget(): CmsPlpTarget {
  return {
    listingKind: "CATEGORY",
    routePath: "",
    categorySlug: "",
  };
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
  const props = {
    ...rawProps,
    surface,
    placement,
    ...(surface === "plp" ? { target: getCmsBlockPlpTarget({ blockId: "", type: "", props: rawProps }) } : {}),
  };

  return {
    blockId: stringValue(record.blockId, makeBlockId("block")),
    type: stringValue(record.type, "banner.hero"),
    ...(modulePlacement ? { placement: modulePlacement } : {}),
    props,
    children: Array.isArray(record.children)
      ? record.children.map(normalizeCmsBlock)
      : [],
  };
}

export function getCmsBlockPresets() {
  return blockPresets;
}

export function createCmsBlockFromPreset(type: string): CmsBlock {
  return (
    blockPresets.find((preset) => preset.type === type)?.create() ??
    blockPresets[0].create()
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
