import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function loadTsModule(relativePath, extraRequire = () => ({})) {
  const source = readFileSync(path.resolve(root, relativePath), "utf8");
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
    encodeURIComponent,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    process: { env: {} },
    require(specifier) {
      return extraRequire(specifier);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("storefront PLP route exists outside admin", () => {
  const routeSource = readFileSync(path.resolve(root, "app/plp/[categorySlug]/page.tsx"), "utf8");
  const pdpRouteSource = readFileSync(path.resolve(root, "app/pdp/[productSlug]/page.tsx"), "utf8");
  assert.match(routeSource, /getStorefrontPlp/);
  assert.match(routeSource, /StorefrontPlpPage/);
  assert.match(pdpRouteSource, /getStorefrontPdp/);
  assert.match(pdpRouteSource, /StorefrontPdpPage/);
});

test("storefront PLP fetches public BFF listing with routePath for CMS targeting", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });

    if (pathValue === "/storefront/navigation/categories/tree/3") {
      return {
        ok: true,
        status: 200,
        correlationId: "corr-nav",
        data: {
          categories: [{
            id: "cat-1",
            name: "Clothes",
            linkId: "clothes",
            url: "/clothes",
            children: [],
          }],
        },
      };
    }

    return {
      ok: true,
      status: 200,
      correlationId: "corr-plp",
      data: {
        categorySlug: "clothes",
        total: 1,
        limit: 16,
        offset: 0,
        products: [{
          productId: "product-1",
          slug: "linen-shirt",
          nombre: "Linen Shirt",
          brand: "Ecommium",
          image: { url: "https://cdn.example.test/linen.jpg", altText: "Linen Shirt" },
          price: { currency: "EUR", currentAmountMinor: 1299 },
          isAvailable: true,
        }],
        cmsBlocks: {
          beforeList: [{ blockId: "intro", type: "plp.categoryIntro", props: { title: "Clothes" } }],
          afterList: [],
        },
      },
    };
  };
  const { getStorefrontPlp } = loadTsModule("src/modules/storefront/plp.ts", (specifier) => {
    if (specifier.endsWith("/shared/bff/client")) {
      return { requestBff };
    }
    if (specifier.endsWith("/shared/config/env")) {
      return {
        defaultAdminContext: {
          organizationId: "org-1",
          shopId: "shop-1",
          shopAlias: "",
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
        },
      };
    }
    return {};
  });

  const result = await getStorefrontPlp("clothes");

  assert.equal(result.ok, true);
  assert.equal(result.data.products[0].name, "Linen Shirt");
  assert.equal(result.data.cmsBlocks.beforeList[0].blockId, "intro");
  assert.equal(result.data.limit, 16);
  assert.equal(result.data.categories[0].href, "/plp/clothes");
  assert.equal(result.data.publicPath, "/plp/clothes");
  const plpCall = calls.find((call) => call.path.startsWith("/storefront/plp/clothes?"));
  assert.ok(plpCall);
  assert.match(plpCall.path, /organizationId=org-1/);
  assert.match(plpCall.path, /shopId=shop-1/);
  assert.match(plpCall.path, /limit=16/);
  assert.match(plpCall.path, /routePath=%2Fclothes/);
  assert.equal(plpCall.options.withAuth, false);
});

test("storefront PDP maps product details, variants and specifications", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });

    return {
      ok: true,
      status: 200,
      correlationId: "corr-pdp",
      data: {
        product: {
          productId: "product-1",
          slug: "linen-shirt",
          linkId: "linen-shirt",
          refId: "LINEN-001",
          name: "Linen Shirt",
          brand: "Ecommium",
          brandId: "brand-1",
          categoryId: "cat-1",
          shortDescription: "<p>Light shirt</p>",
          description: "<p>Long description</p>",
          metaTagDescription: "SEO description",
          keywords: "linen,shirt",
          taxCode: "standard",
          images: [{ url: "https://cdn.example.test/linen.jpg", altText: "Linen Shirt" }],
          price: { currency: "EUR", currentAmountMinor: 1299, previousAmountMinor: 1599 },
          isAvailable: true,
          availability: { available: true, availableQuantity: 7 },
          variants: [{
            variantId: "variant-1",
            name: "Linen Shirt M",
            refId: "LINEN-M",
            ean: "1234567890123",
            isDefault: true,
            isAvailable: true,
            availability: { available: true, availableQuantity: 7 },
            options: [{ attributeCode: "size", valueCode: "m" }],
            price: { currency: "EUR", currentAmountMinor: 1299 },
          }],
          specifications: [{
            name: "Material",
            fields: [{ name: "Fabric", selectedValue: { name: "Linen" } }],
          }],
        },
      },
    };
  };
  const { getStorefrontPdp } = loadTsModule("src/modules/storefront/pdp.ts", (specifier) => {
    if (specifier.endsWith("/shared/bff/client")) {
      return { requestBff };
    }
    if (specifier.endsWith("/shared/config/env")) {
      return {
        defaultAdminContext: {
          organizationId: "org-1",
          shopId: "shop-1",
          shopAlias: "",
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
        },
      };
    }
    return {};
  });

  const result = await getStorefrontPdp("linen-shirt");

  assert.equal(result.ok, true);
  assert.equal(result.data.refId, "LINEN-001");
  assert.equal(result.data.ean, "1234567890123");
  assert.equal(result.data.images.length, 1);
  assert.equal(result.data.variants[0].options[0].valueCode, "m");
  assert.equal(result.data.specifications[0].fields[0].value, "Linen");
  assert.match(calls[0].path, /^\/storefront\/pdp\/linen-shirt\?/);
  assert.equal(calls[0].options.withAuth, false);
});
