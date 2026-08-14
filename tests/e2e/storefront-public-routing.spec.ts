import { expect, test } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import net from "node:net";

const organizationId = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const locale = "es-ES";

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;

type ResolvedRoute = {
  kind: "ROUTE";
  requestedPath: string;
  canonicalPath: string;
  isCanonical: boolean;
  entityType: "PRODUCT" | "CATEGORY" | "CMS_PAGE";
  entityId: string;
  routeId: string;
  canonicalRouteId: string;
  organizationId: string;
  shopId: string;
  locale: string;
};

type ResolvedRedirect = {
  kind: "REDIRECT";
  requestedPath: string;
  toPath: string;
  statusCode: number;
  redirectId: string;
  organizationId: string;
  shopId: string;
  locale: string;
};

function route(
  path: string,
  entityType: "PRODUCT" | "CATEGORY" | "CMS_PAGE",
  entityId: string,
  canonicalPath = path,
): ResolvedRoute {
  return {
    kind: "ROUTE",
    requestedPath: path,
    canonicalPath,
    isCanonical: path === canonicalPath,
    entityType,
    entityId,
    routeId: `route-${entityId}-${path}`,
    canonicalRouteId: `route-${entityId}-${canonicalPath}`,
    organizationId,
    shopId,
    locale,
  };
}

function resolution(path: string): ResolvedRoute | ResolvedRedirect | null {
  if (path === "/") return route(path, "CMS_PAGE", "cms-home");
  if (path === "/cms-demo") return route(path, "CMS_PAGE", "cms-demo");
  if (path === "/cms-alias") return route(path, "CMS_PAGE", "cms-demo", "/cms-demo");
  if (path === "/bike-drivetrain") return route(path, "CATEGORY", "category-bike");
  if (path === "/product-special") return route(path, "PRODUCT", "product-special");
  if (path === "/old-cms" || path === "/temp-cms") {
    return {
      kind: "REDIRECT",
      requestedPath: path,
      toPath: "/cms-demo",
      statusCode: path === "/old-cms" ? 301 : 302,
      redirectId: `redirect-${path}`,
      organizationId,
      shopId,
      locale,
    };
  }
  return null;
}

function cmsPage(pageId: string, title: string, canonicalPath: string) {
  return {
    pageId,
    organizationId,
    shopId,
    locale,
    resolvedLocale: locale,
    pageType: pageId === "cms-home" ? "HOME" : "LANDING",
    status: "PUBLISHED",
    title,
    canonicalPath,
    routeId: `route-${pageId}`,
    seo: {
      title: `${title} | Ecommium`,
      description: `Descripción pública de ${title}.`,
    },
    blocks: [{
      blockId: `${pageId}-hero`,
      type: "banner.hero",
      props: {
        surface: "page",
        placement: "main",
        eyebrow: "CMS publicado",
        heading: title,
        body: "Contenido servido por storefront/page.",
        ctaLabel: "Ver categoría",
        ctaHref: "/bike-drivetrain",
      },
      children: [],
    }, {
      blockId: `${pageId}-visual-v2`,
      type: "visual.module",
      props: {
        schemaVersion: 2,
        schemaMinorVersion: 0,
        moduleId: `${pageId}-visual-module`,
        type: "visual.module",
        name: "Hero visual certificado",
        styles: { base: { display: "flex", padding: "24px", backgroundColor: "#f8fafc" } },
        animation: { preset: "fadeIn", durationMs: 500, delayMs: 0, easing: "standard", trigger: "load" },
        panels: [{
          panelId: `${pageId}-visual-module-panel`,
          styles: { base: { borderRadius: "12px", width: "100%" } },
          elements: [{
            elementId: `${pageId}-visual-module-heading`,
            elementType: "heading",
            contentBinding: "heading",
            props: { level: "2" },
            styles: { base: { fontSize: "32px", color: "#111827" } },
          }, {
            elementId: `${pageId}-visual-module-cta`,
            elementType: "link",
            contentBinding: "buttonText",
            props: { href: "/bike-drivetrain" },
            styles: { base: { display: "inline-flex", marginTop: "16px" } },
          }],
        }],
        contentSchema: {
          heading: { type: "text", required: true },
          buttonText: { type: "text", required: true },
        },
        contentValues: {
          heading: `Visual module v2 ${title}`,
          buttonText: "Explorar visual",
        },
      },
      children: [],
    }, {
      blockId: `${pageId}-cards`,
      type: "carousel",
      props: {
        surface: "page",
        placement: "main",
        heading: "Contenido destacado",
        items: [{ title: "Colección principal", body: "Tarjeta CMS visible." }],
      },
      children: [],
    }],
    version: 1,
    publishedAt: "2026-07-15T12:00:00.000Z",
  };
}

function categoryPage() {
  return {
    resolvedLocale: locale,
    categorySlug: "bike-drivetrain",
    total: 1,
    limit: 16,
    offset: 0,
    products: [{
      productId: "product-bike",
      variantId: "variant-bike",
      slug: "bicicleta-demo",
      productUrlPath: "/product-special",
      nombre: "Bicicleta certificada",
      isAvailable: true,
      variants: [{ variantId: "variant-bike", isDefault: true, isAvailable: true, options: [], offerings: [] }],
      price: { currentAmountMinor: 10900, currency: "EUR" },
    }],
    cmsBlocks: { beforeList: [], afterList: [] },
  };
}

function productPage() {
  return {
    product: {
      productId: "product-special",
      slug: "product-special",
      name: "Producto especial",
      shortDescription: "Producto resuelto por su ruta SEO.",
      isAvailable: true,
      variants: [{
        variantId: "variant-special",
        name: "Producto especial",
        refId: "SPECIAL-1",
        isDefault: true,
        isAvailable: true,
        images: [],
        options: [],
        offerings: [],
        price: { currentAmountMinor: 4999, currency: "EUR" },
      }],
      price: { currentAmountMinor: 4999, currency: "EUR" },
      images: [],
      specifications: [],
    },
  };
}

function pagePayload(path: string) {
  const resolved = resolution(path);
  if (!resolved || resolved.kind === "REDIRECT") return resolved;
  if (resolved.entityType === "CMS_PAGE") {
    const title = resolved.entityId === "cms-home" ? "Inicio CMS" : "Campaña de verano";
    return { kind: "CMS_PAGE", route: resolved, page: cmsPage(resolved.entityId, title, resolved.canonicalPath) };
  }
  if (resolved.entityType === "CATEGORY") return { kind: "CATEGORY", route: resolved, page: categoryPage() };
  return { kind: "PRODUCT", route: resolved, page: productPage() };
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  return typeof address === "object" && address ? address.port : 0;
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${bffPort}`);
    if (url.pathname === "/api/v1/storefront/resolve-path") {
      const result = resolution(url.searchParams.get("path") ?? "");
      return result ? sendJson(response, 200, result) : sendJson(response, 404, { message: "route not found" });
    }
    if (url.pathname === "/api/v1/storefront/page") {
      const result = pagePayload(url.searchParams.get("path") ?? "");
      return result ? sendJson(response, 200, result) : sendJson(response, 404, { message: "route not found" });
    }
    if (url.pathname === "/api/v1/storefront/navigation/categories/tree/3") {
      return sendJson(response, 200, {
        categories: [{ id: "category-bike", name: "Bike Drivetrain", linkId: "bike-drivetrain", children: [] }],
      });
    }
    return sendJson(response, 404, { message: "not found" });
  });
  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function waitForNext(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_ADMIN_BFF_BASE_URL: "http://127.0.0.1:1/api/v1",
      ECOMMIUM_STOREFRONT_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_STOREFRONT_ORGANIZATION_ID: organizationId,
      ECOMMIUM_STOREFRONT_SHOP_ID: shopId,
      NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL: `http://127.0.0.1:${nextPort}`,
    },
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/cms-demo`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("renders CMS home, canonical page and alias metadata", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/`);
  await expect(page.getByRole("heading", { level: 1, name: "Inicio CMS" })).toBeVisible();
  await expect(page.getByText("Contenido servido por storefront/page.")).toBeVisible();

  await page.goto(`http://127.0.0.1:${nextPort}/cms-demo`);
  await expect(page.getByRole("heading", { level: 1, name: "Campaña de verano" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Visual module v2 Campaña de verano" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar visual" })).toHaveAttribute("href", /\/bike-drivetrain$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/cms-demo$/);

  await page.goto(`http://127.0.0.1:${nextPort}/cms-alias`);
  await expect(page.getByRole("heading", { level: 1, name: "Campaña de verano" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/cms-demo$/);
});

test("preserves redirect status codes from Routing SEO", async ({ request }) => {
  const permanent = await request.get(`http://127.0.0.1:${nextPort}/old-cms`, { maxRedirects: 0 });
  expect(permanent.status()).toBe(301);
  expect(permanent.headers().location).toBe("/cms-demo");

  const temporary = await request.get(`http://127.0.0.1:${nextPort}/temp-cms`, { maxRedirects: 0 });
  expect(temporary.status()).toBe(302);
  expect(temporary.headers().location).toBe("/cms-demo");
});

test("renders category product and a neutral 404 through generic routes", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/bike-drivetrain`);
  await expect(page.getByRole("heading", { level: 1, name: "Bike Drivetrain" })).toBeVisible();
  await expect(page.getByText("Bicicleta certificada")).toBeVisible();

  await page.goto(`http://127.0.0.1:${nextPort}/product-special`);
  await expect(page.getByRole("heading", { level: 1, name: "Producto especial" })).toBeVisible();
  await expect(page.getByText("Producto resuelto por su ruta SEO.").first()).toBeVisible();

  const response = await page.goto(`http://127.0.0.1:${nextPort}/missing-page`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});
