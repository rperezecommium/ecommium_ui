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
const capturedPricingPreviewRequests: string[] = [];
const capturedPricingGovernanceRequests: string[] = [];
const capturedCatalogSpecificationRequests: string[] = [];
const capturedPricingMutations: Array<{
  method: string;
  path: string;
  body: Record<string, unknown>;
}> = [];
const capturedMediaAssetContentRequests: string[] = [];
let saveOperationMode: "partial_failed" | "success" | "published" = "partial_failed";
let draftMediaUploadMode: "success" | "failed" = "success";
const pricingTaxes = [{
  taxId: "tax-standard",
  taxCode: "standard",
  name: "IVA general",
  calculationType: "PERCENTAGE",
  rate: 0.21,
  isActive: true,
}, {
  taxId: "tax-default-iva",
  taxCode: "default-iva",
  name: "Default IVA",
  calculationType: "PERCENTAGE",
  rate: 0.1,
  country: "ES",
  isActive: true,
}];
const pricingPriceTables = [{
  priceTableId: "base",
  name: "Base",
  active: true,
  currency: "EUR",
}, {
  priceTableId: "cockpit-vip",
  name: "Cockpit VIP",
  active: true,
  currency: "EUR",
}, {
  priceTableId: "vip-table",
  name: "VIP table",
  active: true,
  currency: "EUR",
}];
const pricingReferenceState: Record<string, Array<{
  code: string;
  name: string;
  helpText: string;
  active: boolean;
}>> = {
  "customer-groups": [{
    code: "vip",
    name: "VIP",
    helpText: "Segmento comercial usado para reglas de precio especifico.",
    active: true,
  }],
  channels: [{
    code: "web",
    name: "Web",
    helpText: "Canal de venta web.",
    active: true,
  }, {
    code: "marketplace",
    name: "Marketplace",
    helpText: "Canal de venta marketplace.",
    active: true,
  }],
  "trade-policies": [{
    code: "default",
    name: "Default",
    helpText: "Politica comercial base.",
    active: true,
  }],
  countries: [{
    code: "ES",
    name: "Espana",
    helpText: "Mercado Espana.",
    active: true,
  }],
};
const catalogSpecificationGroups = [{
  specificationGroupId: "spec-group-technical",
  categoryId: "category-bikes",
  name: "Ficha tecnica",
  isActive: true,
  fieldCount: 2,
  linkedCategoryIds: ["category-bikes"],
  fields: [{
    fieldId: "field-composition",
    specificationGroupId: "spec-group-technical",
    fieldTypeId: 1,
    name: "Composicion",
    description: "Composicion",
    position: 1,
    isFilter: true,
    isRequired: false,
    isOnProductDetails: true,
    isStockKeepingUnit: false,
    isActive: true,
    isTopMenuLinkActive: false,
    isSideMenuLinkActive: false,
    defaultValue: null,
    values: [{
      fieldValueId: "value-aluminium",
      fieldId: "field-composition",
      name: "Aluminio",
      text: null,
      isActive: true,
      position: 1,
    }],
  }, {
    fieldId: "field-color",
    specificationGroupId: "spec-group-technical",
    fieldTypeId: 1,
    name: "Color",
    description: "Color",
    position: 2,
    isFilter: true,
    isRequired: false,
    isOnProductDetails: true,
    isStockKeepingUnit: true,
    isActive: true,
    isTopMenuLinkActive: false,
    isSideMenuLinkActive: false,
    defaultValue: null,
    values: [{
      fieldValueId: "value-red",
      fieldId: "field-color",
      name: "Rojo",
      text: null,
      isActive: true,
      position: 1,
    }],
  }],
}];
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

function assertPricingTenant(url: URL) {
  expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
  expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
}

function upsertReference(
  rows: Array<{ code: string; name: string; helpText: string; active: boolean }>,
  body: Record<string, unknown>,
) {
  const code = typeof body.code === "string" ? body.code : "";
  const next = {
    code,
    name: typeof body.name === "string" ? body.name : code,
    helpText: typeof body.helpText === "string" ? body.helpText : "",
    active: typeof body.active === "boolean" ? body.active : true,
  };
  const index = rows.findIndex((item) => item.code === code);
  if (index >= 0) {
    rows[index] = next;
  } else {
    rows.push(next);
  }

  return next;
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

    if (request.method === "GET" && url.pathname === "/api/v1/admin/specifications/groups") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      capturedCatalogSpecificationRequests.push("GET /api/v1/admin/specifications/groups");
      sendJson(response, 200, {
        items: catalogSpecificationGroups.map((group) => ({
          specificationGroupId: group.specificationGroupId,
          categoryId: group.categoryId,
          name: group.name,
          isActive: group.isActive,
          fieldCount: group.fields.length,
        })),
        total: catalogSpecificationGroups.length,
      });
      return;
    }

    const specificationGroupMatch = url.pathname.match(/^\/api\/v1\/admin\/specifications\/groups\/([^/]+)$/);
    if (specificationGroupMatch && request.method === "GET") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const groupId = decodeURIComponent(specificationGroupMatch[1]);
      capturedCatalogSpecificationRequests.push(`GET /api/v1/admin/specifications/groups/${groupId}`);
      sendJson(response, 200, catalogSpecificationGroups.find((group) => group.specificationGroupId === groupId) ?? catalogSpecificationGroups[0]);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/specifications/groups") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const body = await readJsonBody(request);
      capturedCatalogSpecificationRequests.push("POST /api/v1/admin/specifications/groups");
      const fields = Array.isArray(body.fields) ? body.fields as Array<Record<string, unknown>> : [];
      const group = {
        specificationGroupId: "spec-group-playwright",
        categoryId: String(body.categoryId ?? "category-bikes"),
        name: String(body.name ?? "Playwright group"),
        isActive: true,
        fieldCount: fields.length,
        linkedCategoryIds: ["category-bikes"],
        fields: fields.map((field, index) => ({
          ...field,
          fieldId: `field-playwright-${index}`,
          specificationGroupId: "spec-group-playwright",
          values: Array.isArray(field.values)
            ? field.values.map((value, valueIndex) => ({
                ...(value as Record<string, unknown>),
                fieldValueId: `value-playwright-${valueIndex}`,
                fieldId: `field-playwright-${index}`,
              }))
            : [],
        })),
      };
      catalogSpecificationGroups.push(group as typeof catalogSpecificationGroups[number]);
      sendJson(response, 200, group);
      return;
    }

    if (specificationGroupMatch && request.method === "PATCH") {
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      const groupId = decodeURIComponent(specificationGroupMatch[1]);
      const body = await readJsonBody(request);
      capturedCatalogSpecificationRequests.push(`PATCH /api/v1/admin/specifications/groups/${groupId}`);
      const groupIndex = catalogSpecificationGroups.findIndex((group) => group.specificationGroupId === groupId);
      const currentGroup = catalogSpecificationGroups[groupIndex] ?? catalogSpecificationGroups[0];
      const fields = Array.isArray(body.fields) ? body.fields as Array<Record<string, unknown>> : [];
      const nextGroup = {
        ...currentGroup,
        categoryId: String(body.categoryId ?? currentGroup.categoryId),
        name: String(body.name ?? currentGroup.name),
        isActive: typeof body.isActive === "boolean" ? body.isActive : currentGroup.isActive,
        fieldCount: fields.length,
        linkedCategoryIds: Array.isArray(body.linkedCategoryIds) ? body.linkedCategoryIds.map(String) : currentGroup.linkedCategoryIds,
        fields: fields.map((field, index) => {
          const existingField = currentGroup.fields.find((item) => item.fieldId === field.fieldId);
          return {
            ...existingField,
            ...field,
            fieldId: String(field.fieldId ?? existingField?.fieldId ?? `field-playwright-${index}`),
            specificationGroupId: groupId,
            values: Array.isArray(field.values)
              ? field.values.map((value, valueIndex) => ({
                  ...(value as Record<string, unknown>),
                  fieldValueId: String((value as Record<string, unknown>).fieldValueId ?? `value-playwright-${valueIndex}`),
                  fieldId: String(field.fieldId ?? existingField?.fieldId ?? `field-playwright-${index}`),
                }))
              : [],
          };
        }),
      };
      if (groupIndex >= 0) {
        catalogSpecificationGroups[groupIndex] = nextGroup as typeof catalogSpecificationGroups[number];
      }
      sendJson(response, 200, nextGroup);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/taxes") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, { items: pricingTaxes });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/pricing/taxes") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      const taxCode = typeof body.code === "string" ? body.code : "tax-playwright";
      const next = {
        taxId: `tax-${taxCode}`,
        taxCode,
        name: typeof body.name === "string" ? body.name : taxCode,
        calculationType: typeof body.calculationType === "string" ? body.calculationType : "PERCENTAGE",
        rate: typeof body.rate === "number" ? body.rate : null,
        country: typeof body.country === "string" ? body.country : "ES",
        isActive: body.active !== false,
      };
      const index = pricingTaxes.findIndex((item) => item.taxCode === taxCode);
      if (index >= 0) {
        pricingTaxes[index] = next;
      } else {
        pricingTaxes.push(next);
      }
      sendJson(response, 200, next);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/price-tables") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, { items: pricingPriceTables });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/pricing/price-tables") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      const priceTableId = typeof body.code === "string" ? body.code : "table-playwright";
      const next = {
        priceTableId,
        name: typeof body.name === "string" ? body.name : priceTableId,
        active: body.active !== false,
        currency: typeof body.currency === "string" ? body.currency : "EUR",
      };
      const index = pricingPriceTables.findIndex((item) => item.priceTableId === priceTableId);
      if (index >= 0) {
        pricingPriceTables[index] = next;
      } else {
        pricingPriceTables.push(next);
      }
      sendJson(response, 200, next);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/config") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, {
        pricingMode: "governed",
        currency: "EUR",
        country: "ES",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/migration") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, {
        status: "ready",
        referenceData: true,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/pipeline/catalog") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, {
        items: [{ priceTableId: "vip-table", active: true, status: "ready" }],
      });
      return;
    }

    const fixedPriceMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/prices\/([^/]+)\/fixed$/);
    if (fixedPriceMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const itemId = decodeURIComponent(fixedPriceMatch[1]);
      sendJson(response, 200, {
        items: itemId === "variant-computed-auto"
          ? [{
              productId: "product-computed-auto",
              variantId: "variant-computed-auto",
              priceTableId: "vip-table",
              fixedPrice: { amountMinor: 9300, currency: "EUR" },
              basePrice: { amountMinor: 9300, currency: "EUR" },
              listPrice: { amountMinor: 10900, currency: "EUR" },
              taxIncluded: true,
              active: true,
            }]
          : [],
      });
      return;
    }

    const computedAutoMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/prices\/([^/]+)\/computed-auto$/);
    if (computedAutoMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const itemId = decodeURIComponent(computedAutoMatch[1]);
      expect(itemId).toBe("variant-computed-auto");
      sendJson(response, 200, {
        itemId,
        priceTableId: "vip-table",
        netMinor: 7686,
        taxMinor: 1614,
        grossMinor: 9300,
        currency: "EUR",
        source: "FIXED_PRICE",
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/admin/pricing/prices/computed-auto/resolve-batch") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      expect(body).toEqual({ itemIds: ["variant-computed-auto"] });
      sendJson(response, 200, {
        items: [{
          itemId: "variant-computed-auto",
          priceTableId: "vip-table",
          netMinor: 7686,
          taxMinor: 1614,
          grossMinor: 9300,
          currency: "EUR",
          source: "FIXED_PRICE",
        }],
      });
      return;
    }

    const pricingReferenceMatch = url.pathname.match(/^\/api\/v1\/admin\/pricing\/(customer-groups|channels|trade-policies|countries)$/);
    if (pricingReferenceMatch && request.method === "GET") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      sendJson(response, 200, { items: pricingReferenceState[pricingReferenceMatch[1]] });
      return;
    }

    if (pricingReferenceMatch && request.method === "POST") {
      capturedPricingGovernanceRequests.push(`${request.method} ${url.pathname}`);
      assertPricingTenant(url);
      const body = await readJsonBody(request);
      capturedPricingMutations.push({ method: "POST", path: url.pathname, body });
      sendJson(response, 200, upsertReference(pricingReferenceState[pricingReferenceMatch[1]], body));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/admin/pricing/preview") {
      capturedPricingPreviewRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("productId")).toBe("product-edit-1");
      expect(url.searchParams.get("defaultVariantId")).toBe("variant-edit-default");
      expect(url.searchParams.get("currency")).toBe("EUR");
      expect(url.searchParams.get("country")).toBe("ES");
      expect(url.searchParams.get("tradePolicy")).toBe("default");
      expect(url.searchParams.get("channel")).toBe("web");
      expect(url.searchParams.get("priceTableId")).toBe("cockpit-vip");
      expect(url.searchParams.get("quantity")).toBe("3");
      sendJson(response, 200, {
        ok: true,
        status: "APPLIED",
        reason: null,
        requested: {
          productId: "product-edit-1",
          variantId: null,
          defaultVariantId: "variant-edit-default",
          currency: "EUR",
          country: "ES",
          tradePolicy: "default",
          channel: "web",
          customerGroup: null,
          priceTableId: "cockpit-vip",
          quantity: 3,
          at: null,
        },
        resolution: {
          source: "PRODUCT",
          usedFallback: false,
        },
        price: {
          pricingId: "pricing-preview-cockpit-vip",
          targetType: "PRODUCT",
          productId: "product-edit-1",
          variantId: null,
          priceTableId: "cockpit-vip",
          tradePolicy: "default",
          channel: "web",
          customerGroup: null,
          country: "ES",
          currency: "EUR",
          basePrice: { currency: "EUR", amountMinor: 129900 },
          listPrice: null,
          fixedPrice: { currency: "EUR", amountMinor: 9500 },
          tiers: [{ minQuantity: 3, price: { currency: "EUR", amountMinor: 9500 } }],
          taxIncluded: true,
          active: true,
          priority: 100,
          source: "FIXED",
          resolved: {
            currency: "EUR",
            netAmountMinor: 7851,
            taxAmountMinor: 1649,
            grossAmountMinor: 9500,
            taxIncluded: true,
          },
        },
        conditions: [
          { key: "priceTableId", requested: "cockpit-vip", matched: "cockpit-vip", status: "MATCH" },
          { key: "minQuantity", requested: 3, matched: 3, status: "MATCH" },
        ],
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
        }, {
          variantId: "variant-edit-red",
          name: "Producto existente Playwright rojo",
          refId: "PEP-RED",
          ean: "8430000000002",
          isActive: true,
          isVisible: true,
          isDefault: false,
        }, {
          variantId: "variant-edit-green",
          name: "Producto existente Playwright verde",
          refId: "PEP-GREEN",
          ean: "8430000000003",
          isActive: true,
          isVisible: true,
          isDefault: false,
        }],
        variantOptions: {
          "variant-edit-red": [{
            variantOptionId: "option-red",
            attributeCode: "color",
            valueCode: "rojo",
            isActive: true,
          }],
          "variant-edit-green": [{
            variantOptionId: "option-green",
            attributeCode: "color",
            valueCode: "verde",
            isActive: true,
          }],
        },
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
          variants: [{
            pricingId: "pricing-edit-green",
            targetType: "VARIANT",
            productId: "product-edit-1",
            variantId: "variant-edit-green",
            basePriceMinor: 9900,
            currency: "EUR",
            taxIncluded: true,
            taxCode: "standard",
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
          }, {
            variantId: "variant-edit-red",
            warehouseId: "main-warehouse",
            onHandQuantity: 0,
            reservedQuantity: 0,
            safetyStockQuantity: 0,
            availableQuantity: 0,
            available: false,
          }, {
            variantId: "variant-edit-green",
            warehouseId: "main-warehouse",
            onHandQuantity: 4,
            reservedQuantity: 0,
            safetyStockQuantity: 0,
            availableQuantity: 4,
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
        }, {
          variantId: "variant-edit-red",
          offerings: [],
        }, {
          variantId: "variant-edit-green",
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
          previewUrl: "22222222-2222-4222-8222-222222222222/media-product-edit-1/asset-edit-1/original.png",
          thumbnailUrl: null,
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

    if (request.method === "GET" && /^\/api\/v1\/admin\/media\/assets\/[^/]+\/content$/.test(url.pathname)) {
      capturedMediaAssetContentRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("organizationId")).toBe(defaultOrganizationId);
      expect(url.searchParams.get("shopId")).toBe(barcelonaShopId);
      expect(url.searchParams.get("variant")).toBe("medium_default");
      const imageBuffer = Buffer.from(onePixelPngDataUrl.split(",")[1], "base64");
      response.writeHead(200, {
        "content-type": "image/png",
        "content-length": String(imageBuffer.byteLength),
      });
      response.end(imageBuffer);
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

test("catalog attributes and features page filters and creates feature values through BFF", async ({ page }) => {
  capturedCatalogSpecificationRequests.length = 0;
  const existingIndex = catalogSpecificationGroups.findIndex((group) => group.specificationGroupId === "spec-group-playwright");
  if (existingIndex >= 0) {
    catalogSpecificationGroups.splice(existingIndex, 1);
  }
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/catalogo/atributos-caracteristicas?tab=features`);

  await expect(page.getByRole("heading", { name: "Caracteristicas Tecnicas", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Atributos", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "ID" })).toBeVisible();
  await expect(page.getByLabel("Filtrar por ID superior")).toBeVisible();
  await expect(page.getByLabel("Filtrar por nombre superior")).toBeVisible();
  await expect(page.getByLabel("Filtrar por grupo superior")).toBeVisible();
  await expect(page.getByLabel("Filtrar por ID", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filtrar por nombre", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filtrar por grupo", { exact: true })).toHaveCount(0);

  const filterForm = page.getByRole("form", { name: "Filtros superiores" });
  await expect(filterForm).toHaveCSS("flex-direction", "row");
  await expect(filterForm).toHaveCSS("flex-wrap", "nowrap");
  await filterForm.getByLabel("Filtrar por nombre superior").fill("Composicion");
  await filterForm.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/q=Composicion/);
  await expect(page.getByRole("row", { name: /field-co.*Composicion.*Ficha tecnica/ })).toBeVisible();

  await page.getByRole("link", { name: "Limpiar" }).click();
  await expect(page).toHaveURL(/tab=features/);

  await page.getByRole("link", { name: "Crear caracteristica" }).click();
  await expect(page).toHaveURL(/panel=create/);
  await expect(page.getByRole("dialog", { name: "Crear caracteristica" })).toBeVisible();
  await expect(page.locator(".adminFeatureDrawerHeader")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".adminFeatureDrawerHeader")).toHaveCSS("color", "rgb(54, 58, 65)");
  await expect(page.locator(".adminFeatureDrawerBackdrop")).toBeVisible();
  await expect(page.locator(".adminFeatureContent")).toHaveCSS("filter", /blur\(2px\)/);
  const createForm = page.getByRole("form", { name: "Crear caracteristica" });
  await createForm.locator('select[name="groupId"]').selectOption("");
  await createForm.locator('input[name="groupName"]').fill("Playwright specs");
  await createForm.locator('select[name="categoryId"]').selectOption("category-bikes");
  await createForm.locator('input[name="name"]').fill("Material Playwright");
  await createForm.locator('input[name="values"]').fill("Carbono, Aluminio");
  await createForm.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/tab=features$/);
  await expect(page.getByRole("dialog", { name: "Crear caracteristica" })).toHaveCount(0);

  const createdRow = page.getByRole("row", { name: /field-pl.*Material Playwright.*Playwright specs/ });
  await expect(createdRow).toBeVisible();
  await expect(createdRow.getByText("Carbono")).toBeVisible();
  await expect(createdRow.getByText("Aluminio")).toBeVisible();
  await expect(createdRow.getByRole("link", { name: "Editar Material Playwright" })).toBeVisible();
  await expect(createdRow.getByRole("button", { name: "Eliminar Material Playwright" })).toBeVisible();
  await createdRow.getByRole("button", { name: "Quitar valor Carbono" }).click();
  await expect.poll(() => capturedCatalogSpecificationRequests).toContain("PATCH /api/v1/admin/specifications/groups/spec-group-playwright");
  const updatedRow = page.getByRole("row", { name: /field-pl.*Material Playwright.*Playwright specs/ });
  await expect(updatedRow.getByText("Carbono")).toHaveCount(0);
  await expect(updatedRow.getByText("Aluminio")).toBeVisible();
  await updatedRow.getByRole("link", { name: "Editar Material Playwright" }).click();
  await expect(page).toHaveURL(/panel=edit/);
  await expect(page.getByRole("dialog", { name: /Editar Caracteristica: field-pl/ })).toBeVisible();
  await expect(page.getByRole("form", { name: "Editar Material Playwright" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Anadir valor Material Playwright" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Editar Material Playwright" }).locator('input[name="name"]')).toHaveCSS("height", "40px");
  await expect(page.getByLabel("Nuevo valor Material Playwright")).toHaveCSS("height", "40px");
  await expect(page.getByLabel("Nuevo valor Material Playwright")).toHaveCSS("border-radius", "4px");
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar caracteristica" })).toBeVisible();
  expect(capturedCatalogSpecificationRequests).toContain("GET /api/v1/admin/specifications/groups");
  expect(capturedCatalogSpecificationRequests).toContain("POST /api/v1/admin/specifications/groups");
  expect(browserExternalRequests).toEqual([]);
});

test("pricing configuration exposes master data and creates customer groups through BFF", async ({ page }) => {
  capturedPricingGovernanceRequests.length = 0;
  capturedPricingMutations.length = 0;
  pricingReferenceState["customer-groups"] = pricingReferenceState["customer-groups"].filter((item) =>
    item.code !== "playwright-vip"
  );
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=references`);

  await expect(page.getByRole("heading", { name: "Configuracion de precios" })).toBeVisible();
  await expect(page.getByText("Admin / Configuracion / Precios")).toBeVisible();
  await expect(page.getByRole("link", { name: "Parametros" })).toHaveClass(/productEditorTabActive/);
  await expect(page.getByRole("heading", { name: "Grupos de cliente", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Canales", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Politicas comerciales", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paises", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /vip VIP/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /web Web/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /default Default/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /ES Espana/ })).toBeVisible();

  const customerGroupPanel = page.locator("section.pricingPanel").filter({
    has: page.getByRole("heading", { name: "Grupos de cliente", exact: true }),
  }).first();
  await customerGroupPanel.getByLabel("Codigo").fill("playwright-vip");
  await customerGroupPanel.getByLabel("Nombre").fill("Playwright VIP");
  await customerGroupPanel.getByLabel("Ayuda").fill("Grupo creado desde Playwright.");
  await customerGroupPanel.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Parametro guardado.")).toBeVisible();
  await expect(page.getByRole("row", { name: /playwright-vip Playwright VIP/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Impuestos" })).toBeVisible();
  await page.getByRole("link", { name: "Impuestos" }).click();
  await expect(page.getByRole("row", { name: /default-iva Default IVA/ })).toBeVisible();
  await page.getByRole("link", { name: "Price tables" }).click();
  await expect(page.getByRole("row", { name: /vip-table VIP table/ })).toBeVisible();

  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/customer-groups");
  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/channels");
  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/trade-policies");
  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/countries");
  expect(capturedPricingMutations).toContainEqual({
    method: "POST",
    path: "/api/v1/admin/pricing/customer-groups",
    body: {
      code: "playwright-vip",
      name: "Playwright VIP",
      helpText: "Grupo creado desde Playwright.",
      active: true,
    },
  });
  expect(browserExternalRequests).toEqual([]);
});

test("pricing configuration resolves computed auto prices through BFF", async ({ page }) => {
  capturedPricingGovernanceRequests.length = 0;
  capturedPricingMutations.length = 0;
  const browserExternalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.port && Number(url.port) !== nextPort) {
      browserExternalRequests.push(request.url());
    }
  });

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/configuracion/precios?tab=computed-auto&itemId=variant-computed-auto`);

  await expect(page.getByRole("heading", { name: "Configuracion de precios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Computed auto" })).toHaveClass(/productEditorTabActive/);
  const itemPanel = page.locator("section.pricingPanel").filter({
    has: page.getByRole("heading", { name: "Computed auto item" }),
  });
  const batchPanel = page.locator("section.pricingPanel").filter({
    has: page.getByRole("heading", { name: "Computed auto batch" }),
  });
  await expect(itemPanel.getByRole("term").filter({ hasText: "grossMinor" })).toBeVisible();
  await expect(itemPanel.getByText("9300")).toBeVisible();
  await expect(itemPanel.getByText("FIXED_PRICE")).toBeVisible();
  await expect(batchPanel.getByRole("row", { name: /variant-computed-auto vip-table 7686 1614 9300 EUR FIXED_PRICE/ })).toBeVisible();

  expect(capturedPricingGovernanceRequests).toContain("GET /api/v1/admin/pricing/prices/variant-computed-auto/computed-auto");
  expect(capturedPricingGovernanceRequests).toContain("POST /api/v1/admin/pricing/prices/computed-auto/resolve-batch");
  expect(capturedPricingMutations).toContainEqual({
    method: "POST",
    path: "/api/v1/admin/pricing/prices/computed-auto/resolve-batch",
    body: { itemIds: ["variant-computed-auto"] },
  });
  expect(browserExternalRequests).toEqual([]);
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

test("product preview renders rich product summary below the title", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre", { exact: true }).fill("Producto Rich Preview");
  await page.getByLabel("Resumen HTML").fill("<p><strong>Resumen</strong> con formato</p>");
  await page.getByRole("button", { name: "Vista previa" }).click();

  const previewDialog = page.getByRole("dialog", { name: "Vista previa PDP" });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.locator(".productPreviewSummary strong")).toHaveText("Resumen");
  await expect(previewDialog.locator(".productPreviewSummary")).toContainText("con formato");
  await expect(previewDialog.getByText("<strong>Resumen</strong> con formato")).toHaveCount(0);
});

test("product editor selects catalog feature values and renders them in preview", async ({ page }) => {
  capturedCatalogSpecificationRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByLabel("Nombre del producto").fill("Producto con ficha tecnica");
  await page.getByRole("button", { name: "Caracteristicas" }).click();
  await expect(page.getByRole("heading", { name: "Caracteristicas" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Ficha tecnica Composicion/ })).toBeVisible();

  await page.getByLabel("Valor Composicion").selectOption("value-aluminium");
  await page.getByRole("button", { name: "Vista previa" }).click();

  const previewDialog = page.getByRole("dialog", { name: "Vista previa PDP" });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByRole("heading", { name: "Caracteristicas tecnicas" })).toBeVisible();
  await expect(previewDialog.getByText("Composicion")).toBeVisible();
  await expect(previewDialog.getByText("Aluminio")).toBeVisible();
  expect(capturedCatalogSpecificationRequests).toContain("GET /api/v1/admin/specifications/groups");
  expect(capturedCatalogSpecificationRequests).toContain("GET /api/v1/admin/specifications/groups/spec-group-technical");
});

test("product editor presents variant options as combination attributes", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/new`);

  await page.getByRole("button", { name: "Variantes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Producto y variantes" })).toBeVisible();
  await expect(page.getByText("Generador rapido desde atributos")).toBeVisible();
  await page.getByRole("button", { name: "Anadir variante" }).click();

  await expect(page.getByRole("heading", { name: "Atributos de combinacion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Anadir atributo" })).toBeVisible();
  await expect(page.getByText("Estos atributos identifican esta variante vendible.")).toBeVisible();
});

test("product preview resolves attribute choices to sellable variants", async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await page.getByRole("button", { name: "Vista previa" }).click();

  const previewDialog = page.getByRole("dialog", { name: "Vista previa PDP" });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByText("Variante vendible")).toBeVisible();

  const redChoice = previewDialog.getByRole("button", { name: "color rojo sin stock" });
  await expect(redChoice).toBeDisabled();
  await expect(redChoice).toContainText("Sin stock");

  const greenChoice = previewDialog.getByRole("button", { name: "color verde" });
  await greenChoice.click();

  await expect(greenChoice).toHaveAttribute("aria-pressed", "true");
  await expect(previewDialog.locator(".productPreviewMetaGrid div", { hasText: "Referencia" }).first()).toContainText("PEP-GREEN");
  await expect(previewDialog.locator(".productPreviewPriceBlock strong")).toHaveText("99.00 EUR");
  await expect(previewDialog.locator(".productPreviewMetaGrid div", { hasText: "Stock" }).first()).toContainText("4");
});

test("product editor renders persisted media through the protected preview proxy", async ({ page }) => {
  capturedDraftStateRequests.length = 0;
  capturedMediaAssetContentRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await expect(page.getByRole("button", { name: "Imagenes" })).toBeVisible();
  await page.getByRole("button", { name: "Imagenes" }).click();

  const persistedImage = page.locator('img[alt="Imagen producto existente"]').first();
  await expect(persistedImage).toBeVisible();
  await expect(persistedImage).toHaveAttribute(
    "src",
    /\/api\/admin\/media-assets\/asset-edit-1\/content\?variant=medium_default/,
  );
  await expect.poll(() => capturedMediaAssetContentRequests).toContainEqual(
    expect.stringContaining("/api/v1/admin/media/assets/asset-edit-1/content"),
  );
  expect(capturedDraftStateRequests).toEqual(["/api/v1/admin/product-drafts/product-edit-1"]);
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

  await page.getByRole("button", { name: "Precio", exact: true }).click();
  await page.getByLabel("Precio de venta sin impuestos").fill("49.90");
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

test("product editor applies the pricing preview simulator from the pricing tab", async ({ page }) => {
  capturedEditorStateRequests.length = 0;
  capturedDraftStateRequests.length = 0;
  capturedPricingPreviewRequests.length = 0;

  await loginAdmin(page);
  await page.goto(`http://127.0.0.1:${nextPort}/admin/products/product-edit-1`);

  await expect(page.getByLabel("Nombre del producto")).toHaveValue("Producto existente Playwright");
  await page.getByRole("button", { name: "Precio", exact: true }).click();

  const baseAdvancedPanel = page.locator("details.productPricingAdvanced").filter({ has: page.locator("summary", { hasText: "Contexto avanzado de precio base" }) });
  await expect(baseAdvancedPanel.locator(":scope > summary .productCollapseIcon")).toBeVisible();

  const specificPricesPanel = page.locator("details.productSpecificPrices").filter({ has: page.locator("summary", { hasText: "Precios especificos" }) });
  await expect(specificPricesPanel).toBeVisible();
  await expect(specificPricesPanel).not.toHaveAttribute("open", "");
  await expect(specificPricesPanel.locator(":scope > summary .productCollapseIcon")).toBeVisible();

  const simulator = page.locator("details.productSpecificPrices").filter({ has: page.locator("summary", { hasText: "Simulador de precio aplicado" }) });
  await expect(simulator).toBeVisible();
  await expect(simulator).not.toHaveAttribute("open", "");
  await expect(simulator.locator(":scope > summary .productCollapseIcon")).toBeVisible();
  await simulator.locator("summary", { hasText: "Simulador de precio aplicado" }).click();
  await expect(simulator).toHaveAttribute("open", "");
  await expect(simulator.getByLabel("Canal")).toHaveValue("web");
  await expect(simulator.getByLabel("Canal").locator('option[value="web"]')).toHaveText("Web");
  await expect(simulator.getByLabel("Canal").locator('option[value="marketplace"]')).toHaveText("Marketplace");

  await simulator.getByLabel("Cantidad").fill("3");
  await simulator.getByLabel("Price table").selectOption("cockpit-vip");
  await simulator.getByRole("button", { name: "Simular precio" }).click();

  await expect(simulator.getByText("Precio aplicado", { exact: true })).toBeVisible();
  await expect(simulator.getByText("95.00 EUR").first()).toBeVisible();
  await expect(simulator.getByText("95.00 EUR")).toHaveCount(2);
  await expect(simulator.getByText("pricing-preview-cockpit-vip")).toBeVisible();
  await expect(simulator.getByRole("row", { name: /Price table cockpit-vip cockpit-vip Cumple/ })).toBeVisible();
  await expect(simulator.getByRole("row", { name: /Cantidad minima 3 3 Cumple/ })).toBeVisible();
  await expect(simulator.getByText("Cumple").first()).toBeVisible();

  expect(capturedPricingPreviewRequests).toHaveLength(1);
  expect(capturedPricingPreviewRequests[0]).toContain("productId=product-edit-1");
  expect(capturedPricingPreviewRequests[0]).toContain("defaultVariantId=variant-edit-default");
  expect(capturedPricingPreviewRequests[0]).toContain("priceTableId=cockpit-vip");
  expect(capturedPricingPreviewRequests[0]).toContain("quantity=3");
});
