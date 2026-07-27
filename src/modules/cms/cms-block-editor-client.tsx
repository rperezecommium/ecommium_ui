"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CopyPlus, Trash2 } from "lucide-react";
import {
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockPlacement,
  getCmsBlockPlpTarget,
  getCmsBlockPresets,
  getCmsBlockSurface,
  normalizeCmsBlockModulePlacement,
  summarizePlacements,
  type CmsBlock,
  type CmsBlockModulePlacement,
  type CmsPlacement,
  type CmsPlpListingKind,
  type CmsSurface,
} from "./cms-blocks";
import type { CmsModulePlacement, CmsModuleSlot } from "./cms-admin";

type CmsBlockEditorClientProps = {
  initialBlocks: CmsBlock[];
  mode?: "all" | "plp";
  moduleSlots?: CmsModuleSlot[];
};

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
  const preset = getCmsBlockPresets().find((item) => item.type === block.type);
  return preset?.label ?? block.type;
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
    placement,
    props: {
      ...block.props,
      surface: "page",
    },
  };
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

export function CmsBlockEditorClient({ initialBlocks, mode = "all", moduleSlots = [] }: CmsBlockEditorClientProps) {
  const [blocks, setBlocks] = useState<CmsBlock[]>(() => initialBlocks.map((block, index) =>
    withModulePlacementDefaults(block, moduleSlots, index + 1),
  ));
  const serialized = useMemo(() => blocksToJson(blocks), [blocks]);
  const summary = useMemo(() => summarizePlacements(blocks), [blocks]);
  const visibleBlocks = useMemo(() => blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => mode !== "plp" || getCmsBlockSurface(block) === "plp"), [blocks, mode]);
  const presets = useMemo(() => {
    const all = getCmsBlockPresets();
    return mode === "plp" ? all.filter((preset) => preset.surface === "plp") : all;
  }, [mode]);
  const placementIssues = useMemo(() => modulePlacementIssues(blocks, moduleSlots, mode), [blocks, moduleSlots, mode]);

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
          <article className="cmsBlockCard" key={block.blockId}>
            <header className="cmsBlockHeader">
              <div>
                <strong>{visibleIndex + 1}. {blockLabel(block)}</strong>
                <span>{block.blockId} - {getCmsBlockSurface(block)} - {placementLabel(block, moduleSlots, visibleIndex + 1)}</span>
              </div>
              <div className="adminButtonRow">
                <button className="adminIconButton" type="button" onClick={() => moveBlock(index, -1)} aria-label="Subir bloque">
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button className="adminIconButton" type="button" onClick={() => moveBlock(index, 1)} aria-label="Bajar bloque">
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button className="adminIconButton adminIconButtonDanger" type="button" onClick={() => removeBlock(index)} aria-label="Eliminar bloque">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </header>
            <BlockFields
              block={block}
              moduleSlots={moduleSlots}
              onPlacementChange={(placement) => updateBlock(index, (current) => ({ ...current, placement }))}
              onPropChange={(key, value) => updateProp(index, key, value)}
              onTargetChange={(key, value) => updateTargetProp(index, key, value)}
            />
          </article>
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
          {mode === "plp" ? <CmsPlpStorefrontPreview blocks={blocks} /> : blocks.map((block) => (
            <CmsBlockPreview block={block} key={block.blockId} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  moduleSlots,
  onPlacementChange,
  onPropChange,
  onTargetChange,
}: {
  block: CmsBlock;
  moduleSlots: CmsModuleSlot[];
  onPlacementChange: (placement: CmsModulePlacement) => void;
  onPropChange: (key: string, value: unknown) => void;
  onTargetChange: (key: keyof ReturnType<typeof getCmsBlockPlpTarget>, value: string) => void;
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
      <label className="adminField cmsJsonField">
        <span>Props JSON</span>
        <textarea value={JSON.stringify(block.props, null, 2)} readOnly />
      </label>
    </div>
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
      <label className="adminField">
        <span>Orden</span>
        <input
          min="1"
          type="number"
          value={placement?.order ?? 1}
          onChange={(event) => changePlacement({ order: Math.max(1, Number(event.target.value) || 1) })}
        />
      </label>
      <label className="adminField">
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
      <div className="cmsModulePlacementCompactGrid">
        <TextField label="MT" value={placement?.spacing?.marginTop ?? ""} onChange={(value) => changePlacement({ spacing: { ...(placement?.spacing ?? {}), marginTop: value } })} />
        <TextField label="MB" value={placement?.spacing?.marginBottom ?? ""} onChange={(value) => changePlacement({ spacing: { ...(placement?.spacing ?? {}), marginBottom: value } })} />
        <TextField label="PT" value={placement?.spacing?.paddingTop ?? ""} onChange={(value) => changePlacement({ spacing: { ...(placement?.spacing ?? {}), paddingTop: value } })} />
        <TextField label="PB" value={placement?.spacing?.paddingBottom ?? ""} onChange={(value) => changePlacement({ spacing: { ...(placement?.spacing ?? {}), paddingBottom: value } })} />
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

function CmsBlockPreview({ block }: { block: CmsBlock }) {
  const surface = getCmsBlockSurface(block);
  const placement = getCmsBlockPlacement(block);
  const target = getCmsBlockPlpTarget(block);
  const wrapperClass = surface === "plp" ? "cmsPreviewBlock cmsPreviewBlockPlp" : "cmsPreviewBlock";
  const wrapperLabel = surface === "plp"
    ? `${placement === "beforeList" ? "Antes PLP" : "Despues PLP"} · ${target.routePath || target.categorySlug || "sin target"}`
    : "Pagina CMS";

  if (block.type === "banner.hero") {
    return (
      <section className={`${wrapperClass} cmsPreviewHero`}>
        <small>{wrapperLabel}</small>
        <div>
          <span>{textProp(block, "eyebrow", "Hero")}</span>
          <h3>{textProp(block, "heading", "Titulo hero")}</h3>
          <p>{textProp(block, "body", "Texto de apoyo")}</p>
          <strong>{textProp(block, "ctaLabel", "CTA")}</strong>
        </div>
        <PreviewMedia label="Hero image" value={textProp(block, "imageUrl")} />
      </section>
    );
  }

  if (block.type === "slider.fullWidth") {
    const slides = arrayProp(block, "slides");
    return (
      <section className={`${wrapperClass} cmsPreviewSlider`}>
        <small>{wrapperLabel}</small>
        {slides.map((slide, index) => {
          const record = typeof slide === "object" && slide !== null ? slide as Record<string, unknown> : {};
          return (
            <div key={index}>
              <strong>{String(record.title ?? `Slide ${index + 1}`)}</strong>
              <p>{String(record.body ?? "")}</p>
            </div>
          );
        })}
      </section>
    );
  }

  if (block.type === "plp.categoryIntro") {
    return (
      <section className={`${wrapperClass} cmsPreviewCategoryIntro`}>
        <small>{wrapperLabel}</small>
        <div>
          <h3>{textProp(block, "heading", "Categoria")}</h3>
          <p>{textProp(block, "body", "Descripcion de categoria")}</p>
        </div>
        <PreviewMedia label="Category image" value={textProp(block, "imageUrl")} />
      </section>
    );
  }

  if (block.type === "plp.subcategoryTiles") {
    const items = arrayProp(block, "items");
    return (
      <section className={`${wrapperClass} cmsPreviewSubcategories`}>
        <small>{wrapperLabel}</small>
        <h3>{textProp(block, "heading", "Subcategorias")}</h3>
        <div>
          {items.map((item, index) => {
            const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
            return (
              <article key={index}>
                <PreviewMedia label="Subcategory image" value={String(record.imageUrl ?? "")} />
                <strong>{String(record.title ?? `Subcategoria ${index + 1}`)}</strong>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (block.type === "accordion") {
    const items = arrayProp(block, "items");
    return (
      <section className={`${wrapperClass} cmsPreviewAccordion`}>
        <small>{wrapperLabel}</small>
        <h3>{textProp(block, "heading", "Acordeon")}</h3>
        {items.map((item, index) => {
          const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
          return (
            <details key={index}>
              <summary>{String(record.title ?? `Item ${index + 1}`)}</summary>
              <p>{String(record.content ?? "")}</p>
            </details>
          );
        })}
      </section>
    );
  }

  const items = arrayProp(block, "items");
  return (
    <section className={`${wrapperClass} cmsPreviewCarousel`}>
      <small>{wrapperLabel}</small>
      <h3>{textProp(block, "heading", "Carousel")}</h3>
      <div>
        {items.map((item, index) => {
          const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
          return (
            <article key={index}>
              <PreviewMedia label="Card image" value={String(record.imageUrl ?? "")} />
              <strong>{String(record.title ?? `Card ${index + 1}`)}</strong>
              <p>{String(record.body ?? "")}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CmsPlpStorefrontPreview({ blocks }: { blocks: CmsBlock[] }) {
  const plpBlocks = blocks.filter((block) => getCmsBlockSurface(block) === "plp");
  const beforeList = plpBlocks.filter((block) => getCmsBlockPlacement(block) !== "afterList");
  const afterList = plpBlocks.filter((block) => getCmsBlockPlacement(block) === "afterList");

  return (
    <div className="cmsPlpPrestashopPreview">
      <nav className="cmsPlpBreadcrumb">Inicio / Clothes</nav>
      <div className="cmsPlpPrestashopLayout">
        <aside className="cmsPlpFacetSidebar">
          <section>
            <strong>Clothes</strong>
            <span>Men</span>
            <span>Women</span>
          </section>
          <section>
            <strong>Filtrar por</strong>
            {["Disponibilidad", "Selecciones", "Precio", "Categorias", "Tamaño", "Color"].map((facet) => (
              <label key={facet}>
                <input type="checkbox" readOnly />
                <span>{facet}</span>
              </label>
            ))}
          </section>
        </aside>
        <section className="cmsPlpListingPane">
          {beforeList.length > 0 ? beforeList.map((block) => (
            <CmsBlockPreview block={block} key={block.blockId} />
          )) : <DefaultCategoryIntro />}
          <div className="cmsPlpProductsTopbar">
            <span>Hay 2 productos.</span>
            <button type="button">Ordenar por: Relevancia</button>
          </div>
          <div className="cmsPlpProductGrid">
            <PreviewProductCard
              name="Hummingbird printed t-shirt"
              oldPrice="28,92 €"
              price="23,14 €"
            />
            <PreviewProductCard
              name="Hummingbird printed sweater"
              oldPrice="43,44 €"
              price="34,75 €"
            />
          </div>
          <div className="cmsPlpPagination">Mostrando 1-2 de 2 articulo(s)</div>
          {afterList.map((block) => (
            <CmsBlockPreview block={block} key={block.blockId} />
          ))}
        </section>
      </div>
    </div>
  );
}

function DefaultCategoryIntro() {
  return (
    <section className="cmsPreviewCategoryIntro">
      <div>
        <h3>Clothes</h3>
        <p>Discover our favorites fashionable discoveries, a selection of cool items to integrate in your wardrobe.</p>
      </div>
      <PreviewMedia label="Category image" value="" />
    </section>
  );
}

function PreviewProductCard({ name, oldPrice, price }: { name: string; oldPrice: string; price: string }) {
  return (
    <article className="cmsPlpProductCard">
      <div className="cmsPlpProductImage">Vista rapida</div>
      <strong>{name}</strong>
      <div>
        <s>{oldPrice}</s>
        <span>{price}</span>
      </div>
      <small>-20% · Nuevo</small>
    </article>
  );
}

function PreviewMedia({ label, value }: { label: string; value: string }) {
  if (value) {
    return (
      <div
        className="cmsPreviewMediaImage"
        role="img"
        aria-label={label}
        style={{ backgroundImage: `url(${value})` }}
      />
    );
  }
  return <div className="cmsPreviewMediaPlaceholder">{label}</div>;
}
