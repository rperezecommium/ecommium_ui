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
  const searchRouteSource = readFileSync(path.resolve(root, "app/search/page.tsx"), "utf8");
  const confirmationRouteSource = readFileSync(path.resolve(root, "app/checkout/confirmation/page.tsx"), "utf8");
  const searchEventsRouteSource = readFileSync(path.resolve(root, "app/api/storefront/search/events/route.ts"), "utf8");
  const cartRouteSource = readFileSync(path.resolve(root, "app/api/storefront/cart/route.ts"), "utf8");
  const cartItemsRouteSource = readFileSync(path.resolve(root, "app/api/storefront/cart/items/route.ts"), "utf8");
  const cartPageSource = readFileSync(path.resolve(root, "app/cart/page.tsx"), "utf8");
  const checkoutPageSource = readFileSync(path.resolve(root, "app/checkout/page.tsx"), "utf8");
  const checkoutRouteSource = readFileSync(path.resolve(root, "app/api/storefront/checkout/route.ts"), "utf8");
  const pdpRouteSource = readFileSync(path.resolve(root, "app/pdp/[productSlug]/page.tsx"), "utf8");
  const visitorSource = readFileSync(path.resolve(root, "src/modules/storefront/visitor.ts"), "utf8");
  assert.match(routeSource, /getStorefrontPlp/);
  assert.match(routeSource, /StorefrontPlpPage/);
  assert.match(searchRouteSource, /getStorefrontSearch/);
  assert.match(searchRouteSource, /StorefrontPlpPage/);
  assert.match(searchRouteSource, /storefrontVisitorCookieName/);
  assert.match(confirmationRouteSource, /StorefrontPurchaseCompleteClient/);
  assert.match(confirmationRouteSource, /transactionId/);
  assert.match(confirmationRouteSource, /revenueMinor/);
  assert.match(searchEventsRouteSource, /\/storefront\/search\/events/);
  assert.match(searchEventsRouteSource, /withAuth: false/);
  assert.match(searchEventsRouteSource, /visitorIdFromCookieHeader/);
  assert.match(cartRouteSource, /\/orderforms\/current/);
  assert.match(cartRouteSource, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(cartRouteSource, /withAuth: false/);
  assert.match(cartItemsRouteSource, /\/orderforms\/\$\{encodeURIComponent\(input\.orderFormId\)\}\/items/);
  assert.match(cartItemsRouteSource, /items\/remove-all/);
  assert.match(cartPageSource, /StorefrontCartPageClient/);
  assert.match(checkoutPageSource, /StorefrontCheckoutClient/);
  assert.match(checkoutRouteSource, /\/shipping\/options\/resolve/);
  assert.match(checkoutRouteSource, /\/orders/);
  assert.match(checkoutRouteSource, /attachments\/client-profile-data/);
  assert.match(checkoutRouteSource, /attachments\/shipping-data/);
  assert.match(checkoutRouteSource, /attachments\/payment-data/);
  assert.match(checkoutRouteSource, /\/coupons/);
  assert.match(checkoutRouteSource, /case "remove-coupon"/);
  assert.match(checkoutRouteSource, /method: "DELETE"/);
  assert.match(pdpRouteSource, /getStorefrontPdp/);
  assert.match(pdpRouteSource, /StorefrontPdpPage/);
  assert.match(pdpRouteSource, /storefrontVisitorCookieName/);
  assert.match(visitorSource, /ecommium_storefront_visitor_id/);
});

test("storefront PLP product cards expose availability ribbon and quick view", () => {
  const plpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/plp-page.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(plpPageSource, /storefrontAvailabilityRibbon/);
  assert.match(plpPageSource, /action="\/search"/);
  assert.match(plpPageSource, /name="q"/);
  assert.match(plpPageSource, /StorefrontSearchEventsClient/);
  assert.match(plpPageSource, /StorefrontCartStatus/);
  assert.match(plpPageSource, /StorefrontAddToCartButton/);
  assert.match(plpPageSource, /className="storefrontProductCartButton"/);
  assert.match(plpPageSource, /disabled=\{!product\.available \|\| !product\.variantId\}/);
  assert.match(plpPageSource, /variantId=\{product\.variantId\}/);
  assert.match(plpPageSource, /data-search-product-id/);
  assert.match(plpPageSource, /product\.productUrlPath\?\.startsWith\("\/"\)/);
  assert.match(plpPageSource, /encodeURIComponent\(product\.slug\)/);
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

test("storefront checkout confirmation records purchase complete events", () => {
  const confirmationRouteSource = readFileSync(path.resolve(root, "app/checkout/confirmation/page.tsx"), "utf8");
  const purchaseClientSource = readFileSync(path.resolve(root, "src/modules/storefront/purchase-complete-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(purchaseClientSource, /eventType: "purchase-complete"/);
  assert.match(purchaseClientSource, /purchaseTransaction/);
  assert.match(purchaseClientSource, /currencyCode/);
  assert.match(purchaseClientSource, /quantity: event\.quantity/);
  assert.match(confirmationRouteSource, /productId/);
  assert.match(confirmationRouteSource, /variantId/);
  assert.match(confirmationRouteSource, /normalizeStorefrontVisitorId/);
  assert.match(cssSource, /\.storefrontConfirmation/);
});

test("storefront search events client records search and detail page events", () => {
  const eventsClientSource = readFileSync(path.resolve(root, "src/modules/storefront/search-events-client.tsx"), "utf8");

  assert.match(eventsClientSource, /navigator\.sendBeacon/);
  assert.match(eventsClientSource, /ensureStorefrontVisitorId/);
  assert.match(eventsClientSource, /document\.cookie = `\$\{storefrontVisitorCookieName\}=/);
  assert.match(eventsClientSource, /\/api\/storefront\/search\/events/);
  assert.match(eventsClientSource, /eventType: "search"/);
  assert.match(eventsClientSource, /eventType: "detail-page-view"/);
  assert.match(eventsClientSource, /closest<HTMLAnchorElement>\("\[data-search-product-id\]"\)/);
});

test("storefront PDP add to cart records search add-to-cart event", () => {
  const pdpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/pdp-content-client.tsx"), "utf8");

  assert.match(pdpPageSource, /sendStorefrontSearchEvent/);
  assert.match(pdpPageSource, /eventType: "add-to-cart"/);
  assert.match(pdpPageSource, /productDetails: \[\{/);
  assert.match(pdpPageSource, /variantId: selectedVariant\?\.variantId/);
  assert.match(pdpPageSource, /quantity,/);
  assert.match(pdpPageSource, /StorefrontAddToCartButton/);
  assert.match(pdpPageSource, /onAdded=\{recordAddToCartEvent\}/);
  assert.match(pdpPageSource, /className="storefrontPdpAddToCartButton"/);
});

test("storefront cart UI mutates orderforms through the BFF proxy", () => {
  const cartClientSource = readFileSync(path.resolve(root, "src/modules/storefront/cart-client.tsx"), "utf8");
  const cartNormalizerSource = readFileSync(path.resolve(root, "src/modules/storefront/cart.ts"), "utf8");
  const cartItemsRouteSource = readFileSync(path.resolve(root, "app/api/storefront/cart/items/route.ts"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(cartClientSource, /ecommium_storefront_guest_session_id/);
  assert.match(cartClientSource, /ecommium_storefront_order_form_id/);
  assert.match(cartClientSource, /ecommium:cart-updated/);
  assert.match(cartClientSource, /\/api\/storefront\/cart\?/);
  assert.match(cartClientSource, /\/api\/storefront\/cart\/items/);
  assert.match(cartClientSource, /StorefrontCartConfirmationDialog/);
  assert.match(cartClientSource, /Producto añadido correctamente a tu carrito/);
  assert.match(cartClientSource, /Continuar comprando/);
  assert.match(cartClientSource, /Finalizar compra/);
  assert.match(cartClientSource, /href="\/checkout"/);
  assert.match(cartClientSource, /CartTotalsPanel/);
  assert.match(cartClientSource, /StorefrontCouponControl/);
  assert.match(cartClientSource, /mutateCheckoutCoupon\("coupon"/);
  assert.match(cartClientSource, /mutateCheckoutCoupon\("remove-coupon"/);
  assert.match(cartClientSource, /\/api\/storefront\/checkout/);
  assert.match(cartClientSource, /mutateCart\("POST"/);
  assert.match(cartClientSource, /mutateCart\("PATCH"/);
  assert.match(cartClientSource, /mutateCart\("DELETE"/);
  assert.match(cartClientSource, /itemIndex, quantity: Math\.max\(0, quantity\)/);
  assert.match(cartClientSource, /onQuantityChange\(index, 0\)/);
  assert.match(cartClientSource, /cartHasShippingData\(orderform\) \|\| totals\.shipping > 0/);
  assert.match(cartClientSource, /cartHasCouponData\(orderform\) && orderform\.totals\.discountsTotalMinor/);
  assert.doesNotMatch(cartClientSource, /Pendiente/);
  assert.match(cartClientSource, /StorefrontCartPageClient/);
  assert.match(cartNormalizerSource, /normalizeOrderformPayload/);
  assert.match(cartNormalizerSource, /envelope\.orderform/);
  assert.match(cartNormalizerSource, /clientProfileData/);
  assert.match(cartNormalizerSource, /couponData/);
  assert.match(cartNormalizerSource, /cartCouponCode/);
  assert.match(cartNormalizerSource, /paymentData/);
  assert.match(cartNormalizerSource, /shippingData/);
  assert.match(cartNormalizerSource, /taxTotalMinor/);
  assert.match(cartNormalizerSource, /cartItemLineTotalMinor/);
  assert.match(cartItemsRouteSource, /method === "POST" \? 201 : 200/);
  assert.match(cartItemsRouteSource, /items\/remove-all/);
  assert.match(cssSource, /\.storefrontCartLayout/);
  assert.match(cssSource, /\.storefrontCartItem/);
  assert.match(cssSource, /\.storefrontCartQuantity/);
  assert.match(cssSource, /\.storefrontCartModal/);
  assert.match(cssSource, /\.storefrontCartModalProduct/);
  assert.match(cssSource, /\.storefrontCartTotalsPanel/);
  assert.match(cssSource, /\.storefrontCouponPanel/);
});

test("storefront checkout persists orderform checkout data through BFF actions", () => {
  const checkoutClientSource = readFileSync(path.resolve(root, "src/modules/storefront/checkout-client.tsx"), "utf8");
  const checkoutRouteSource = readFileSync(path.resolve(root, "app/api/storefront/checkout/route.ts"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(checkoutClientSource, /StorefrontCheckoutClient/);
  assert.match(checkoutClientSource, /client-profile-data/);
  assert.match(checkoutClientSource, /resolve-shipping-options/);
  assert.match(checkoutClientSource, /shipping-data/);
  assert.match(checkoutClientSource, /payment-data/);
  assert.match(checkoutClientSource, /coupon/);
  assert.match(checkoutClientSource, /remove-coupon/);
  assert.match(checkoutClientSource, /StorefrontCouponControl/);
  assert.match(checkoutClientSource, /couponSlot/);
  assert.match(checkoutClientSource, /create-order/);
  assert.match(checkoutClientSource, /\/api\/storefront\/cart\/items/);
  assert.match(checkoutClientSource, /method: "DELETE"/);
  assert.doesNotMatch(checkoutClientSource, /Cupón o promoción/);
  assert.match(checkoutClientSource, /cartUpdatedEventName/);
  assert.match(checkoutClientSource, /selectedSlas/);
  assert.match(checkoutClientSource, /selectedSla/);
  assert.match(checkoutClientSource, /Confirmar pedido/);
  assert.match(checkoutClientSource, /checkout\/confirmation/);
  assert.match(checkoutRouteSource, /passthroughHeaders\(authorization, guestSessionId\)/);
  assert.match(checkoutRouteSource, /getStorefrontCustomerAuthorizationHeader/);
  assert.match(checkoutRouteSource, /withAuth: false/);
  assert.match(cssSource, /\.storefrontCheckoutLayout/);
  assert.match(cssSource, /\.storefrontCheckoutStepper/);
  assert.match(cssSource, /\.storefrontCheckoutSummary/);
});


test("storefront PDP reuses the operative storefront search header", () => {
  const pdpPageSource = readFileSync(path.resolve(root, "src/modules/storefront/pdp-page.tsx"), "utf8");

  assert.match(pdpPageSource, /import \{ StorefrontHeader \} from "\.\/plp-page"/);
  assert.match(pdpPageSource, /<StorefrontHeader \/>/);
  assert.doesNotMatch(pdpPageSource, /<input placeholder="Buscar en nuestra tienda" \/>/);
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
          productUrlPath: "/pdp/linen-shirt-canonical",
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
    if (specifier === "./storefront-context") {
      return {
        getStorefrontContext: () => ({
          organizationId: "org-1",
          shopId: "shop-1",
          shopAlias: "",
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
          channel: "web",
        }),
      };
    }
    return {};
  });

  const result = await getStorefrontPlp("clothes");

  assert.equal(result.ok, true);
  assert.equal(result.data.products[0].name, "Linen Shirt");
  assert.equal(result.data.products[0].productUrlPath, "/pdp/linen-shirt-canonical");
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

test("storefront search fetches public BFF search with q and visitorId", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });

    if (pathValue === "/storefront/navigation/categories/tree/3") {
      return {
        ok: true,
        status: 200,
        correlationId: "corr-nav",
        data: { categories: [] },
      };
    }

    return {
      ok: true,
      status: 200,
      correlationId: "corr-search",
      data: {
        searchTotal: 1,
        attributionToken: "token-1",
        limit: 8,
        offset: 8,
        products: [{
          productId: "product-search-1",
          selectedVariantId: "variant-search-1",
          slug: "pastillas-freno",
          productUrlPath: "/pdp/pastillas-freno-canonical",
          name: "Pastillas freno",
          brand: "Northline",
          image: { url: "https://cdn.example.test/brake.jpg" },
          price: { currency: "EUR", currentAmountMinor: 956 },
          isAvailable: true,
        }],
      },
    };
  };
  const { getStorefrontSearch } = loadTsModule("src/modules/storefront/plp.ts", (specifier) => {
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
    if (specifier === "./storefront-context") {
      return {
        getStorefrontContext: () => ({
          organizationId: "org-1",
          shopId: "shop-1",
          shopAlias: "",
          locale: "es-ES",
          currency: "EUR",
          country: "ES",
          channel: "web",
        }),
      };
    }
    return {};
  });

  const result = await getStorefrontSearch("pastillas freno", {
    page: "2",
    limit: "8",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.searchQuery, "pastillas freno");
  assert.equal(result.data.searchEvent.attributionToken, "token-1");
  assert.equal(result.data.searchEvent.visitorId, "storefront-anonymous");
  assert.equal(result.data.searchEvent.organizationId, "org-1");
  assert.equal(result.data.searchEvent.shopId, "shop-1");
  assert.equal(result.data.publicPath, "/search");
  assert.equal(result.data.products[0].name, "Pastillas freno");
  assert.equal(result.data.products[0].productUrlPath, "/pdp/pastillas-freno-canonical");
  assert.equal(result.data.products[0].variantId, "variant-search-1");
  assert.equal(result.data.total, 1);
  const searchCall = calls.find((call) => call.path.startsWith("/storefront/search?"));
  assert.ok(searchCall);
  assert.match(searchCall.path, /q=pastillas\+freno/);
  assert.match(searchCall.path, /organizationId=org-1/);
  assert.match(searchCall.path, /shopId=shop-1/);
  assert.match(searchCall.path, /limit=8/);
  assert.match(searchCall.path, /offset=8/);
  assert.match(searchCall.path, /visitorId=storefront-anonymous/);
  assert.equal(searchCall.options.withAuth, false);
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
    if (specifier.endsWith("./visitor")) {
      return {
        normalizeStorefrontVisitorId(value) {
          return value?.trim() || "storefront-anonymous";
        },
      };
    }
    return {};
  });

  const result = await getStorefrontPdp("linen-shirt", { visitorId: "sf-visitor-1" });

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
  assert.equal(result.data.eventContext.organizationId, "org-1");
  assert.equal(result.data.eventContext.shopId, "shop-1");
  assert.equal(result.data.eventContext.visitorId, "sf-visitor-1");
  assert.match(calls[0].path, /^\/storefront\/pdp\/linen-shirt\?/);
  assert.equal(calls[0].options.withAuth, false);
});

test("storefront PDP does not fallback to PLP when public slug is missing", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, options });
    return {
      ok: false,
      status: 404,
      correlationId: "corr-missing",
      error: "product not found",
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
    if (specifier.endsWith("./visitor")) {
      return {
        normalizeStorefrontVisitorId(value) {
          return value?.trim() || "storefront-anonymous";
        },
      };
    }
    return {};
  });

  const result = await getStorefrontPdp("stale-link-id", {
    visitorId: "sf-visitor-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.error, "product not found");
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /^\/storefront\/pdp\/stale-link-id\?/);
});
