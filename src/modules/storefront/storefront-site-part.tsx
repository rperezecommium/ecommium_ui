import {cmsDesignFromTokens,resolveCmsDesignSettings,type CmsResolvedDesign} from '../../../packages/cms-blocks/src/design-settings';
import { NewsletterProvider } from "./newsletter-client";
import { CmsSystemBlockView } from "../cms/cms-system-block-view";
import { cmsStyleSheetId } from "../../../packages/cms-blocks/src";
import { cmsBlockStyleSheetCss, CmsBlockRenderer, CmsPresentationView, CmsSectionView } from "../../../packages/cms-blocks/src/react";
import type { CmsBlock, CmsPresentation, CmsVisualBreakpoint } from "../../../packages/cms-blocks/src";
import type { CSSProperties, ReactNode } from "react";
import { StorefrontAuthEntry } from "./storefront-auth-drawer";
import { StorefrontCartStatus } from "./cart-client";
import type { StorefrontCategoryLink } from "./plp";
import type { StorefrontSitePart } from "./storefront-cms-shell";
import type { CmsSectionViewDocument } from "../../../packages/cms-blocks/src/react";
import type { StorefrontCmsBlock, StorefrontCmsResolvedArea } from "./public-page-contract";

export function StorefrontSitePartView({ preview = false, visualViewport, renderBlockActions, categories = [], part, country, currency, customerEmail, initialQuery, locale, marketLabel, openCustomerLogin = false }: { preview?: boolean; visualViewport?: CmsVisualBreakpoint; renderBlockActions?: (block: StorefrontCmsBlock) => ReactNode; categories?: StorefrontCategoryLink[]; part: StorefrontSitePart; country?: string; currency?: string; customerEmail?: string; initialQuery?: string; locale?: string; marketLabel?: string; openCustomerLogin?: boolean }) {
  const inheritedDesign=resolveCmsDesignSettings(part.designDefaults??cmsDesignFromTokens(part.designTokens),part.revision.layout.designSettings);
  const sheet = part.revision.layout.styleSheet;
  const sheetId = sheet ? cmsStyleSheetId(`${part.sitePartId}:${visualViewport ?? "public"}`, sheet) : undefined;
  const region = part.kind === "HEADER" ? "header" : "footer";
  const areas = part.revision.layout?.regions?.[region]?.areas ?? [];
  const content = <div id={sheetId} className={`storefrontSitePart storefrontSitePart${part.kind}`} data-cms-site-part={part.sitePartId} data-cms-revision={part.revision.revisionId}>
    {sheet && sheetId ? <style>{cmsBlockStyleSheetCss(sheet, sheetId, visualViewport)}</style> : null}
    {areas.map((area) => <SitePartArea inheritedDesign={inheritedDesign} preview={preview} visualViewport={visualViewport} renderBlockActions={renderBlockActions} area={area} blocks={part.revision.blocks} categories={categories} country={country} currency={currency} customerEmail={customerEmail} initialQuery={initialQuery} key={area.areaId} locale={locale} marketLabel={marketLabel} openCustomerLogin={openCustomerLogin} region={region} />)}
  </div>;
  const newsletter = part.revision.blocks.some(block => (block.type === "visual.module" || block.type === "cms.section") && hasNewsletterNode(block.props));
  return preview || !newsletter ? content : <NewsletterProvider>{content}</NewsletterProvider>;
}

function SitePartArea({ inheritedDesign, preview, visualViewport, renderBlockActions, area, blocks, categories, country, currency, customerEmail, initialQuery, locale, marketLabel, openCustomerLogin, region }: { inheritedDesign:CmsResolvedDesign; preview: boolean; visualViewport?: CmsVisualBreakpoint; renderBlockActions?: (block: StorefrontCmsBlock) => ReactNode; area: StorefrontCmsResolvedArea; blocks: StorefrontCmsBlock[]; categories: StorefrontCategoryLink[]; country?: string; currency?: string; customerEmail?: string; initialQuery?: string; locale?: string; marketLabel?: string; openCustomerLogin: boolean; region: "header" | "footer" }) {
  const columns = area.columnSlots?.length ? area.columnSlots : area.columns.map((width, index) => ({ columnIndex: index + 1, width, percentage: Number.parseFloat(width) || 100 }));
  const style = { columnGap: area.columnGap ?? "16px", gridTemplateColumns: columns.map((column) => `minmax(0, ${column.width.trim().endsWith("%") ? `${Number.parseFloat(column.width)}fr` : column.width})`).join(" "), rowGap: area.rowGap ?? "16px" } as CSSProperties;
  const areaStyle = {
    marginTop: area.spacing?.marginTop,
    marginBottom: area.spacing?.marginBottom,
    paddingTop: area.spacing?.paddingTop,
    paddingBottom: area.spacing?.paddingBottom,
    ...(area.containerMode === "container" && area.maxWidth ? { maxWidth: area.maxWidth } : {}),
  } as CSSProperties;
  return <CmsPresentationView presentation={area.presentation} visualViewport={visualViewport}><section
    className={`storefrontSitePartArea ${area.containerMode === "container" ? "storefrontShell" : ""}`}
    data-cms-area={area.areaId}
    data-visible-desktop={area.visibility?.desktop !== false}
    data-visible-mobile={area.visibility?.mobile !== false}
    data-visible-tablet={area.visibility?.tablet !== false}
    style={areaStyle}
  >
    <div className="storefrontSitePartColumns" style={style}>{columns.map((column) => <div className="storefrontSitePartColumn" key={column.columnIndex}>{blocks.filter((block) => block.placement?.region === region && block.placement.areaId === area.areaId && block.placement.columnIndex === column.columnIndex).sort((a, b) => (a.placement?.order ?? 0) - (b.placement?.order ?? 0)).map((block) => {
      const placement = block.placement;
      const moduleStyle = {
        justifySelf: placement?.align ?? "stretch",
        marginTop: placement?.spacing?.marginTop,
        marginBottom: placement?.spacing?.marginBottom,
        paddingTop: placement?.spacing?.paddingTop,
        paddingBottom: placement?.spacing?.paddingBottom,
        width: placement?.width ?? "100%",
      } as CSSProperties;
      return <div
        className="storefrontSitePartModule"
        data-cms-block={block.blockId}
        data-cms-block-type={block.type}
        data-container-mode={placement?.containerMode ?? "inherit"}
        data-visible-desktop={placement?.visibility?.desktop !== false}
        data-visible-mobile={placement?.visibility?.mobile !== false}
        data-visible-tablet={placement?.visibility?.tablet !== false}
        key={block.blockId}
        style={moduleStyle}
      >{renderBlockActions?.(block)}<CmsPresentationView presentation={block.props.presentation as CmsPresentation} visualViewport={visualViewport}>{block.type === "cms.section" ? <CmsSectionView inheritedDesign={inheritedDesign} document={block.props.document as CmsSectionViewDocument} visualViewport={visualViewport} renderRegistered={registered => registered.type === "visual.module" ? <CmsBlockRenderer block={registered} visualViewport={visualViewport}/> : <CmsSystemBlockView block={registered} categories={categories} country={country} currency={currency} initialQuery={initialQuery} locale={locale} marketLabel={marketLabel} openCustomerLogin={openCustomerLogin} account={<StorefrontAuthEntry preview={preview} compact={registered.props.compact!==false} customerEmail={customerEmail} initialMode={openCustomerLogin && !customerEmail ? "login" : undefined}/>} cart={<StorefrontCartStatus preview={preview} compact={registered.props.compact!==false}/>}/>}/> : block.type === "visual.module" ? <CmsBlockRenderer block={block as CmsBlock} mode="storefront" visualViewport={visualViewport} /> : <CmsSystemBlockView account={<StorefrontAuthEntry preview={preview} compact={block.props.compact !== false} customerEmail={customerEmail} initialMode={openCustomerLogin && !customerEmail ? "login" : undefined} />} cart={<StorefrontCartStatus preview={preview} compact={block.props.compact !== false} />} block={block} categories={categories} country={country} currency={currency} customerEmail={customerEmail} initialQuery={initialQuery} locale={locale} marketLabel={marketLabel} openCustomerLogin={openCustomerLogin} />}</CmsPresentationView></div>;
    })}</div>)}</div>
  </section></CmsPresentationView>;
}


function hasNewsletterNode(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasNewsletterNode);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "newsletterForm" || record.elementType === "newsletterForm"
    || [record.tree, record.panels, record.elements, record.children, record.document, record.root, record.module, record.body, record.value].some(hasNewsletterNode);
}
