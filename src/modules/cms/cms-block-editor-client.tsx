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
  summarizePlacements,
  type CmsBlock,
  type CmsPlacement,
  type CmsPlpListingKind,
  type CmsSurface,
} from "./cms-blocks";

type CmsBlockEditorClientProps = {
  initialBlocks: CmsBlock[];
  mode?: "all" | "plp";
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

export function CmsBlockEditorClient({ initialBlocks, mode = "all" }: CmsBlockEditorClientProps) {
  const [blocks, setBlocks] = useState<CmsBlock[]>(initialBlocks);
  const serialized = useMemo(() => blocksToJson(blocks), [blocks]);
  const summary = useMemo(() => summarizePlacements(blocks), [blocks]);
  const visibleBlocks = useMemo(() => blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => mode !== "plp" || getCmsBlockSurface(block) === "plp"), [blocks, mode]);
  const presets = useMemo(() => {
    const all = getCmsBlockPresets();
    return mode === "plp" ? all.filter((preset) => preset.surface === "plp") : all;
  }, [mode]);

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
    setBlocks((current) => [...current, mode === "plp" ? withPlpDefaults(nextBlock) : nextBlock]);
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
                <span>{block.blockId} · {getCmsBlockSurface(block)} · {plpTargetLabel(block)}</span>
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
  onPropChange,
  onTargetChange,
}: {
  block: CmsBlock;
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
