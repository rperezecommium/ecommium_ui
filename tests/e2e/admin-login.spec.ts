import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import net from "node:net";

const defaultOrganizationId = "11111111-1111-4111-8111-111111111111";
const barcelonaShopId = "22222222-2222-4222-8222-222222222222";

type CapturedLoginPayload = {
  email?: string;
  password?: string;
  organizationId?: string;
  shopId?: string;
  shopAlias?: string;
  scope?: string;
};

let bffServer: Server;
let bffPort = 0;
let nextPort = 0;
let nextProcess: ChildProcessWithoutNullStreams;
const capturedLoginPayloads: CapturedLoginPayload[] = [];
const capturedBffRequests: string[] = [];
const capturedDraftStateRequests: string[] = [];
const capturedDraftMediaUploadRequests: string[] = [];
const capturedDraftMediaUploadIdempotencyKeys: string[] = [];
const capturedDraftMediaUploadBodies: string[] = [];
const capturedSaveOperationRequests: string[] = [];
const capturedSaveOperationIdempotencyKeys: string[] = [];
const capturedSaveOperationBodies: string[] = [];
const capturedEditorStateRequests: string[] = [];
let saveOperationMode: "partial_failed" | "success" | "published" = "partial_failed";
let draftMediaUploadMode: "success" | "failed" = "success";
const uploadedDraftMediaByClientDraftId = new Map<string, Array<{
  localId: string;
  mediaAssetId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  previewUrl: string;
  thumbnailUrl: string;
  isMain: boolean;
  position: number;
  active: boolean;
  persisted: true;
  uploadStatus: "uploaded";
  alt: Record<string, string>;
  title: Record<string, string>;
}>>();
const onePixelPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

function readJsonBody(request: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += String(chunk);
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) as Record<string, unknown> : {});
      } catch {
        resolve({});
      }
    });
  });
}

function readRawBody(request: IncomingMessage) {
  return new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function parseMultipartTextField(body: string, name: string) {
  const marker = `name="${name}"`;
  const markerIndex = body.indexOf(marker);
  if (markerIndex < 0) {
    return "";
  }

  const valueStart = body.indexOf("\r\n\r\n", markerIndex);
  if (valueStart < 0) {
    return "";
  }

  const valueEnd = body.indexOf("\r\n--", valueStart + 4);
  return body.slice(valueStart + 4, valueEnd > valueStart ? valueEnd : undefined).trim();
}

function draftIdFromProductDraftPath(pathname: string) {
  const parts = pathname.split("/");
  const draftIndex = parts.indexOf("product-drafts");
  return draftIndex >= 0 ? decodeURIComponent(parts[draftIndex + 1] ?? "") : "";
}

async function startBffMock() {
  bffPort = await freePort();
  bffServer = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${bffPort}`);
    capturedBffRequests.push(`${request.method ?? "GET"} ${url.pathname}`);

    if (
      url.pathname.startsWith("/api/v1/admin/") &&
      request.headers.authorization !== "Bearer server-admin-token" &&
      request.headers.authorization !== "Bearer access-token"
    ) {
      sendJson(response, 401, { message: "authorization header is required" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/context/available") {
      sendJson(response, 200, {
        tenantAccess: {
          level: "SHOP",
          shopScopes: [
            { organizationId: defaultOrganizationId, shopId: barcelonaShopId },
          ],
        },
        organizations: [{
          organizationId: defaultOrganizationId,
          name: "Ecommium Default Organization",
        }],
        shops: [
          {
            shopId: barcelonaShopId,
            organizationId: defaultOrganizationId,
            organizationName: "Ecommium Default Organization",
            shopName: "Tienda Barcelona",
            shopAlias: "tienda-barcelona",
            primaryDomain: "barcelona.local",
            status: "ACTIVE",
            effectiveSettings: {
              defaultLocale: "es-ES",
              defaultCurrency: "EUR",
              defaultCountry: "ES",
            },
          },
        ],
        selectionRequired: false,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/organizations") {
      sendJson(response, 200, {
        items: [{
          organizationId: defaultOrganizationId,
          name: "Ecommium Default Organization",
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shop-groups") {
      sendJson(response, 200, { items: [] });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shops") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      sendJson(response, 200, {
        items: [
          {
            shopId: barcelonaShopId,
            organizationId: defaultOrganizationId,
            name: "Tienda Barcelona",
            shopAlias: "tienda-barcelona",
            primaryDomain: "barcelona.local",
            status: "ACTIVE",
          },
        ],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/organizations-shops/shops/context/resolve") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      const shopAlias = url.searchParams.get("shopAlias");
      sendJson(response, 200, {
        shopId: barcelonaShopId,
        organizationId: defaultOrganizationId,
        name: "Tienda Barcelona",
        shopAlias,
        status: "ACTIVE",
        effectiveSettings: {
          defaultLocale: "es-ES",
          defaultCurrency: "EUR",
          defaultCountry: "ES",
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/categories") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        items: [{
          categoryId: "category-bikes",
          name: "Bicicletas",
          slug: "bicicletas",
          isActive: true,
        }],
        total: 1,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/brands") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        items: [{
          brandId: "brand-demo",
          name: "Marca Demo",
          slug: "marca-demo",
          isActive: true,
        }],
        total: 1,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/taxes") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        items: [{
          taxId: "tax-standard",
          taxCode: "standard",
          name: "IVA general",
          calculationType: "PERCENTAGE",
          rate: 0.21,
          isActive: true,
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/price-tables") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        items: [{
          priceTableId: "base",
          name: "Base",
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/shipping/configuration") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        carriers: [{
          carrierId: "carrier-standard",
          name: "Carrier Standard",
          active: true,
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/products/product-edit-1/editor-state") {
      capturedEditorStateRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale")).toBe("es-ES");
      expect(url.searchParams.get("currency")).toBe("EUR");
      expect(url.searchParams.get("warehouseId")).toBe("main-warehouse");
      sendJson(response, 200, {
        product: {
          productId: "product-edit-1",
          name: { "es-ES": "Producto existente Playwright" },
          slug: "producto-existente-playwright",
          isActive: false,
          isVisible: true,
          categoryId: "category-bikes",
          categoryName: "Bicicletas",
          brandId: "brand-demo",
          brandName: "Marca Demo",
          mediaCollectionId: "collection-edit-1",
          defaultVariantId: "variant-edit-default",
          shortDescription: { "es-ES": "Resumen editable" },
          description: { "es-ES": "Descripcion editable" },
          taxCode: "standard",
          shipping: {
            package: {
              weightGrams: 1200,
              widthMm: 400,
              heightMm: 800,
              depthMm: 120,
            },
            additionalShippingCostMinor: 250,
            allowedCarrierIds: ["carrier-standard"],
            deliveryTimeMode: "default",
            deliveryTimeNotes: {
              inStock: { "es-ES": "Entrega estandar" },
              outOfStock: {},
            },
          },
        },
        variants: [{
          variantId: "variant-edit-default",
          name: "Producto existente Playwright",
          refId: "PEP-001",
          ean: "8430000000001",
          isActive: true,
          isVisible: true,
          isDefault: true,
        }],
        mediaCollection: {
          mediaCollectionId: "collection-edit-1",
          items: [{
            mediaAssetId: "asset-edit-1",
            fileName: "edit-cover.png",
            mimeType: "image/png",
            fileSize: 68,
            publicUrl: onePixelPngDataUrl,
            cover: true,
            isActive: true,
            alt: { "es-ES": "Imagen producto existente" },
            title: { "es-ES": "Imagen producto existente" },
          }],
        },
        variantMedia: {
          "variant-edit-default": [{
            mediaAssetId: "asset-edit-1",
            isMain: true,
          }],
        },
        prices: {
          product: [{
            pricingId: "pricing-edit-product",
            targetType: "PRODUCT",
            productId: "product-edit-1",
            basePriceMinor: 129900,
            currency: "EUR",
            taxIncluded: true,
            taxCode: "standard",
            tax: {
              taxCode: "standard",
              name: "IVA general",
              calculationType: "PERCENTAGE",
              rate: 0.21,
              isActive: true,
            },
            priceTableId: "base",
          }],
        },
        availability: {
          items: [{
            variantId: "variant-edit-default",
            warehouseId: "main-warehouse",
            onHandQuantity: 12,
            reservedQuantity: 2,
            safetyStockQuantity: 1,
            availableQuantity: 9,
            available: true,
          }],
        },
        warnings: [],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/offerings/variants/resolve-batch") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      sendJson(response, 200, {
        variants: [{
          variantId: "variant-edit-default",
          offerings: [],
        }],
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/product-drafts/product-edit-1") {
      capturedDraftStateRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale")).toBe("es-ES");
      sendJson(response, 200, {
        ok: true,
        clientDraftId: "product-edit-1",
        productId: "product-edit-1",
        defaultVariantId: "variant-edit-default",
        mediaCollectionId: "collection-edit-1",
        status: "incomplete",
        expiresAt: "2026-06-25T00:00:00.000Z",
        mediaItems: [{
          localId: "asset-edit-1",
          mediaAssetId: "asset-edit-1",
          fileName: "edit-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: onePixelPngDataUrl,
          thumbnailUrl: onePixelPngDataUrl,
          isMain: true,
          position: 1,
          active: true,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen producto existente" },
          title: { "es-ES": "Imagen producto existente" },
        }],
        warnings: [],
        correlationIds: ["bff-edit-draft-state"],
        draftPatch: {
          clientDraftId: "product-edit-1",
          productId: "product-edit-1",
          defaultVariantId: "variant-edit-default",
          mediaCollectionId: "collection-edit-1",
        },
      });
      return;
    }

    if (request.method === "GET" && /^\/api\/v1\/admin\/product-drafts\/[^/]+$/.test(url.pathname)) {
      capturedDraftStateRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale")).toBe("es-ES");
      const clientDraftId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      const uploadedItems = uploadedDraftMediaByClientDraftId.get(clientDraftId) ?? [];
      sendJson(response, 200, {
        ok: true,
        clientDraftId,
        productId: "product-draft-remote",
        defaultVariantId: "variant-default-remote",
        mediaCollectionId: "collection-remote",
        status: "incomplete",
        expiresAt: "2026-06-25T00:00:00.000Z",
        mediaItems: [{
          localId: "remote-media-1",
          mediaAssetId: "asset-remote-1",
          fileName: "remote-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: onePixelPngDataUrl,
          thumbnailUrl: onePixelPngDataUrl,
          isMain: true,
          position: 1,
          active: true,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen principal remota" },
          title: { "es-ES": "Imagen principal remota" },
        }, ...uploadedItems],
        warnings: [],
        correlationIds: ["bff-draft-state"],
        draftPatch: {
          clientDraftId,
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
        },
      });
      return;
    }

    if (request.method === "POST" && /^\/api\/v1\/admin\/product-drafts\/[^/]+\/media$/.test(url.pathname)) {
      capturedDraftMediaUploadRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale")).toBe("es-ES");
      expect(request.headers["idempotency-key"]).toBeTruthy();
      capturedDraftMediaUploadIdempotencyKeys.push(String(request.headers["idempotency-key"]));
      const uploadBody = await readRawBody(request);
      capturedDraftMediaUploadBodies.push(uploadBody);
      const clientDraftId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
      if (draftMediaUploadMode === "failed") {
        sendJson(response, 200, {
          ok: false,
          uploadOperationId: "pdmu-playwright-failed",
          idempotencyKey: request.headers["idempotency-key"],
          clientDraftId,
          status: "incomplete",
          messages: ["Media temporal no disponible."],
          fieldErrors: {
            media: "Media temporal no disponible.",
          },
          correlationIds: ["bff-draft-media-upload-failed"],
        });
        return;
      }

      const uploadedLocalId = parseMultipartTextField(uploadBody, "fileLocalId") || "uploaded-media-playwright";
      uploadedDraftMediaByClientDraftId.set(clientDraftId, [
        ...(uploadedDraftMediaByClientDraftId.get(clientDraftId) ?? []),
        {
          localId: uploadedLocalId,
          mediaAssetId: "asset-uploaded-playwright",
          fileName: "playwright-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: onePixelPngDataUrl,
          thumbnailUrl: onePixelPngDataUrl,
          isMain: false,
          position: 2,
          active: true,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen subida por Playwright" },
          title: { "es-ES": "Imagen subida por Playwright" },
        },
      ]);

      sendJson(response, 200, {
        ok: true,
        uploadOperationId: "pdmu-playwright",
        idempotencyKey: request.headers["idempotency-key"],
        clientDraftId,
        productId: "product-draft-remote",
        defaultVariantId: "variant-default-remote",
        mediaCollectionId: "collection-remote",
        mediaItem: {
          localId: "uploaded-media-playwright",
          mediaAssetId: "asset-uploaded-playwright",
          fileName: "playwright-cover.png",
          mimeType: "image/png",
          fileSize: 68,
          previewUrl: onePixelPngDataUrl,
          isMain: false,
          persisted: true,
          uploadStatus: "uploaded",
          alt: { "es-ES": "Imagen subida por Playwright" },
          title: { "es-ES": "Imagen subida por Playwright" },
        },
        status: "incomplete",
        correlationIds: ["bff-draft-media-upload"],
        draftPatch: {
          clientDraftId,
          productId: "product-draft-remote",
          mediaCollectionId: "collection-remote",
        },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/product-save-operations") {
      capturedSaveOperationRequests.push(url.pathname);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("locale")).toBe("es-ES");
      expect(request.headers["idempotency-key"]).toBeTruthy();
      capturedSaveOperationIdempotencyKeys.push(String(request.headers["idempotency-key"]));
      capturedSaveOperationBodies.push(await readRawBody(request));
      if (saveOperationMode === "published") {
        sendJson(response, 200, {
          ok: true,
          operationId: "pso-playwright-published",
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
          status: "published",
          retryable: false,
          blocks: {
            catalog: "success",
            variants: "skipped",
            media: "success",
            variantMedia: "success",
            pricing: "success",
            inventory: "success",
            shipping: "success",
            publish: "success",
          },
          messages: ["Producto publicado."],
          fieldErrors: {},
          recoveryActions: [],
          correlationIds: ["bff-save-published"],
          draftPatch: {
            productId: "product-draft-remote",
            defaultVariantId: "variant-default-remote",
            mediaCollectionId: "collection-remote",
            saveState: {
              catalog: "success",
              variants: "skipped",
              media: "success",
              variantMedia: "success",
              pricing: "success",
              inventory: "success",
              shipping: "success",
              publish: "success",
            },
          },
        });
        return;
      }

      if (saveOperationMode === "success") {
        sendJson(response, 200, {
          ok: true,
          operationId: "pso-playwright-success",
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
          status: "saved_unpublished",
          retryable: false,
          blocks: {
            catalog: "success",
            variants: "skipped",
            media: "success",
            variantMedia: "success",
            pricing: "skipped",
            inventory: "skipped",
            shipping: "success",
            publish: "skipped",
          },
          messages: ["Producto guardado."],
          fieldErrors: {},
          recoveryActions: [],
          correlationIds: ["bff-save-success"],
          draftPatch: {
            productId: "product-draft-remote",
            defaultVariantId: "variant-default-remote",
            mediaCollectionId: "collection-remote",
            saveState: {
              catalog: "success",
              variants: "skipped",
              media: "success",
              variantMedia: "success",
              pricing: "skipped",
              inventory: "skipped",
              shipping: "success",
              publish: "skipped",
            },
          },
        });
        return;
      }

      sendJson(response, 200, {
        ok: false,
        operationId: "pso-playwright-partial",
        productId: "product-draft-remote",
        defaultVariantId: "variant-default-remote",
        mediaCollectionId: "collection-remote",
        status: "partial_failed",
        retryable: true,
        blocks: {
          catalog: "success",
          variants: "skipped",
          media: "success",
          variantMedia: "success",
          pricing: "failed",
          inventory: "pending",
          shipping: "success",
          publish: "blocked",
        },
        messages: ["Precio pendiente de guardar."],
        fieldErrors: {
          pricing: "Pricing no disponible.",
        },
        recoveryActions: [{
          code: "retry_pricing",
          label: "Reintentar precio",
          targetBlock: "pricing",
          retryable: true,
        }],
        correlationIds: ["bff-save-partial"],
        draftPatch: {
          productId: "product-draft-remote",
          defaultVariantId: "variant-default-remote",
          mediaCollectionId: "collection-remote",
          saveState: {
            catalog: "success",
            variants: "skipped",
            media: "success",
            variantMedia: "success",
            pricing: "failed",
            inventory: "pending",
            shipping: "success",
            publish: "blocked",
          },
        },
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
      const body = await readJsonBody(request);
      capturedLoginPayloads.push(body);
      sendJson(response, 200, {
        profile: {
          principalId: "employee-1",
          principalType: "EMPLOYEE",
          email: body.email,
        },
        session: {
          sessionId: "session-1",
          principalType: "EMPLOYEE",
          scope: "admin",
        },
        tokens: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresInSeconds: 900,
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
      if (request.headers.authorization !== "Bearer access-token") {
        sendJson(response, 401, { message: "invalid access token" });
        return;
      }

      sendJson(response, 200, {
        principal: {
          sub: "employee-1",
          principalType: "EMPLOYEE",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: ["admin:*"],
          tenantAccess: {
            level: "SHOP",
            shopScopes: [
              { organizationId: defaultOrganizationId, shopId: barcelonaShopId },
            ],
          },
          scope: "admin",
        },
      });
      return;
    }

    sendJson(response, 404, { message: `Unhandled mock route ${request.method} ${url.pathname}` });
  });
  bffServer.listen(bffPort, "127.0.0.1");
  await once(bffServer, "listening");
}

async function waitForNext(url: string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Next dev server did not become ready at ${url}`);
}

async function startNext() {
  nextPort = await freePort();
  nextProcess = spawn("npx", ["next", "start", "-p", String(nextPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ECOMMIUM_BFF_BASE_URL: `http://127.0.0.1:${bffPort}/api/v1`,
      ECOMMIUM_ADMIN_BFF_TOKEN: "server-admin-token",
    },
  });
  await waitForNext(`http://127.0.0.1:${nextPort}/auth/login`);
}

async function loginAdmin(page: Page) {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin`);
}

test.beforeAll(async () => {
  await startBffMock();
  await startNext();
});

test.afterAll(async () => {
  nextProcess?.kill();
  bffServer?.close();
});

test("admin login authenticates without tenant fields and loads context afterwards", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${nextPort}/auth/login`);

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByLabel("Tienda")).toHaveCount(0);
  await expect(page.getByLabel("Organization ID")).toHaveCount(0);
  await expect(page.getByLabel("Shop ID")).toHaveCount(0);

  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Entrar con BFF Auth" }).click();
  await page.waitForURL(`http://127.0.0.1:${nextPort}/admin`);

  expect(capturedLoginPayloads.at(-1)).toEqual({
    email: "admin@example.com",
    password: "secret123",
    scope: "admin",
  });
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("organizationId");
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("shopId");
  expect(capturedLoginPayloads.at(-1)).not.toHaveProperty("shopAlias");
});

test("product editor rehydrates persisted draft media through BFF only", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await expect(page.getByRole("button", { name: "Imagenes" })).toBeVisible();
  await page.getByRole("button", { name: "Imagenes" }).click();

  await expect(page.getByText("1 imagen(es) recuperada(s) del borrador remoto.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Imagen principal remota Portada Subida/ })).toBeVisible();

  expect(capturedDraftStateRequests).toHaveLength(1);
  expect(capturedDraftStateRequests[0]).toMatch(/^\/api\/v1\/admin\/product-drafts\/.+/);
  expect(capturedBffRequests.every((item) => item.includes(" /api/v1/"))).toBe(true);
  expect(browserExternalRequests).toEqual([]);
});

test("product editor sends removed persisted media in draft without binary files", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await expect(page.getByText("1 imagen(es) recuperada(s) del borrador remoto.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Imagen principal remota Portada Subida/ })).toBeVisible();
  const remoteTile = page.locator(".productMediaTile").filter({ has: page.getByRole("button", { name: /Imagen principal remota Portada Subida/ }) });
  await remoteTile.locator('button[aria-label^="Eliminar"]').click();
  await expect(page.getByText("Imagen principal remota")).toHaveCount(0);

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre del producto").fill("Producto Con Media Eliminada");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  const draft = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0], "draft"));
  expect(draft.media.items).toHaveLength(0);
  expect(draft.media.removedItems).toHaveLength(1);
  expect(draft.media.removedItems[0].mediaAssetId).toBe("asset-remote-1");
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
});

test("product editor uploads selected media immediately to draft endpoint", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Imagen subida por Playwright Subida/ })).toBeVisible();
  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(2);

  expect(capturedDraftMediaUploadRequests).toHaveLength(1);
  expect(capturedDraftMediaUploadRequests[0]).toMatch(/^\/api\/v1\/admin\/product-drafts\/.+\/media$/);
  expect(capturedSaveOperationRequests).toHaveLength(0);
});

test("product editor sends matching idempotency key for draft media upload", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedDraftMediaUploadIdempotencyKeys.length = 0;
  capturedDraftMediaUploadBodies.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect.poll(() => capturedDraftMediaUploadRequests.length).toBe(1);

  const headerKey = capturedDraftMediaUploadIdempotencyKeys[0];
  const bodyKey = parseMultipartTextField(capturedDraftMediaUploadBodies[0], "idempotencyKey");
  expect(headerKey).toBeTruthy();
  expect(bodyKey).toBe(headerKey);
  expect(capturedDraftMediaUploadBodies[0]).toContain('name="file"');
  expect(capturedDraftMediaUploadBodies[0]).toContain('name="fileLocalId"');
  expect(capturedDraftMediaUploadBodies[0]).toContain('name="metadata"');
  expect(capturedDraftMediaUploadBodies[0]).toContain('filename="playwright-cover.png"');
});

test("product editor keeps the same client draft id for draft state and media upload", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedDraftMediaUploadRequests.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await expect(page.getByText("1 imagen(es) recuperada(s) del borrador remoto.")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();

  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(2);
  expect(capturedDraftMediaUploadRequests).toHaveLength(1);
  const draftStateIds = capturedDraftStateRequests.map(draftIdFromProductDraftPath);
  const draftStateId = draftStateIds[0];
  const uploadDraftId = draftIdFromProductDraftPath(capturedDraftMediaUploadRequests[0]);
  expect(draftStateId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(uploadDraftId).toBe(draftStateId);
  expect(draftStateIds.every((id) => id === uploadDraftId)).toBe(true);
});

test("product editor restores local draft with the original client draft id after reload", async ({ page }) => {
  capturedDraftStateRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Restaurable");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(1);
  const originalDraftId = draftIdFromProductDraftPath(capturedDraftStateRequests[0]);
  expect(originalDraftId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBeGreaterThan(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();

  await expect(page.getByText("Hay un borrador local guardado para esta ficha.")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar borrador" }).click();

  await expect(page.getByLabel("Nombre del producto")).toHaveValue("Producto Restaurable");
  await expect(page.getByLabel("Categoria principal", { exact: true })).toHaveValue("category-bikes");
  await expect.poll(() =>
    capturedDraftStateRequests.map(draftIdFromProductDraftPath).filter((id) => id === originalDraftId).length
  ).toBeGreaterThanOrEqual(2);
});

test("product editor discards local draft and does not reuse discarded client draft id", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedDraftMediaUploadRequests.length = 0;
  draftMediaUploadMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Descartable");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await expect.poll(() => capturedDraftStateRequests.length).toBeGreaterThanOrEqual(1);
  const discardedDraftId = draftIdFromProductDraftPath(capturedDraftStateRequests[0]);
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBeGreaterThan(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();

  await expect(page.getByText("Hay un borrador local guardado para esta ficha.")).toBeVisible();
  await page.getByRole("button", { name: "Descartar borrador" }).click();
  await expect(page.getByText("Hay un borrador local guardado para esta ficha.")).toHaveCount(0);
  await expect(page.getByLabel("Nombre del producto")).toHaveValue("");
  await expect(page.getByLabel("Categoria principal", { exact: true })).toHaveValue("");
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBe(0);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect.poll(() => capturedDraftMediaUploadRequests.length).toBe(1);
  const uploadDraftId = draftIdFromProductDraftPath(capturedDraftMediaUploadRequests[0]);
  expect(uploadDraftId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(uploadDraftId).not.toBe(discardedDraftId);
});

test("product editor saves uploaded media as references without rebundling files", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  draftMediaUploadMode = "success";
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Imagen subida por Playwright Subida/ })).toBeVisible();

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre del producto").fill("Producto Con Media Referenciada");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  const draft = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0], "draft"));
  expect(draft.media.items.some((item: { mediaAssetId?: string }) =>
    item.mediaAssetId === "asset-uploaded-playwright"
  )).toBe(true);
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
});

test("product editor sends the media draft identity in the save operation", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  draftMediaUploadMode = "success";
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("1 imagen(es) subida(s) al borrador.")).toBeVisible();
  await expect.poll(() => capturedDraftMediaUploadRequests.length).toBe(1);
  const uploadDraftId = draftIdFromProductDraftPath(capturedDraftMediaUploadRequests[0]);

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre del producto").fill("Producto Con Identidad De Media");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  const draft = JSON.parse(parseMultipartTextField(capturedSaveOperationBodies[0], "draft"));
  expect(draft.clientDraftId).toBe(uploadDraftId);
  expect(draft.productId).toBe("product-draft-remote");
  expect(draft.mediaCollectionId).toBe("collection-remote");
  expect(draft.media.items.some((item: { mediaAssetId?: string }) =>
    item.mediaAssetId === "asset-uploaded-playwright"
  )).toBe(true);
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
});

test("product editor keeps failed draft media local without saving product", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  draftMediaUploadMode = "failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-broken-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("0/1 imagen(es) subidas. Revisa las marcadas con error.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Media temporal no disponible\./ })).toBeVisible();
  await expect(page.getByText("media: Fallo")).toBeVisible();

  expect(capturedDraftMediaUploadRequests).toHaveLength(1);
  expect(capturedSaveOperationRequests).toHaveLength(0);
  draftMediaUploadMode = "success";
});

test("product editor does not bundle failed media files into product save operation", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationBodies.length = 0;
  draftMediaUploadMode = "failed";
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-broken-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("0/1 imagen(es) subidas. Revisa las marcadas con error.")).toBeVisible();

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Nombre del producto").fill("Producto Sin Binario Reenviado");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  expect(capturedSaveOperationBodies).toHaveLength(1);
  expect(capturedSaveOperationBodies[0]).toContain('name="draft"');
  expect(capturedSaveOperationBodies[0]).toContain('name="idempotencyKey"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="files"');
  expect(capturedSaveOperationBodies[0]).not.toContain('name="fileLocalIds"');
  draftMediaUploadMode = "success";
});

test("product editor clears failed media state after removing failed upload", async ({ page }) => {
  capturedDraftMediaUploadRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  draftMediaUploadMode = "failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Imagenes" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-broken-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(onePixelPngDataUrl.split(",")[1], "base64"),
  });

  await expect(page.getByText("media: Fallo")).toBeVisible();
  const failedTile = page.locator(".productMediaTile").filter({ hasText: "Media temporal no disponible." });
  await expect(failedTile).toHaveCount(1);
  await failedTile.locator('button[aria-label^="Eliminar"]').click();

  await expect(page.getByText("Media temporal no disponible.")).toHaveCount(0);
  await expect(page.getByText("media: Correcto")).toBeVisible();
  expect(capturedSaveOperationRequests).toHaveLength(0);
  draftMediaUploadMode = "success";
});

test("product editor blocks incomplete save before product-save operation", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);
  await expect(page.getByRole("button", { name: "Guardar producto" })).toBeVisible();

  const saveRequestsBefore = capturedBffRequests.filter((item) =>
    item === "POST /api/v1/admin/product-save-operations"
  ).length;

  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText(/No se guardo\. Revisa:/)).toBeVisible();
  await expect(page.getByText("Revisar campos obligatorios")).toBeVisible();
  await expect(page.getByText(/Nombre:/)).toBeVisible();
  await expect(page.getByText(/Categoria principal:/)).toBeVisible();

  const saveRequestsAfter = capturedBffRequests.filter((item) =>
    item === "POST /api/v1/admin/product-save-operations"
  ).length;
  expect(saveRequestsAfter).toBe(saveRequestsBefore);
});

test("product editor blocks publish locally when commercial minimums are missing", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Activo Incompleto");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByLabel("Activo").focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Activo")).toBeChecked();
  await expect(page.getByText("Para activar el producto faltan datos comerciales minimos.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText(/No se guardo\. Revisa:/)).toBeVisible();
  await expect(page.getByText("No se puede activar todavia.", { exact: true })).toBeVisible();
  await expect(page.getByText("Falta un precio base mayor que cero.", { exact: true })).toBeVisible();
  await expect(page.getByText("Falta stock disponible en default o en una combinacion vendible.", { exact: true })).toBeVisible();
  await expect(page.getByText("publish: Bloqueado")).toBeVisible();
  await expect(page.getByText("Revisar publicacion")).toBeVisible();

  expect(capturedSaveOperationRequests).toHaveLength(0);
});

test("product editor publishes through save operation when commercial minimums are complete", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  saveOperationMode = "published";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Publicable");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");

  await page.getByRole("button", { name: "Precio" }).click();
  await page.getByLabel("Precio del producto / defaultVariant").fill("49.90");
  await page.getByRole("combobox", { name: /Impuesto/ }).selectOption("tax-standard");

  await page.getByRole("button", { name: "Inventario" }).click();
  await page.getByLabel("On hand default").fill("7");

  await page.getByRole("button", { name: "Ajustes basicos" }).click();
  await page.getByLabel("Activo").focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Activo")).toBeChecked();
  await expect(page.getByText("Producto listo para activarse.")).toBeVisible();

  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Producto publicado.")).toBeVisible();
  await expect(page.getByText("pricing: Correcto")).toBeVisible();
  await expect(page.getByText("inventory: Correcto")).toBeVisible();
  await expect(page.getByText("publish: Correcto")).toBeVisible();
  await expect(page.getByText("Revisar publicacion")).toHaveCount(0);

  expect(capturedSaveOperationRequests).toHaveLength(1);
});

test("product editor shows BFF recovery actions after partial save failure", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  saveOperationMode = "partial_failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Playwright");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
  await expect(page.getByText("Reintentar precio").first()).toBeVisible();
  await expect(page.getByText("pricing: Fallo")).toBeVisible();

  expect(capturedSaveOperationRequests).toHaveLength(1);
});

test("product editor reuses idempotency key when retrying a partial save", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationIdempotencyKeys.length = 0;
  capturedSaveOperationBodies.length = 0;
  saveOperationMode = "partial_failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Retry Playwright");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");

  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
  await expect(page.getByText("Reintentar precio").first()).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(2);
  await expect(page.getByText("pricing: Fallo")).toBeVisible();

  expect(capturedSaveOperationIdempotencyKeys).toHaveLength(2);
  expect(capturedSaveOperationIdempotencyKeys[0]).toBeTruthy();
  expect(capturedSaveOperationIdempotencyKeys[1]).toBe(capturedSaveOperationIdempotencyKeys[0]);
  expect(parseMultipartTextField(capturedSaveOperationBodies[0], "idempotencyKey"))
    .toBe(capturedSaveOperationIdempotencyKeys[0]);
  expect(parseMultipartTextField(capturedSaveOperationBodies[1], "idempotencyKey"))
    .toBe(capturedSaveOperationIdempotencyKeys[0]);
});

test("product editor clears idempotency key after a successful retry", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  capturedSaveOperationIdempotencyKeys.length = 0;
  saveOperationMode = "partial_failed";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Retry Exitoso");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");

  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.getByText("Precio pendiente de guardar.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(1);

  saveOperationMode = "success";
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(2);

  await page.getByLabel("Nombre del producto").fill("Producto Retry Exitoso Editado");
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect.poll(() => capturedSaveOperationRequests.length).toBe(3);

  expect(capturedSaveOperationIdempotencyKeys).toHaveLength(3);
  expect(capturedSaveOperationIdempotencyKeys[1]).toBe(capturedSaveOperationIdempotencyKeys[0]);
  expect(capturedSaveOperationIdempotencyKeys[2]).toBeTruthy();
  expect(capturedSaveOperationIdempotencyKeys[2]).not.toBe(capturedSaveOperationIdempotencyKeys[0]);
});

test("product editor applies successful save patch and clears local draft", async ({ page }) => {
  capturedSaveOperationRequests.length = 0;
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto Guardado");
  await page.getByLabel("Categoria principal", { exact: true }).selectOption("category-bikes");
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect(page.getByText("catalog: Correcto")).toBeVisible();
  await expect(page.getByText("pricing: Sin cambios")).toBeVisible();
  await expect(page.getByText("Reintentar precio")).toHaveCount(0);
  await expect.poll(async () =>
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("ecommium-product-draft:")).length
    )
  ).toBe(0);

  expect(capturedSaveOperationRequests).toHaveLength(1);
});

test("product editor loads existing product state and saves through operation endpoint", async ({ page }) => {
  capturedEditorStateRequests.length = 0;
  capturedDraftStateRequests.length = 0;
  capturedSaveOperationRequests.length = 0;
  saveOperationMode = "success";

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await expect(page.getByLabel("Nombre del producto")).toHaveValue("Producto existente Playwright");
  await expect(page.getByLabel("Categoria principal", { exact: true })).toHaveValue("category-bikes");
  await expect(page.getByRole("button", { name: "Imagenes" })).toBeVisible();
  await page.getByRole("button", { name: "Imagenes" }).click();
  await expect(page.getByRole("button", { name: /Imagen producto existente Portada Subida/ })).toBeVisible();

  await page.getByLabel("Nombre del producto").fill("Producto existente actualizado");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByText("Producto guardado.")).toBeVisible();
  await expect(page.getByText("catalog: Correcto")).toBeVisible();

  expect(capturedEditorStateRequests).toEqual(["/api/v1/admin/products/product-edit-1/editor-state"]);
  expect(capturedDraftStateRequests).toEqual(["/api/v1/admin/product-drafts/product-edit-1"]);
  expect(capturedSaveOperationRequests).toHaveLength(1);
  expect(capturedBffRequests).not.toContain("PATCH /api/v1/admin/products/product-edit-1");
  expect(capturedBffRequests).not.toContain("POST /api/v1/admin/prices");
});
