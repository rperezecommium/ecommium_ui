import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const catalog = loadTs("src/modules/catalogo/catalog-taxonomy-schema.ts"),
  payments = loadTs("src/modules/pagos/payment-configuration-schema.ts");
const form = (value) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(value)) f.set(k, String(v));
  return f;
};
test("category and brand creation use distinct canonical fields", () => {
  assert.deepEqual(
    catalog.catalogCreatePayload("categories", {
      name: " C ",
      slug: "c",
      title: "C",
      description: "Descripción",
      keywords: "qa",
      isActive: false,
    }),
    {
      name: "C",
      slug: "c",
      title: "C",
      description: "Descripción",
      keywords: "qa",
      isActive: false,
    },
  );
  const brand = catalog.catalogCreatePayload("brands", {
    name: "Marca",
    text: "Descripción",
    siteTitle: "Título",
    keywords: "qa",
    slug: "must-not-be-sent",
    isActive: false,
  });
  assert.equal("slug" in brand, false);
  assert.equal(brand.siteTitle, "Título");
  assert.throws(
    () =>
      catalog.catalogCreatePayload("categories", {
        name: "C",
        isActive: false,
      }),
    (error) => !!error.fieldErrors.description && !!error.fieldErrors.slug,
  );
});
test("payments reject legacy fields and invalid numeric/range input before BFF", () => {
  assert.throws(
    () =>
      payments.paymentConfigurationPayload(
        "payment-systems",
        form({
          name: "Tarjeta",
          paymentSystemId: "card",
          groupName: "cards",
          methodType: "CREDIT_CARD",
        }),
      ),
    (e) => !!e.fieldErrors.group && !!e.fieldErrors.type,
  );
  assert.throws(
    () =>
      payments.paymentConfigurationPayload(
        "affiliations",
        form({
          name: "PSP",
          affiliationId: "psp",
          provider: "stripe",
          merchantId: "test",
        }),
      ),
    (e) => !!e.fieldErrors.providerName,
  );
  for (const invalid of [
    { priority: "1.5" },
    { minValueMinor: "bad" },
    { minValueMinor: 20, maxValueMinor: 10 },
    { maxValueMinor: -1 },
  ])
    assert.throws(() =>
      payments.paymentConfigurationPayload(
        "rules",
        form({
          ruleId: "r",
          name: "Regla",
          paymentSystemId: "card",
          affiliationId: "psp",
          priority: 1,
          country: "ES",
          currency: "EUR",
          ...invalid,
        }),
      ),
    );
});
test("canonical payloads preserve inactive config and optional installment semantics", () => {
  const system = payments.paymentConfigurationPayload(
    "payment-systems",
    form({
      name: "Card",
      paymentSystemId: "card",
      group: "cards",
      type: "credit-card",
    }),
  );
  assert.equal(system.active, false);
  assert.equal("maxInstallments" in system, false);
  assert.equal("provider" in system, false);
  assert.throws(
    () =>
      payments.paymentConfigurationPayload(
        "payment-systems",
        form({
          name: "Card",
          paymentSystemId: "card",
          group: "cards",
          type: "credit-card",
          supportsInstallments: "on",
        }),
      ),
    (e) => !!e.fieldErrors.maxInstallments,
  );
  const rule = payments.paymentConfigurationPayload(
    "rules",
    form({
      ruleId: "r",
      name: "Regla",
      paymentSystemId: "card",
      affiliationId: "psp",
      priority: 0,
      country: "ES",
      currency: "EUR",
    }),
  );
  assert.equal(rule.minValueMinor, 0);
  assert.equal(rule.maxValueMinor, null);
});
test("creation response must confirm the expected resource identity and canonical fields", () => {
  const good = {
    paymentSystemId: "card",
    name: "Card",
    group: "cards",
    type: "credit-card",
    active: false,
  };
  assert.equal(
    payments.parsePaymentConfiguration("payment-systems", good, "card"),
    good,
  );
  for (const bad of [
    {},
    { ...good, paymentSystemId: "other" },
    { ...good, active: undefined },
  ])
    assert.throws(() =>
      payments.parsePaymentConfiguration("payment-systems", bad, "card"),
    );
});
test("invalid payment form and BFF rejection preserve failure instead of success navigation", async () => {
  let calls = 0;
  const actions = loadTs("src/modules/pagos/payments-admin-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": {
      redirect() {
        throw Error("Unexpected success redirect");
      },
    },
    "../../shared/config/admin-context": {
      getAdminContext: async () => ({ organizationId: "org", shopId: "shop" }),
    },
    "../../shared/bff/admin-client": {
      requestAdminBff: async () => {
        calls++;
        return { ok: false, error: "Conflicto de configuración", status: 409 };
      },
    },
  });
  const invalid = await actions.createPaymentSystemAction(
    form({ name: "Card" }),
  );
  assert.ok(invalid.fieldErrors.group);
  assert.equal(calls, 0);
  const failed = await actions.createPaymentSystemAction(
    form({
      paymentSystemId: "card",
      name: "Card",
      group: "cards",
      type: "credit-card",
    }),
  );
  assert.equal(failed.error, "Conflicto de configuración");
  assert.equal(calls, 1);
});
