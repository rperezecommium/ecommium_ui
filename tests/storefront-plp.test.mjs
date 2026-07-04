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

test("storefront PLP product cards expose availability ribbon and quick view", () => {
  const plpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/plp-page.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(plpPageSource, /storefrontAvailabilityRibbon/);
  assert.doesNotMatch(plpPageSource, /storefrontProductAvailability/);
  assert.match(plpPageSource, /Vista rapida/);
  assert.match(cssSource, /\.storefrontAvailabilityRibbon/);
  assert.match(cssSource, /width: 145px/);
  assert.match(cssSource, /font-size: 12px/);
  assert.match(cssSource, /transform: rotate\(-32deg\)/);
  assert.match(cssSource, /\.storefrontQuickView[\s\S]*border-radius: 27px/);
  assert.match(cssSource, /\.storefrontQuickView[\s\S]*font-size: 14px/);
  assert.match(cssSource, /\.storefrontQuickView[\s\S]*opacity: 0/);
  assert.match(cssSource, /\.storefrontQuickView[\s\S]*transform: translate\(-50%, 140%\)/);
  assert.match(cssSource, /\.storefrontProductCard:hover \.storefrontQuickView[\s\S]*opacity: 1/);
  assert.match(cssSource, /\.storefrontProductCard:hover \.storefrontQuickView[\s\S]*transform: translate\(-50%, 132%\)/);
  assert.match(cssSource, /\.storefrontProductInfo b[\s\S]*font-size: 24px/);
});

test("storefront PDP renders specifications in the buy box grid", () => {
  const pdpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/pdp-content-client.tsx"), "utf8");

  assert.match(pdpPageSource, /<PdpSpecificationsGrid specifications=\{data\.specifications\} \/>/);
  assert.match(pdpPageSource, /className="storefrontPdpSpecsGrid"/);
  assert.doesNotMatch(pdpPageSource, /<summary>Caracteristicas<\/summary>/);
  assert.doesNotMatch(pdpPageSource, /<summary>Detalles del producto<\/summary>/);
  assert.doesNotMatch(pdpPageSource, /<summary>Combinaciones<\/summary>/);
});

test("storefront PDP renders variant images as selectable swatches", () => {
  const pdpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/pdp-content-client.tsx"), "utf8");

  assert.match(pdpPageSource, /const variantImage = variant\.images\[0\]/);
  assert.match(pdpPageSource, /storefrontPdpVariantImageButton/);
  assert.match(pdpPageSource, /aria-label=\{`Seleccionar \$\{variant\.name\}`\}/);
  assert.match(pdpPageSource, /<Image src=\{variantImage\.url\}/);
  assert.doesNotMatch(pdpPageSource, /<span>\{variant\.name\}\{variant\.isDefault/);
  assert.match(pdpPageSource, /discountPercentage/);
  assert.doesNotMatch(pdpPageSource, />Variante seleccionada</);
});

test("storefront PDP exposes an operative share box", () => {
  const pdpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/pdp-content-client.tsx"), "utf8");

  assert.match(pdpPageSource, /<PdpShareBox/);
  assert.match(pdpPageSource, /navigator\.clipboard\.writeText\(shareUrl\)/);
  assert.match(pdpPageSource, /copyTextWithFallback/);
  assert.match(pdpPageSource, /document\.execCommand\("copy"\)/);
  assert.match(pdpPageSource, /navigator\.share/);
  assert.match(pdpPageSource, /https:\/\/wa\.me\/\?text=/);
  assert.match(pdpPageSource, /https:\/\/www\.facebook\.com\/sharer\/sharer\.php/);
  assert.match(pdpPageSource, /https:\/\/twitter\.com\/intent\/tweet/);
  assert.match(pdpPageSource, /mailto:\?subject=/);
});

test("storefront PDP exposes image zoom interactions", () => {
  const pdpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/pdp-content-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(pdpPageSource, /const \[zoomModalOpen, setZoomModalOpen\]/);
  assert.match(pdpPageSource, /function updateZoomLens/);
  assert.match(pdpPageSource, /onMouseMove=\{mainImage\.url \? updateZoomLens : undefined\}/);
  assert.match(pdpPageSource, /onClick=\{\(\) => setZoomModalOpen\(true\)\}/);
  assert.match(pdpPageSource, /className="storefrontPdpZoomLens"/);
  assert.match(pdpPageSource, /role="dialog"/);
  assert.match(pdpPageSource, /event\.key === "Escape"/);
  assert.match(cssSource, /\.storefrontPdpZoomLens[\s\S]*background-size: 220%/);
  assert.match(cssSource, /\.storefrontPdpZoomModal[\s\S]*position: fixed/);
  assert.match(cssSource, /\.storefrontPdpZoomModalImage img[\s\S]*object-fit: contain/);
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

    if (pathValue === "/storefront/navigation/categories/tree/3") {
      return {
        ok: true,
        status: 200,
        correlationId: "corr-nav",
        data: {
          categories: [{
            id: "cat-1",
            name: "Bike Brakes",
            linkId: "bike-brakes",
            url: "/bike-brakes",
            children: [],
          }],
        },
      };
    }

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
          shortDescription: "<p>Light <strong>shirt</strong></p>",
          description: "<p>Long description</p><ul><li><p>First detail</p></li></ul>",
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
            images: [{ url: "https://cdn.example.test/linen-m.jpg", altText: "Linen Shirt M" }],
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
  assert.equal(result.data.images.length, 2);
  assert.equal(result.data.images[0].url, "https://cdn.example.test/linen.jpg");
  assert.equal(result.data.shortDescription, "<p>Light <strong>shirt</strong></p>");
  assert.equal(result.data.description, "<p>Long description</p><ul><li><p>First detail</p></li></ul>");
  assert.equal(result.data.priceAmountMinor, 1299);
  assert.equal(result.data.previousPriceAmountMinor, 1599);
  assert.equal(result.data.category, "Bike Brakes");
  assert.equal(result.data.categoryHref, "/plp/bike-brakes");
  assert.equal(result.data.variants[0].priceAmountMinor, 1299);
  assert.equal(result.data.variants[0].images[0].url, "https://cdn.example.test/linen-m.jpg");
  assert.equal(result.data.variants[0].options[0].valueCode, "m");
  assert.equal(result.data.specifications[0].fields[0].value, "Linen");
  assert.match(calls[0].path, /^\/storefront\/pdp\/linen-shirt\?/);
  assert.equal(calls[0].options.withAuth, false);
});
