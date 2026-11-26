import { requestStorefrontBff } from "../../shared/bff/storefront-client";
import { getStorefrontContext } from "./storefront-context";
import type { StorefrontCmsBlock, StorefrontCmsPublishedPageLayout } from "./public-page-contract";

export type StorefrontSurface = "HOME" | "CMS" | "PLP" | "PDP" | "SEARCH" | "CART" | "CHECKOUT" | "ACCOUNT" | "ERROR";
export type StorefrontSitePart = {
  designDefaults?: import('../../../packages/cms-blocks/src/design-settings').CmsResolvedDesign;
  designTokens?: Parameters<typeof import('../../../packages/cms-blocks/src/design-settings').cmsDesignFromTokens>[0];
  sitePartId: string;
  kind: "HEADER" | "FOOTER";
  name: string;
  revision: { revisionId: string; revision: number; layout: StorefrontCmsPublishedPageLayout; blocks: StorefrontCmsBlock[] };
};
export type StorefrontResolvedShell = { header: StorefrontSitePart | null; footer: StorefrontSitePart | null; breadcrumbMode: "AUTO" | "HIDDEN"; fallback: boolean; resolvedFrom: string[] };

export async function getStorefrontCmsShell(surface: StorefrontSurface, pageId?: string): Promise<StorefrontResolvedShell | null> {
  try {
    const context = await getStorefrontContext();
    const params = new URLSearchParams({ organizationId: context.organizationId, shopId: context.shopId, locale: context.locale, surface });
    if (pageId) params.set("pageId", pageId);
    const result = await requestStorefrontBff<StorefrontResolvedShell>(`/storefront/cms-shell?${params.toString()}`, { withAuth: false, context: { locale: context.locale } });
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

