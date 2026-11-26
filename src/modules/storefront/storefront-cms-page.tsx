import Image from "next/image";
import {cmsDesignFromTokens} from '../../../packages/cms-blocks/src/design-settings';
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { normalizeCmsBlockModulePlacement, type CmsBlock, type CmsBlockModulePlacement } from "../../../packages/cms-blocks/src";
import { CmsBlockRenderer, CmsPageCompositionView, CmsIndependentModuleView } from "../../../packages/cms-blocks/src/react";
import {parseCmsPublicModule} from './cms-public-module';
import type {
  StorefrontCmsBlock,
  StorefrontCmsPublishedPage,
  StorefrontCmsResolvedArea,
} from "./public-page-contract";
import { StorefrontPageShell } from "./storefront-header";
import { StorefrontCmsSlider } from "./storefront-cms-slider";
import { NewsletterProvider } from "./newsletter-client";

type StorefrontCmsRegionCode = CmsBlockModulePlacement["region"];
type StorefrontCmsBlockPlacement = {
  block: StorefrontCmsBlock;
  placement: CmsBlockModulePlacement;
};
type StorefrontCmsAreaLayout = StorefrontCmsResolvedArea & {
  region: StorefrontCmsRegionCode;
};
const storefrontCmsRegionOrder: StorefrontCmsRegionCode[] = ["header", "main", "footer"];

export function StorefrontCmsPage({
  page,
  openCustomerLogin = false,
}: {
  page: StorefrontCmsPublishedPage;
  openCustomerLogin?: boolean;
}) {
  const blocks = page.blocks.filter(isFullPageBlock);
  const layout = storefrontCmsLayoutForPage(page, blocks);
  const isHome = page.pageType === "HOME";

  return (
    <main className="storefrontPage">
      <StorefrontPageShell openCustomerLogin={openCustomerLogin} pageId={page.pageId} surface={isHome ? "HOME" : "CMS"}>
      <div className={`storefrontShell storefrontCmsPage${isHome ? " storefrontCmsPageHome" : ""}`}>
        {isHome ? <h1 className="storefrontVisuallyHidden">{page.title}</h1> : (
          <>
            <nav className="storefrontBreadcrumb">
              <Link href="/">Inicio</Link>
              <span>/</span>
              <span>{page.title}</span>
            </nav>
            <header className="storefrontCmsPageHeader">
              <span>{pageTypeLabel(page.pageType)}</span>
              <h1>{page.title}</h1>
            </header>
          </>
        )}
        <NewsletterProvider enabled={JSON.stringify(page.composition??blocks).includes("newsletterForm")}>{page.composition ? <CmsPageCompositionView document={page.composition} identity={page.pageId} renderRegistered={block=><StorefrontCmsBlockRenderer block={block}/>} inheritedDesign={cmsDesignFromTokens(page.layout?.tokens??page.resolvedPageSettings?.tokens)}/> : <StorefrontCmsPageBlocks blocks={blocks} layout={layout} page={page} />}</NewsletterProvider>
      </div>
      </StorefrontPageShell>
    </main>
  );
}

function StorefrontCmsPageBlocks({
  blocks,
  layout,
  page,
}: {
  blocks: StorefrontCmsBlock[];
  layout: StorefrontCmsAreaLayout[];
  page: StorefrontCmsPublishedPage;
}) {
  const layoutTokens = page.layout?.tokens ?? page.resolvedPageSettings?.tokens;

  if (layout.length === 0) {
    return (
      <div className="storefrontCmsPageBlocks">
        {blocks.map((block) => (
          <StorefrontCmsBlockRenderer block={block} key={block.blockId} />
        ))}
      </div>
    );
  }

  const unplacedBlocks = blocks.filter((block) => !placementForStorefrontBlock(block));
  return (
    <div className="storefrontCmsPageBlocks storefrontCmsPageLayout">
      {storefrontCmsRegionOrder.map((region) => {
        const areas = layout.filter((area) => area.region === region);
        if (areas.length === 0) return null;
        return (
          <section className="storefrontCmsPageRegion" data-cms-region={region} key={region}>
            {areas.map((area) => (
              <StorefrontCmsArea
                area={area}
                blocks={blocks}
                defaultColumnGap={layoutTokens?.defaultColumnGap}
                defaultModuleGap={layoutTokens?.defaultModuleGap}
                key={`${area.region}-${area.areaId}`}
              />
            ))}
          </section>
        );
      })}
      {unplacedBlocks.length > 0 ? (
        <section className="storefrontCmsPageUnplaced">
          {unplacedBlocks.map((block) => (
            <StorefrontCmsBlockRenderer block={block} key={block.blockId} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function StorefrontCmsArea({
  area,
  blocks,
  defaultColumnGap,
  defaultModuleGap,
}: {
  area: StorefrontCmsAreaLayout;
  blocks: StorefrontCmsBlock[];
  defaultColumnGap?: string;
  defaultModuleGap?: string;
}) {
  const columns = storefrontCmsColumnsForArea(area);
  const areaStyle = storefrontCmsAreaStyle(area, defaultColumnGap, defaultModuleGap);

  return (
    <section
      className="storefrontCmsPageArea"
      data-cms-area={area.areaId}
      data-container-mode={area.containerMode ?? "container"}
      style={area.containerMode === "container" && area.maxWidth ? { maxWidth: area.maxWidth } : undefined}
    >
      <div className="storefrontCmsPageColumns" style={areaStyle}>
        {columns.map((column) => {
          const modules = storefrontCmsBlocksForColumn(blocks, area.region, area.areaId, column.columnIndex);
          return (
            <section className="storefrontCmsPageColumn" data-cms-column={column.columnIndex} key={`${area.areaId}-${column.columnIndex}`}>
              {modules.map(({ block, placement }) => (
                <div
                  className="storefrontCmsPageModule"
                  data-container-mode={placement.containerMode ?? "inherit"}
                  key={block.blockId}
                  style={storefrontCmsModuleStyle(placement)}
                >
                  <StorefrontCmsBlockRenderer block={block} />
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function StorefrontCmsBlockRenderer({
  block,
  depth = 0,
}: {
  block: StorefrontCmsBlock;
  depth?: number;
}) {
  if(block.type==='cms.module')return <CmsIndependentModuleView document={parseCmsPublicModule(block.props.document)} renderRegistered={registered=><StorefrontCmsBlockRenderer block={registered.type==='plp.categoryIntro'?{...registered,props:{...registered.props,headingLevel:1}}:registered}/>}/>;
  if (block.type === "slider.fullWidth") {
    return <StorefrontCmsSlider block={block} />;
  }
  return (
    <CmsBlockRenderer
      block={block as CmsBlock}
      depth={depth}
      mode="storefront"
      renderImage={({ alt, className, sizes, src }) => (
        <CmsImage alt={alt} className={className} sizes={sizes} src={src} />
      )}
      renderLink={({ children, className, href, label, rel, style, target, title }) => (
        <CmsActionLink
          className={className}
          href={href}
          label={label}
          rel={rel}
          style={style}
          target={target}
          title={title}
        >
          {children}
        </CmsActionLink>
      )}
    />
  );
}

export function storefrontCmsPublicBlockType(block:StorefrontCmsBlock):string {
 if(block.type!=='cms.module')return block.type;
 const doc=parseCmsPublicModule(block.props.document);
 return doc.body.kind==='registered'?doc.body.type:'visual.module';
}

function CmsImage({ alt, className, sizes, src }: { alt: string; className: string; sizes: string; src: string }) {
  return (
    <div className={className}>
      <Image alt={alt} fill sizes={sizes} src={src} unoptimized />
    </div>
  );
}

function CmsActionLink({
  children,
  className,
  href,
  label,
  rel,
  style,
  target,
  title,
}: {
  children?: ReactNode;
  className: string;
  href: string;
  label: string;
  rel?: string;
  style?: CSSProperties;
  target?: "_blank" | "_self" | "_parent" | "_top";
  title?: string;
}) {
  if (href.startsWith("/")) {
    return (
      <Link className={className} href={href} rel={rel} style={style} target={target} title={title}>
        {children ?? label}
      </Link>
    );
  }
  return (
    <a className={className} href={href} rel={rel ?? "noreferrer"} style={style} target={target} title={title}>
      {children ?? label}
    </a>
  );
}

function isFullPageBlock(block: StorefrontCmsBlock) {
  return block.props.surface !== "plp" && block.props.placement !== "beforeList" && block.props.placement !== "afterList";
}

function placementForStorefrontBlock(block: StorefrontCmsBlock): CmsBlockModulePlacement | undefined {
  return normalizeCmsBlockModulePlacement((block as CmsBlock).placement ?? block.props.placement);
}

function storefrontCmsBlocksForColumn(
  blocks: StorefrontCmsBlock[],
  region: StorefrontCmsRegionCode,
  areaId: string,
  columnIndex: number,
): StorefrontCmsBlockPlacement[] {
  return blocks
    .map((block, index) => {
      const placement = placementForStorefrontBlock(block);
      return placement ? { block, placement: { ...placement, order: placement.order ?? index + 1 } } : null;
    })
    .filter((item): item is StorefrontCmsBlockPlacement => {
      if (!item) return false;
      return (
        item.placement.region === region
        && item.placement.areaId === areaId
        && item.placement.columnIndex === columnIndex
      );
    })
    .sort((left, right) => left.placement.order - right.placement.order);
}

function storefrontCmsLayoutForPage(
  page: StorefrontCmsPublishedPage,
  blocks: StorefrontCmsBlock[],
): StorefrontCmsAreaLayout[] {
  const resolvedRegions = page.layout?.regions ?? page.resolvedPageSettings?.layout?.regions;
  const resolvedAreas = storefrontCmsRegionOrder.flatMap((region) =>
    (resolvedRegions?.[region]?.areas ?? []).map((area) => ({ ...area, region })),
  );
  if (resolvedAreas.length > 0) return resolvedAreas;
  return fallbackStorefrontCmsLayout(blocks);
}

function fallbackStorefrontCmsLayout(blocks: StorefrontCmsBlock[]): StorefrontCmsAreaLayout[] {
  const areaColumns = new Map<string, { areaId: string; maxColumn: number; region: StorefrontCmsRegionCode }>();
  blocks.forEach((block) => {
    const placement = placementForStorefrontBlock(block);
    if (!placement) return;
    const key = `${placement.region}:${placement.areaId}`;
    const current = areaColumns.get(key);
    areaColumns.set(key, {
      areaId: placement.areaId,
      maxColumn: Math.max(current?.maxColumn ?? 1, placement.columnIndex),
      region: placement.region,
    });
  });
  return Array.from(areaColumns.values()).map((area) => {
    const width = `${100 / area.maxColumn}%`;
    const columns = Array.from({ length: area.maxColumn }, () => width);
    return {
      areaId: area.areaId,
      columnGap: null,
      columns,
      containerMode: "container",
      maxWidth: null,
      name: null,
      region: area.region,
      rowGap: null,
    };
  });
}

function storefrontCmsColumnsForArea(area: StorefrontCmsAreaLayout) {
  if (area.columnSlots?.length) return area.columnSlots;
  const columns = area.columns.length > 0 ? area.columns : ["100%"];
  return columns.map((width, index) => ({
    columnIndex: index + 1,
    percentage: Number.parseFloat(width) || 0,
    width,
  }));
}

function storefrontCmsAreaStyle(
  area: StorefrontCmsAreaLayout,
  defaultColumnGap?: string,
  defaultModuleGap?: string,
): CSSProperties {
  const columns = area.columns.length > 0 ? area.columns : ["100%"];
  return {
    columnGap: area.columnGap ?? defaultColumnGap ?? undefined,
    gridTemplateColumns: columns.map((column) => `minmax(0, ${column})`).join(" "),
    rowGap: area.rowGap ?? defaultModuleGap ?? undefined,
  };
}

function storefrontCmsModuleStyle(placement: CmsBlockModulePlacement): CSSProperties {
  return {
    justifySelf: placement.align && placement.align !== "stretch" ? placement.align : "stretch",
    marginBottom: placement.spacing?.marginBottom,
    marginTop: placement.spacing?.marginTop,
    paddingBottom: placement.spacing?.paddingBottom,
    paddingTop: placement.spacing?.paddingTop,
    width: placement.width ?? undefined,
  };
}

function pageTypeLabel(value: string) {
  if (value === "HOME") return "Inicio";
  if (value === "CONTENT") return "Información";
  return "Página especial";
}
