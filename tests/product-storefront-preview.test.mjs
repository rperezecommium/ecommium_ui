import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const context = {
  organizationId: "org-barcelona",
  shopId: "shop-barcelona",
  shopAlias: "barcelona",
  shopName: "Barcelona",
  primaryDomain: "barcelona.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function loadStorefrontPreviewModule({ requestBff }) {
  const source = readFileSync(path.resolve(root, "src/modules/catalogo/product-storefront-preview.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    Intl,
    URLSearchParams,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }

      throw new Error(`Unexpected test require: ${specifier}`);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function editorData() {
  return {
    product: {
      productId: "product-1",
      name: "Casco Pro",
      slug: "casco-pro",
      reference: "CASCO-PRO",
      isActive: true,
      isVisible: true,
    },
    routingSeo: {
      canonicalRoute: {
        routeId: "route-product-1",
        path: "/casco-pro/p",
        routeKind: "CANONICAL",
        status: "ACTIVE",
        includeInSitemap: true,
      },
      aliases: [],
      routes: { items: [], total: 0, limit: 50, offset: 0 },
      resolvedCanonical: null,
    },
    warnings: [],
  };
}

test("getProductStorefrontPreview reads Storefront PDP through public BFF scope", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });
    assert.equal(options.withAuth, false);
    assert.equal(options.context.organizationId, context.organizationId);

    const raw = {
      product: {
        productId: "product-1",
        slug: "casco-pro",
        name: "Casco Pro Storefront",
        shortDescription: "<p>Resumen Storefront</p>",
        description: "<p>Descripcion Storefront</p>",
        brand: { name: "Ecommium" },
        category: { name: "Cascos" },
        images: [{ url: "/media/casco-pro.jpg", alt: "Casco Pro" }],
        price: { amountMinor: 12999, currency: "EUR" },
        availability: { available: true },
        variants: [{ variantId: "variant-1" }, { variantId: "variant-2" }],
      },
      breadcrumbs: [{ name: "Inicio" }, { name: "Cascos" }],
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      status: 200,
      correlationId: "corr-storefront",
    };
  };
  const { getProductStorefrontPreview } = loadStorefrontPreviewModule({ requestBff });

  const result = await getProductStorefrontPreview(context, editorData());

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].path,
    "/storefront/pdp/casco-pro?organizationId=org-barcelona&shopId=shop-barcelona&locale=es-ES&currency=EUR&country=ES&channel=web",
  );
  assert.equal(result.ok, true);
  assert.equal(result.requestedPath, calls[0].path);
  assert.equal(result.data.title, "Casco Pro Storefront");
  assert.equal(result.data.shortDescription, "Resumen Storefront");
  assert.equal(result.data.imageUrl, "/media/casco-pro.jpg");
  assert.match(result.data.priceDisplay, /129,99/);
  assert.equal(result.data.availability, "Disponible");
  assert.deepEqual(Array.from(result.data.breadcrumbs), ["Inicio", "Cascos"]);
  assert.equal(result.data.variantsCount, 2);
});

test("Storefront preview route is Admin-only noindex and wired from product UI", () => {
  const routeSource = readFileSync(
    path.resolve(root, "app/(admin)/admin/products/[productId]/storefront-preview/page.tsx"),
    "utf8",
  );
  const pageSource = readFileSync(path.resolve(root, "src/modules/catalogo/product-storefront-preview-page.tsx"), "utf8");
  const helperSource = readFileSync(path.resolve(root, "src/modules/catalogo/product-storefront-preview.ts"), "utf8");
  const listSource = readFileSync(path.resolve(root, "src/modules/catalogo/product-list-page.tsx"), "utf8");
  const editorSource = readFileSync(path.resolve(root, "src/modules/catalogo/product-editor-client.tsx"), "utf8");

  assert.match(routeSource, /robots:[\s\S]*index: false[\s\S]*follow: false/);
  assert.match(routeSource, /ProductStorefrontPreviewPage/);
  assert.match(pageSource, /getProductStorefrontPreview/);
  assert.match(pageSource, /No crea rutas publicas indexables/);
  assert.match(helperSource, /\/storefront\/pdp\/\$\{encodeURIComponent\(productSlug\)\}/);
  assert.match(helperSource, /withAuth: false/);
  assert.match(listSource, /\/storefront-preview`/);
  assert.match(editorSource, /\/storefront-preview`/);
});
