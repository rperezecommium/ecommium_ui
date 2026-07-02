"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CopyPlus, Trash2 } from "lucide-react";
import {
  blocksToJson,
  createCmsBlockFromPreset,
  getCmsBlockPresets,
  summarizePlacements,
  type CmsBlock,
  type CmsPlacement,
} from "./cms-blocks";

type CmsBlockEditorClientProps = {
  initialBlocks: CmsBlock[];
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
  const value = block.props.placement;
  if (value === "beforeList" || value === "afterList") {
    return value;
  }
  return "main";
}

function blockLabel(block: CmsBlock) {
  const preset = getCmsBlockPresets().find((item) => item.type === block.type);
  return preset?.label ?? block.type;
}

export function CmsBlockEditorClient({ initialBlocks }: CmsBlockEditorClientProps) {
  const [blocks, setBlocks] = useState<CmsBlock[]>(initialBlocks);
  const serialized = useMemo(() => blocksToJson(blocks), [blocks]);
  const summary = useMemo(() => summarizePlacements(blocks), [blocks]);

  function updateBlock(index: number, updater: (block: CmsBlock) => CmsBlock) {
    setBlocks((current) => current.map((block, currentIndex) =>
      currentIndex === index ? updater(block) : block,
    ));
  }

  function updateProp(index: number, key: string, value: unknown) {
    updateBlock(index, (block) => ({
      ...block,
      props: {
        ...block.props,
        [key]: value,
      },
    }));
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
    setBlocks((current) => [...current, createCmsBlockFromPreset(type)]);
  }

  return (
    <div className="cmsBuilder">
      <input type="hidden" name="blocksJson" value={serialized} />
      <div className="cmsBuilderLibrary" aria-label="Biblioteca de bloques">
        <div className="pricingPanelHeader">
          <div>
            <h2>Bloques</h2>
            <p>Prefabricados y listos para extender.</p>
          </div>
        </div>
        <div className="cmsPresetList">
          {getCmsBlockPresets().map((preset) => (
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
        {blocks.length === 0 ? (
          <div className="adminEmptyState">Agrega un bloque para empezar la composicion.</div>
        ) : blocks.map((block, index) => (
          <article className="cmsBlockCard" key={block.blockId}>
            <header className="cmsBlockHeader">
              <div>
                <strong>{index + 1}. {blockLabel(block)}</strong>
                <span>{block.blockId}</span>
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
              onPropChange={(key, value) => updateProp(index, key, value)}
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
          {blocks.map((block) => (
            <CmsBlockPreview block={block} key={block.blockId} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onPropChange,
}: {
  block: CmsBlock;
  onPropChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="cmsBlockFields">
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
  if (block.type === "banner.hero") {
    return (
      <section className="cmsPreviewHero">
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
      <section className="cmsPreviewSlider">
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

  if (block.type === "accordion") {
    const items = arrayProp(block, "items");
    return (
      <section className="cmsPreviewAccordion">
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
    <section className="cmsPreviewCarousel">
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
