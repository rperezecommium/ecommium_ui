export type CmsPlacement = "main" | "beforeList" | "afterList";
export type CmsBlockType =
  | "banner.hero"
  | "slider.fullWidth"
  | "accordion"
  | "carousel";

export type CmsBlock = {
  blockId: string;
  type: CmsBlockType | string;
  props: Record<string, unknown>;
  children?: CmsBlock[];
};

export type CmsBlockPreset = {
  type: CmsBlockType;
  label: string;
  description: string;
  placement: CmsPlacement;
  create: () => CmsBlock;
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
    create: () => ({
      blockId: makeBlockId("hero"),
      type: "banner.hero",
      props: {
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
    create: () => ({
      blockId: makeBlockId("slider"),
      type: "slider.fullWidth",
      props: {
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
    type: "accordion",
    label: "Acordeon",
    description: "Preguntas, politicas o contenido plegable.",
    placement: "afterList",
    create: () => ({
      blockId: makeBlockId("accordion"),
      type: "accordion",
      props: {
        placement: "afterList",
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
    create: () => ({
      blockId: makeBlockId("carousel"),
      type: "carousel",
      props: {
        placement: "beforeList",
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

export function normalizeCmsBlock(value: unknown): CmsBlock {
  const record = asRecord(value);
  return {
    blockId: stringValue(record.blockId, makeBlockId("block")),
    type: stringValue(record.type, "banner.hero"),
    props: asRecord(record.props),
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
      const placement = stringValue(block.props.placement, "main");
      if (placement === "beforeList") summary.beforeList += 1;
      else if (placement === "afterList") summary.afterList += 1;
      else summary.main += 1;
      return summary;
    },
    { main: 0, beforeList: 0, afterList: 0 },
  );
}
