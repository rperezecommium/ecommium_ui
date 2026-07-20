import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);

const context = {
  organizationId: "org-1",
  shopId: "shop-1",
  shopAlias: "shop",
  shopName: "Shop",
  primaryDomain: "shop.test",
  shopStatus: "ACTIVE",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

function loadPromotionsAdminModule(requestBff) {
  const source = readFileSync(path.resolve(root, "src/modules/promociones/promotions-admin.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const moduleContext = {
    URLSearchParams,
    encodeURIComponent,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.endsWith("/shared/bff/client")) {
        return { requestBff };
      }

      return {};
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

test("promotions admin lists coupons through BFF Admin facade", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({ path: pathValue, method: options.init?.method ?? "GET" });

    return {
      ok: true,
      status: 200,
      correlationId: "corr-promotions",
      data: options.parse
        ? options.parse({
            coupons: [
              {
                organizationId: "org-1",
                shopId: "shop-1",
                couponCode: "WELCOME10",
                name: "Welcome",
                discountType: "PERCENTAGE",
                value: 10,
                currency: "USD",
                minSubtotalMinor: 0,
                validFrom: null,
                validTo: null,
                active: true,
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
            total: 1,
          })
        : {},
    };
  };
  const { getPromotionsAdminData } = loadPromotionsAdminModule(requestBff);

  const data = await getPromotionsAdminData(context, { status: "all", q: "welcome" });

  assert.equal(data.coupons.source, "bff");
  assert.equal(data.coupons.data.total, 1);
  assert.equal(data.coupons.data.coupons[0].couponCode, "WELCOME10");
  assert.equal(calls[0].path, "/admin/promotions/coupons?organizationId=org-1&shopId=shop-1&includeInactive=true");
});

test("promotions admin creates, updates and deletes coupons through BFF modes", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
      body: options.init?.body ? JSON.parse(options.init.body) : undefined,
    });

    return {
      ok: true,
      status: 200,
      correlationId: "corr-promotions",
      data: options.parse ? options.parse({ couponCode: "WELCOME10", active: true }) : {},
    };
  };
  const {
    createPromotionCoupon,
    deletePromotionCoupon,
    updatePromotionCoupon,
  } = loadPromotionsAdminModule(requestBff);

  await createPromotionCoupon(context, { couponCode: "WELCOME10", name: "Welcome" });
  await updatePromotionCoupon(context, "WELCOME10", { active: false });
  await deletePromotionCoupon(context, "WELCOME10", "soft");
  await deletePromotionCoupon(context, "WELCOME10", "hard");

  assert.equal(calls[0].path, "/admin/promotions/coupons?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[1].path, "/admin/promotions/coupons/WELCOME10?organizationId=org-1&shopId=shop-1");
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[2].path, "/admin/promotions/coupons/WELCOME10?organizationId=org-1&shopId=shop-1&mode=soft");
  assert.equal(calls[2].method, "DELETE");
  assert.equal(calls[3].path, "/admin/promotions/coupons/WELCOME10?organizationId=org-1&shopId=shop-1&mode=hard");
  assert.equal(calls[3].method, "DELETE");
});
