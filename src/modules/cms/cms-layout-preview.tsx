import type { CSSProperties, ReactNode } from "react";
import {
  getCmsBlockSurface,
  normalizeCmsBlockModulePlacement,
  type CmsBlock,
  type CmsBlockModulePlacement,
  type CmsVisualBreakpoint,
} from "./cms-blocks";
import type {
  CmsArea,
  CmsDesignTokens,
  CmsLayout,
  CmsModulePlacement,
  CmsModuleSlot,
  CmsRegionCode,
  CmsResolvedModule,
} from "./cms-admin";
import { CmsBlockRenderer } from "../../../packages/cms-blocks/src/react";

type CmsLayoutPreviewProps = {
  blocks: CmsBlock[];
  emptyLabel?: string;
  layout?: CmsLayout | null;
  moduleSlots?: CmsModuleSlot[];
  renderBlockActions?: (block: CmsBlock) => ReactNode;
  resolvedModules?: CmsResolvedModule[];
  tokens?: CmsDesignTokens | null;
  visualViewport?: CmsVisualBreakpoint;
};

type PreviewArea = CmsArea & {
  region: CmsRegionCode;
};

type PreviewPlacement = CmsBlockModulePlacement | CmsModulePlacement;

const previewRegionOrder: CmsRegionCode[] = ["header", "main", "footer"];

function tokenStyle(tokens: CmsDesignTokens | null | undefined): CSSProperties {
  return {
    "--cms-layout-preview-bg": tokens?.colors.background,
    "--cms-layout-preview-surface": tokens?.colors.surface,
    "--cms-layout-preview-text": tokens?.colors.text,
    "--cms-layout-preview-column-gap": tokens?.defaultColumnGap,
    "--cms-layout-preview-module-gap": tokens?.defaultModuleGap,
  } as CSSProperties;
}

function columnsForArea(area: CmsArea) {
  if (area.columnSlots.length > 0) return area.columnSlots;
  const columns = area.columns.length > 0 ? area.columns : ["100%"];
  return columns.map((width, index) => ({
    columnIndex: index + 1,
    percentage: Number.parseFloat(width) || 0,
    width,
  }));
}

function areaGridStyle(area: CmsArea): CSSProperties {
  const columns = area.columns.length > 0 ? area.columns : ["100%"];
  return {
    columnGap: area.columnGap ?? "var(--cms-layout-preview-column-gap, 24px)",
    gridTemplateColumns: columns.map((column) => `minmax(0, ${column})`).join(" "),
    rowGap: area.rowGap ?? "var(--cms-layout-preview-module-gap, 24px)",
  };
}

function moduleStyle(placement: PreviewPlacement): CSSProperties {
  const width = placement.width && placement.width.trim() ? placement.width : "100%";
  return {
    justifySelf: placement.align === "stretch" ? "stretch" : placement.align,
    marginBottom: placement.spacing?.marginBottom,
    marginTop: placement.spacing?.marginTop,
    paddingBottom: placement.spacing?.paddingBottom,
    paddingTop: placement.spacing?.paddingTop,
    width,
  };
}

function layoutAreas(layout: CmsLayout | null | undefined, moduleSlots: CmsModuleSlot[] = []): PreviewArea[] {
  const areas = previewRegionOrder.flatMap((region) =>
    (layout?.regions[region]?.areas ?? []).map((area) => ({ ...area, region })),
  );

  if (areas.length > 0) return areas;

  const fallback = new Map<string, PreviewArea>();
  for (const slot of moduleSlots) {
    const key = `${slot.region}|${slot.areaId}`;
    const current = fallback.get(key);
    const columnCount = Math.max(current?.columns.length ?? 0, slot.columnIndex);
    const columns = Array.from({ length: columnCount }, (_, index) => {
      if (index + 1 === slot.columnIndex) return slot.width;
      return current?.columns[index] ?? `${100 / columnCount}%`;
    });
    fallback.set(key, {
      areaId: slot.areaId,
      columnGap: "24px",
      columnSlots: columns.map((width, index) => ({
        columnIndex: index + 1,
        percentage: Number.parseFloat(width) || 0,
        width,
      })),
      columns,
      containerMode: "container",
      maxWidth: null,
      name: null,
      region: slot.region,
      rowGap: "24px",
      spacing: {},
      visibility: { mobile: true, tablet: true, desktop: true },
    });
  }
  return Array.from(fallback.values());
}

function resolvedPlacementMap(resolvedModules: CmsResolvedModule[] = []) {
  return new Map(resolvedModules.map((module) => [module.blockId, module.placement]));
}

function placementForBlock(
  block: CmsBlock,
  fallbackOrder: number,
  resolvedPlacements: Map<string, CmsModulePlacement>,
): PreviewPlacement | undefined {
  const placement = block.placement
    ?? normalizeCmsBlockModulePlacement(block.props.placement)
    ?? resolvedPlacements.get(block.blockId);
  if (!placement) return undefined;
  return {
    ...placement,
    align: placement.align ?? "stretch",
    containerMode: placement.containerMode ?? "inherit",
    order: placement.order ?? fallbackOrder,
    spacing: placement.spacing ?? {},
    visibility: placement.visibility ?? { mobile: true, tablet: true, desktop: true },
    width: placement.width ?? "100%",
  };
}

function blocksForColumn(
  blocks: CmsBlock[],
  region: CmsRegionCode,
  areaId: string,
  columnIndex: number,
  resolvedPlacements: Map<string, CmsModulePlacement>,
) {
  return blocks
    .map((block, index) => ({
      block,
      placement: placementForBlock(block, index + 1, resolvedPlacements),
    }))
    .filter((item): item is { block: CmsBlock; placement: PreviewPlacement } => (
      getCmsBlockSurface(item.block) !== "plp"
      && item.placement?.region === region
      && item.placement.areaId === areaId
      && item.placement.columnIndex === columnIndex
    ))
    .sort((left, right) => left.placement.order - right.placement.order);
}

function slotKeysForAreas(areas: PreviewArea[]) {
  return new Set(areas.flatMap((area) =>
    columnsForArea(area).map((column) => `${area.region}|${area.areaId}|${column.columnIndex}`),
  ));
}

function unplacedBlocks(
  blocks: CmsBlock[],
  resolvedPlacements: Map<string, CmsModulePlacement>,
  validSlotKeys: Set<string>,
) {
  return blocks.filter((block, index) => (
    getCmsBlockSurface(block) !== "plp"
    && (() => {
      const placement = placementForBlock(block, index + 1, resolvedPlacements);
      if (!placement) return true;
      return !validSlotKeys.has(`${placement.region}|${placement.areaId}|${placement.columnIndex}`);
    })()
  ));
}

export function CmsLayoutPreview({
  blocks,
  emptyLabel = "Sin bloques para previsualizar.",
  layout,
  moduleSlots,
  renderBlockActions,
  resolvedModules,
  tokens,
  visualViewport,
}: CmsLayoutPreviewProps) {
  const areas = layoutAreas(layout, moduleSlots);
  const placements = resolvedPlacementMap(resolvedModules);
  const validSlotKeys = slotKeysForAreas(areas);
  const orphanBlocks = unplacedBlocks(blocks, placements, validSlotKeys);

  if (areas.length === 0) {
    return (
      <div className="cmsLayoutPreview cmsLayoutPreviewFallback" style={tokenStyle(tokens)}>
        {blocks.length > 0 ? blocks.map((block) => (
          <CmsLayoutPreviewModule block={block} key={block.blockId} renderBlockActions={renderBlockActions} visualViewport={visualViewport} />
        )) : <div className="cmsLayoutPreviewEmpty">{emptyLabel}</div>}
      </div>
    );
  }

  return (
    <div className="cmsLayoutPreview" style={tokenStyle(tokens)}>
      {previewRegionOrder.map((region) => {
        const regionAreas = areas.filter((area) => area.region === region);
        if (regionAreas.length === 0) return null;
        return (
          <section className="cmsLayoutPreviewRegion" data-cms-region={region} key={region}>
            <header className="cmsLayoutPreviewRegionHeader">
              <span>{region}</span>
              <strong>{regionAreas.length} area(s)</strong>
            </header>
            {regionAreas.map((area) => (
              <section
                className={visualViewport && area.visibility[visualViewport] === false ? "cmsLayoutPreviewArea cmsLayoutPreviewAreaHidden" : "cmsLayoutPreviewArea"}
                data-cms-area={area.areaId}
                data-cms-viewport-hidden={visualViewport && area.visibility[visualViewport] === false || undefined}
                key={`${region}-${area.areaId}`}
              >
                <header className="cmsLayoutPreviewAreaHeader">
                  <div>
                    <strong>{area.name ?? area.areaId}</strong>
                    <span>{area.containerMode} - {area.columns.join(" / ") || "100%"}</span>
                  </div>
                </header>
                <div className="cmsLayoutPreviewColumns" style={areaGridStyle(area)}>
                  {columnsForArea(area).map((column) => {
                    const columnBlocks = blocksForColumn(blocks, region, area.areaId, column.columnIndex, placements);
                    return (
                      <section className="cmsLayoutPreviewColumn" data-cms-column={column.columnIndex} key={`${area.areaId}-${column.columnIndex}`}>
                        <header className="cmsLayoutPreviewColumnHeader">
                          <span>Col {column.columnIndex}</span>
                          <strong>{column.width}</strong>
                        </header>
                        {columnBlocks.length > 0 ? columnBlocks.map(({ block, placement }) => (
                          <CmsLayoutPreviewModule
                            block={block}
                            key={block.blockId}
                            placement={placement}
                            renderBlockActions={renderBlockActions}
                            visualViewport={visualViewport}
                          />
                        )) : <div className="cmsLayoutPreviewEmpty">Slot vacio</div>}
                      </section>
                    );
                  })}
                </div>
              </section>
            ))}
          </section>
        );
      })}
      {orphanBlocks.length > 0 ? (
        <section className="cmsLayoutPreviewUnplaced">
          <h3>Modulos sin area resuelta</h3>
          {orphanBlocks.map((block) => (
            <CmsLayoutPreviewModule block={block} key={block.blockId} renderBlockActions={renderBlockActions} visualViewport={visualViewport} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function CmsLayoutPreviewModule({
  block,
  placement,
  renderBlockActions,
  visualViewport,
}: {
  block: CmsBlock;
  placement?: PreviewPlacement;
  renderBlockActions?: (block: CmsBlock) => ReactNode;
  visualViewport?: CmsVisualBreakpoint;
}) {
  const visibility = placement?.visibility ?? { mobile: true, tablet: true, desktop: true };
  const hiddenEverywhere = !visibility.mobile && !visibility.tablet && !visibility.desktop;
  const hiddenAtViewport = visualViewport ? visibility[visualViewport] === false : false;
  return (
    <article
      className={hiddenEverywhere || hiddenAtViewport ? "cmsLayoutPreviewModule cmsLayoutPreviewModuleHidden" : "cmsLayoutPreviewModule"}
      data-cms-block={block.blockId}
      data-cms-viewport-hidden={hiddenAtViewport || undefined}
      style={placement ? moduleStyle(placement) : undefined}
    >
      {renderBlockActions ? <div className="cmsLayoutPreviewModuleActions">{renderBlockActions(block)}</div> : null}
      <CmsBlockRenderer block={block} mode="admin-preview" visualViewport={visualViewport} />
    </article>
  );
}
