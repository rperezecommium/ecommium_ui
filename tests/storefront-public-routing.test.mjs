import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const contract = readFileSync(
  path.resolve(root, "src/modules/storefront/public-page-contract.ts"),
  "utf8",
);
const client = readFileSync(
  path.resolve(root, "src/modules/storefront/public-page.ts"),
  "utf8",
);
const catchAll = readFileSync(
  path.resolve(root, "app/[...pathSegments]/page.tsx"),
  "utf8",
);
const pathClient = readFileSync(
  path.resolve(root, "src/modules/storefront/public-path.ts"),
  "utf8",
);
const metadata = readFileSync(
  path.resolve(root, "src/modules/storefront/public-page-metadata.ts"),
  "utf8",
);
const proxy = readFileSync(path.resolve(root, "proxy.ts"), "utf8");
const rootLayout = readFileSync(path.resolve(root, "app/layout.tsx"), "utf8");
const globalsCss = readFileSync(path.resolve(root, "app/globals.css"), "utf8");
const commerceAdapter = readFileSync(
  path.resolve(root, "src/modules/storefront/public-commerce-page.ts"),
  "utf8",
);
const pdp = readFileSync(path.resolve(root, "src/modules/storefront/pdp.ts"), "utf8");
const plp = readFileSync(path.resolve(root, "src/modules/storefront/plp.ts"), "utf8");
const cmsPage = readFileSync(
  path.resolve(root, "src/modules/storefront/storefront-cms-page.tsx"),
  "utf8",
);
const cmsBlocksRenderer = readFileSync(
  path.resolve(root, "packages/cms-blocks/src/react.tsx"),
  "utf8",
);
const plpPage = readFileSync(
  path.resolve(root, "src/modules/storefront/plp-page.tsx"),
  "utf8",
);
const publicView = readFileSync(
  path.resolve(root, "src/modules/storefront/public-page-view.tsx"),
  "utf8",
);
const home = readFileSync(path.resolve(root, "app/page.tsx"), "utf8");
const publicNotFound = readFileSync(
  path.resolve(root, "app/[...pathSegments]/not-found.tsx"),
  "utf8",
);
const publicLoading = readFileSync(
  path.resolve(root, "app/[...pathSegments]/loading.tsx"),
  "utf8",
);
const publicError = readFileSync(
  path.resolve(root, "app/[...pathSegments]/error.tsx"),
  "utf8",
);

test("public routing contract models every BFF page outcome", () => {
  assert.match(contract, /"PRODUCT", "CATEGORY", "CMS_PAGE", "REDIRECT"/);
  assert.match(contract, /StorefrontPublicPageResponse/);
  assert.match(contract, /StorefrontPublicRedirectStatus = 301 \| 302/);
  assert.match(contract, /route: StorefrontPublicRoute & \{ entityType: "PRODUCT" \}/);
  assert.match(contract, /route: StorefrontPublicRoute & \{ entityType: "CATEGORY" \}/);
  assert.match(contract, /route: StorefrontPublicRoute & \{ entityType: "CMS_PAGE" \}/);
});

test("public routing contract includes CMS, canonical SEO and safe errors", () => {
  assert.match(contract, /StorefrontCmsPublishedPage/);
  assert.match(contract, /children\?: StorefrontCmsBlock\[\]/);
  assert.match(contract, /canonicalPath: string/);
  assert.match(contract, /indexable: boolean/);
  assert.match(contract, /INVALID_PATH/);
  assert.match(contract, /NOT_FOUND/);
  assert.match(contract, /TEMPORARILY_UNAVAILABLE/);
  assert.match(contract, /status === 404 \|\| status === 401 \|\| status === 403/);
});

test("public routing contract rejects unknown or incomplete BFF outcomes", () => {
  assert.match(contract, /isStorefrontPublicPageResponse/);
  assert.match(contract, /payload\.kind !== "PRODUCT"/);
  assert.match(contract, /route\.entityType === payload\.kind/);
  assert.match(contract, /payload\.statusCode === 301 \|\| payload\.statusCode === 302/);
});

test("public page client consumes only the composed Storefront BFF page", () => {
  assert.match(client, /requestStorefrontBff<unknown>/);
  assert.match(client, /\/storefront\/page\?/);
  assert.match(client, /withAuth: false/);
  assert.match(client, /getStorefrontContext/);
  assert.match(client, /organizationId: context\.organizationId/);
  assert.match(client, /shopId: context\.shopId/);
  assert.match(client, /path: publicPath/);
  assert.doesNotMatch(client, /services\/cms|services\/routing-seo|\/cms\/pages\/.*published/);
});

test("public page client validates paths pagination and BFF payloads", () => {
  assert.match(client, /normalizeStorefrontPublicPath/);
  assert.match(client, /path\.includes\("\?:"\)|path\.includes\("\?"\)/);
  assert.match(client, /segment === "\." \|\| segment === "\.\."/);
  assert.match(client, /maximumPageSize = 100/);
  assert.match(client, /offset = \(page - 1\) \* limit/);
  assert.match(client, /isStorefrontPublicPageResponse/);
  assert.match(client, /status: 502/);
  assert.match(client, /x-visitor-id/);
});

test("public catch-all resolves unmatched storefront paths through the page client", () => {
  assert.match(catchAll, /getStorefrontPublicPage\(path, \{ page, limit, visitorId \}\)/);
  assert.match(catchAll, /loadPublicPage\(publicPath/);
  assert.match(catchAll, /pathSegments\.join\("\/"\)/);
  assert.match(catchAll, /loadPublicPage\(publicPath, first\(query\.page\), first\(query\.limit\), visitorId\)/);
  assert.match(catchAll, /storefrontVisitorCookieName/);
  assert.doesNotMatch(catchAll, /requestAdminBff|services\/cms|services\/routing-seo/);
});

test("public catch-all keeps private and existing storefront surfaces reserved", () => {
  for (const segment of ["api", "admin", "account", "auth", "cart", "checkout", "pdp", "plp", "pedido", "search"]) {
    assert.match(catchAll, new RegExp(`"${segment}"`));
  }
  assert.match(catchAll, /reservedFirstSegments\.has\(firstSegment\)/);
  assert.match(catchAll, /if \(!isPublicPath\(pathSegments\)\) notFound\(\)/);
});

test("public catch-all dispatches resolved types without exposing technical ids", () => {
  assert.match(catchAll, /<StorefrontResolvedPublicPage/);
  assert.match(publicView, /data\.kind === "REDIRECT"/);
  assert.match(publicView, /isSafeStorefrontTarget/);
  assert.match(publicView, /data\.kind === "PRODUCT"/);
  assert.match(publicView, /data\.kind === "CATEGORY"/);
  assert.match(publicView, /<StorefrontCmsPage page=\{data\.page\}/);
  assert.doesNotMatch(catchAll, /entityId|routeId|canonicalRouteId|organizationId|shopId/);
});

test("public redirect resolution uses the BFF and preserves exact HTTP semantics", () => {
  assert.match(pathClient, /requestStorefrontBff<unknown>/);
  assert.match(pathClient, /\/storefront\/resolve-path\?/);
  assert.match(pathClient, /withAuth: false/);
  assert.match(pathClient, /isStorefrontPublicPathResolution/);
  assert.doesNotMatch(pathClient, /services\/cms|services\/routing-seo/);
  assert.match(proxy, /resolution\.data\.kind !== "REDIRECT"/);
  assert.match(proxy, /isSafeStorefrontTarget\(resolution\.data\.toPath\)/);
  assert.match(proxy, /NextResponse\.redirect\(target, resolution\.data\.statusCode\)/);
});

test("public proxy avoids existing and private surfaces", () => {
  for (const segment of ["api", "admin", "account", "auth", "cart", "checkout", "pdp", "plp", "pedido", "search"]) {
    assert.match(proxy, new RegExp(`"${segment}"`));
  }
  assert.match(proxy, /reservedFirstSegments\.has\(firstSegment\)/);
  assert.match(proxy, /request\.method !== "GET" && request\.method !== "HEAD"/);
  assert.match(proxy, /resolution\.data\.toPath === request\.nextUrl\.pathname/);
  assert.match(proxy, /NextResponse\.rewrite\(notFoundTarget, \{ status: 404 \}\)/);
  assert.match(proxy, /notFoundTarget\.pathname = "\/public-system\/not-found"/);
});

test("canonical pages are indexable while aliases point to canonical without indexing", () => {
  assert.match(catchAll, /export async function generateMetadata/);
  assert.match(catchAll, /buildStorefrontPublicMetadata\(result\.data\)/);
  assert.match(metadata, /alternates: \{ canonical: publicMetadata\.canonicalPath \}/);
  assert.match(metadata, /index: publicMetadata\.indexable/);
  assert.match(metadata, /indexable: result\.route\.isCanonical/);
  assert.match(metadata, /result\.page\.seo\.title \|\| result\.page\.title/);
  assert.match(rootLayout, /metadataBase: new URL/);
  assert.match(rootLayout, /NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL/);
});

test("generic product routes reuse the operative PDP without a second product request", () => {
  assert.match(publicView, /data\.kind === "PRODUCT"/);
  assert.match(publicView, /productPublicPageToPdpResult\(data/);
  assert.match(publicView, /<StorefrontPdpPage result=\{result\}/);
  assert.match(commerceAdapter, /mapStorefrontPdpPayload\(publicPage\.page/);
  assert.match(pdp, /export async function mapStorefrontPdpPayload/);
  assert.doesNotMatch(commerceAdapter, /getStorefrontPdp\(/);
  assert.doesNotMatch(publicView, /Producto encontrado/);
});

test("generic category routes reuse the operative PLP and canonical pagination", () => {
  assert.match(publicView, /data\.kind === "CATEGORY"/);
  assert.match(publicView, /categoryPublicPageToPlpResult\(data/);
  assert.match(publicView, /<StorefrontPlpPage/);
  assert.match(commerceAdapter, /mapStorefrontPlpPayload\(publicPage\.page/);
  assert.match(commerceAdapter, /publicPath: publicPage\.route\.canonicalPath/);
  assert.match(plp, /export async function mapStorefrontPlpPayload/);
  assert.doesNotMatch(commerceAdapter, /getStorefrontPlp\(/);
  assert.doesNotMatch(publicView, /Categoría encontrada/);
});

test("public commerce adapters preserve tenant and anonymous interaction context", () => {
  assert.match(commerceAdapter, /organizationId: publicPage\.route\.organizationId/);
  assert.match(commerceAdapter, /shopId: publicPage\.route\.shopId/);
  assert.match(commerceAdapter, /locale: publicPage\.route\.locale/);
  assert.match(commerceAdapter, /visitorId: request\.visitorId/);
  assert.match(catchAll, /visitorId=\{visitorId\}/);
});

test("published CMS pages render all supported block families", () => {
  for (const blockType of [
    "banner.hero",
    "slider.fullWidth",
    "plp.categoryIntro",
    "plp.subcategoryTiles",
    "accordion",
    "carousel",
    "visual.module",
  ]) {
    assert.match(cmsBlocksRenderer, new RegExp(blockType.replace(".", "\\.")));
  }
  assert.match(cmsPage, /StorefrontCmsBlockRenderer/);
  assert.match(cmsBlocksRenderer, /block\.children \?\? \[\]/);
  assert.match(cmsBlocksRenderer, /maximumBlockDepth = 4/);
  assert.match(cmsBlocksRenderer, /maximumItemsPerBlock = 12/);
  assert.match(cmsBlocksRenderer, /maximumVisualNodeDepth = 8/);
  assert.match(cmsBlocksRenderer, /maximumVisualChildrenPerNode = 24/);
  assert.match(cmsBlocksRenderer, /normalizeCmsVisualModuleProps/);
  assert.match(cmsBlocksRenderer, /VisualModuleBlock/);
  assert.match(cmsBlocksRenderer, /VisualNodeRenderer/);
  assert.match(cmsBlocksRenderer, /responsiveStyles/);
  assert.match(cmsBlocksRenderer, /visualViewport/);
  assert.match(cmsBlocksRenderer, /visualViewportStyleValue/);
  assert.match(cmsBlocksRenderer, /visualStyleVariableKeys/);
  assert.match(cmsBlocksRenderer, /style\[key\] = resolvedBaseValue/);
  assert.match(cmsBlocksRenderer, /style\[key\] = resolvedScopedValue/);
  assert.match(cmsBlocksRenderer, /htmlEmbed/);
});

test("CMS rendering ignores unsafe content and PLP-only placements", () => {
  assert.doesNotMatch(cmsPage + cmsBlocksRenderer, /dangerouslySetInnerHTML|eval\(|new Function/);
  assert.match(cmsBlocksRenderer, /!isSupportedCmsBlockType\(block\.type\)\) return null/);
  assert.match(cmsBlocksRenderer, /url\.protocol === "https:"/);
  assert.match(cmsBlocksRenderer, /href\.startsWith\("\/"\) && !href\.startsWith\("\/\/"\)/);
  assert.match(cmsPage, /block\.props\.surface !== "plp"/);
  assert.match(cmsPage, /block\.props\.placement !== "beforeList"/);
  assert.match(cmsPage, /block\.props\.placement !== "afterList"/);
  assert.match(cmsPage, /StorefrontCmsPageBlocks/);
  assert.match(cmsPage, /storefrontCmsLayoutForPage/);
  assert.match(cmsPage, /storefrontCmsBlocksForColumn/);
  assert.match(cmsPage, /placementForStorefrontBlock/);
  assert.match(cmsPage, /normalizeCmsBlockModulePlacement/);
  assert.match(cmsPage, /gridTemplateColumns/);
  assert.match(cmsPage, /data-cms-column/);
  assert.match(cmsPage, /fallbackStorefrontCmsLayout/);
  assert.match(globalsCss, /storefrontCmsPageColumns/);
  assert.match(globalsCss, /grid-template-columns: minmax\(0, 1fr\) !important/);
});

test("CMS page keeps storefront navigation and the PLP shares the safe renderer", () => {
  assert.match(cmsPage, /<StorefrontHeader/);
  assert.match(cmsPage, /className="storefrontBreadcrumb"/);
  assert.match(cmsPage, /<h1>\{page\.title\}<\/h1>/);
  assert.match(plpPage, /StorefrontCmsBlockRenderer/);
  assert.doesNotMatch(plpPage, /function StorefrontBlock/);
  assert.doesNotMatch(publicView, /render definitivo se completa/);
});

test("CMS contract requires a complete published page before rendering", () => {
  assert.match(contract, /page\.status === "PUBLISHED"/);
  assert.match(contract, /Array\.isArray\(page\.blocks\)/);
  assert.match(contract, /StorefrontCmsResolvedPageSettings/);
  assert.match(contract, /resolvedPageSettings\?: StorefrontCmsResolvedPageSettings \| null/);
  assert.match(contract, /typeof seo\?\.title === "string"/);
  assert.match(contract, /typeof seo\?\.description === "string"/);
});

test("home resolves slash through the canonical page endpoint before legacy fallback", () => {
  assert.match(home, /getStorefrontPublicPage\("\/"/);
  assert.match(home, /<StorefrontResolvedPublicPage/);
  assert.match(home, /buildStorefrontPublicMetadata\(result\.data\)/);
  assert.match(home, /getStorefrontPlp\(homeCategorySlug/);
  assert.doesNotMatch(home, /StorefrontPublicFailure/);
  assert.match(proxy, /if \(!firstSegment\) return request\.nextUrl\.pathname === "\/"/);
});

test("public route has understandable loading not-found and retry states", () => {
  assert.match(publicNotFound, /StorefrontPublicNotFound/);
  assert.match(publicView, /Error 404/);
  assert.match(publicView, /No encontramos esta página/);
  assert.match(publicLoading, /aria-busy="true"/);
  assert.match(publicLoading, /storefrontPublicLoading/);
  assert.match(publicError, /"use client"/);
  assert.match(publicError, /onClick=\{reset\}/);
  assert.match(publicError, /Reintentar/);
  assert.doesNotMatch(publicNotFound + publicError + publicView, /stack|digest/);
});
