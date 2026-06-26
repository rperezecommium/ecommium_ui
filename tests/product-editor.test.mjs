import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const cache = new Map();

function loadTsModule(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (cache.has(absolutePath)) {
    return cache.get(absolutePath);
  }

  const source = readFileSync(absolutePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const commonJsExports = {};
  const dirname = path.dirname(absolutePath);
  const moduleContext = {
    console,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      if (specifier.startsWith(".")) {
        const target = path.resolve(dirname, specifier);
        const tsPath = target.endsWith(".ts") ? target : `${target}.ts`;
        return loadTsModule(path.relative(root, tsPath));
      }

      return awaitImportNotSupported(specifier);
    },
  };

  cache.set(absolutePath, moduleContext.module.exports);
  vm.runInNewContext(outputText, moduleContext);
  cache.set(absolutePath, moduleContext.module.exports);
  return moduleContext.module.exports;
}

function awaitImportNotSupported(specifier) {
  throw new Error(`Unexpected test require: ${specifier}`);
}

const draftModule = loadTsModule("src/modules/catalogo/product-editor-draft.ts");
const productStatusModule = loadTsModule("src/modules/catalogo/product-status.ts");
const validationModule = loadTsModule("src/modules/catalogo/product-editor-validation.ts");
const orchestratorModule = loadTsModule("src/modules/catalogo/product-save-orchestrator.ts");

function validTax() {
  return {
    id: "tax-bike-standard",
    taxCode: "BIKE_STANDARD",
    name: "Bike VAT Included",
    label: "Bike VAT Included (21%)",
    calculationType: "PERCENTAGE",
    rate: 0.21,
    amountMinor: null,
    isCompound: false,
    isActive: true,
    validFrom: "2025-01-01T00:00:00.000Z",
    validUntil: null,
  };
}

test("normalizes product names into slugs and default references", () => {
  assert.equal(draftModule.slugifyProductValue("Lego Halcon Milenario! 2026"), "lego-halcon-milenario-2026");
  assert.equal(draftModule.makeRefIdFromName("Lego Halcon Milenario"), "LEGO_HALCON_MILENARIO");
});

test("hydrates the default variant name from the product base name", () => {
  const draft = draftModule.draftFromProduct(
    {
      productId: "product-1",
      name: "Lata de aceite morgan blue",
      slug: "lata-de-aceite-morgan-blue",
      isActive: false,
      isVisible: true,
      defaultVariantId: "variant-default",
    },
    [
      {
        variantId: "variant-default",
        name: "BBB Cycling Aeffect cockpit integrado HS-804-0305",
        refId: "BBB-HAND-HS-804",
        ean: null,
        options: [],
        isActive: true,
        isVisible: true,
        isDefault: true,
      },
    ],
    "es-ES",
    "EUR",
  );

  assert.equal(draft.defaultVariant.name, "Lata de aceite morgan blue");
});

test("normalizes the default variant name to the product base name before save", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Lata de aceite morgan blue";
  draft.defaultVariant.name = "BBB Cycling Aeffect cockpit integrado HS-804-0305";
  draft.defaultVariant.refId = "MORGAN-BLUE-ACEITE";

  const normalized = validationModule.normalizeProductDraft(draft);

  assert.equal(normalized.defaultVariant.name, "Lata de aceite morgan blue");
});

test("maps product operational status from BFF active fields", () => {
  assert.equal(productStatusModule.productStatusIsActive({ status: "ACTIVE" }), true);
  assert.equal(productStatusModule.productStatusIsActive({ active: true }), true);
  assert.equal(productStatusModule.productStatusIsActive({ publicationStatus: "ONLINE" }), true);
  assert.equal(productStatusModule.productStatusIsActive({ status: "DRAFT" }, true), false);
  assert.equal(productStatusModule.productStatusIsActive({ isActive: false, status: "ACTIVE" }), false);
});

test("builds a safe create payload with inactive product publication", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Lego Halcon Milenario";
  draft.basic.slug = "";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "";
  draft.basic.isActive = true;

  const payload = validationModule.toCreateProductPayload(draft, "es-ES");

  assert.equal(payload.name, "Lego Halcon Milenario");
  assert.equal(payload.slug, "lego-halcon-milenario");
  assert.equal(payload.defaultVariant.refId, "LEGO_HALCON_MILENARIO");
  assert.equal(payload.categoryId, "category-1");
  assert.equal(payload.isActive, false);
});

test("sends the principal reference when updating a product", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Abrazadera ring roja";
  draft.basic.slug = "abrazadera-ring-roja";
  draft.defaultVariant.refId = "ABRAZADERA-RING-ROJA";

  const payload = validationModule.toUpdateProductPayload(draft);

  assert.equal(payload.name, "Abrazadera ring roja");
  assert.equal(payload.refId, "ABRAZADERA-RING-ROJA");
});

test("requires a principal category before saving a product", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Producto sin categoria";
  draft.basic.slug = "producto-sin-categoria";
  draft.defaultVariant.refId = "PRODUCTO-SIN-CATEGORIA";

  const validation = validationModule.validateProductDraft(draft);

  assert.equal(validation.ok, false);
  assert.equal(validation.fieldErrors.categoryId, "La categoria principal es obligatoria antes de guardar.");
});

test("allows persisted legacy variants without options while still requiring options for new variants", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Producto legacy";
  draft.basic.slug = "producto-legacy";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "PRODUCTO-LEGACY";
  draft.mode = "variants";
  draft.variants = [{
    localId: "variant-legacy",
    variantId: "variant-legacy",
    name: "Legacy sin atributos",
    refId: "LEGACY-SIN-ATRIBUTOS",
    ean: null,
    options: [],
    isActive: true,
    isVisible: true,
  }];

  const persistedValidation = validationModule.validateProductDraft(draft);

  assert.equal(persistedValidation.ok, true);

  draft.variants.push({
    localId: "variant-new",
    name: "Nueva sin atributos",
    refId: "NUEVA-SIN-ATRIBUTOS",
    ean: null,
    options: [],
    isActive: true,
    isVisible: true,
  });

  const newValidation = validationModule.validateProductDraft(draft);

  assert.equal(newValidation.ok, false);
  assert.equal(
    newValidation.fieldErrors["variant:variant-new:options"],
    "La variante necesita al menos una opcion comercial.",
  );
});

test("rejects incomplete options on new product variants before sending them to BFF", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Producto con opcion incompleta";
  draft.basic.slug = "producto-con-opcion-incompleta";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "PRODUCTO-OPCION-INCOMPLETA";
  draft.mode = "variants";
  draft.variants = [{
    localId: "variant-new",
    name: "Variante nueva",
    refId: "VARIANTE-NUEVA",
    ean: null,
    options: [{ attributeCode: "color", valueCode: "" }],
    isActive: true,
    isVisible: true,
  }];

  const validation = validationModule.validateProductDraft(draft);

  assert.equal(validation.ok, false);
  assert.equal(
    validation.fieldErrors["variant:variant-new:options"],
    "Completa atributo y valor en cada opcion de la variante.",
  );
});

test("publication checklist requires persisted cover, base price and available stock", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";

  const initialChecklist = validationModule.getProductPublicationChecklist(draft);

  assert.equal(JSON.stringify(initialChecklist.map((item) => [item.id, item.ok])), JSON.stringify([
    ["media", false],
    ["price", false],
    ["stock", false],
  ]));

  draft.media.items = [{
    localId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mediaAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    fileName: "shoe.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
    isMain: true,
    active: true,
    alt: { "es-ES": "Shoe" },
    title: { "es-ES": "Shoe" },
    persisted: true,
  }];
  draft.pricing.productPrice.basePriceMinor = 1099;
  draft.inventory.stockByVariant.default.onHandQuantity = 5;

  const ready = validationModule.validateProductPublicationReadiness(draft);

  assert.equal(ready.ok, true);
});

test("product draft validation requires complete tax for positive prices", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.pricing.productPrice.basePriceMinor = 1099;
  draft.pricing.productPrice.taxCode = "BIKE_STANDARD";
  draft.pricing.productPrice.tax = null;

  const invalid = validationModule.validateProductDraft(draft);

  assert.equal(invalid.ok, false);
  assert.equal(invalid.fieldErrors["pricing.productPrice.tax"], "Selecciona una regla fiscal antes de guardar el precio.");

  draft.pricing.productPrice.tax = validTax();

  const valid = validationModule.validateProductDraft(draft);

  assert.equal(valid.ok, true);
});

test("variant price inherits product tax before validation and save", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.pricing.productPrice.basePriceMinor = 5000;
  draft.pricing.productPrice.taxCode = "BIKE_STANDARD";
  draft.pricing.productPrice.tax = validTax();
  draft.pricing.productPrice.priceTableId = "vip-table";
  draft.pricing.variantPrices["variant-red"] = {
    basePriceMinor: 2200,
    listPriceMinor: null,
    costPriceMinor: null,
    currency: "EUR",
    taxIncluded: true,
    taxCode: "BIKE_STANDARD",
    tax: null,
    priceTableId: null,
    tradePolicy: "default",
    channel: "admin",
    customerGroup: null,
    country: "ES",
  };

  const normalized = validationModule.normalizeProductDraft(draft);
  const validation = validationModule.validateProductDraft(draft);

  assert.equal(validation.ok, true);
  assert.equal(normalized.pricing.variantPrices["variant-red"].tax.taxCode, "BIKE_STANDARD");
  assert.equal(normalized.pricing.variantPrices["variant-red"].tax.calculationType, "PERCENTAGE");
  assert.equal(normalized.pricing.variantPrices["variant-red"].priceTableId, "vip-table");
});

test("specific prices inherit product pricing context before validation and save", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.pricing.productPrice.basePriceMinor = 5000;
  draft.pricing.productPrice.taxCode = "BIKE_STANDARD";
  draft.pricing.productPrice.tax = validTax();
  draft.pricing.productPrice.priceTableId = "vip-table";
  draft.pricing.specificPrices = [{
    targetType: "VARIANT",
    variantKey: "variant-red",
    currency: null,
    country: "",
    customerGroup: "",
    channel: "",
    tradePolicy: "",
    priceTableId: null,
    minQuantity: 0,
    validFrom: "",
    validUntil: "",
    unlimited: true,
    impactType: "FIXED_PRICE",
    fixedPriceMinor: 3999,
    reductionValue: null,
    reductionTaxIncluded: true,
    taxIncluded: undefined,
    tax: null,
    active: true,
    priority: null,
  }];

  const normalized = validationModule.normalizeProductDraft(draft);
  const validation = validationModule.validateProductDraft(draft);
  const specificPrice = normalized.pricing.specificPrices[0];

  assert.equal(validation.ok, true);
  assert.equal(specificPrice.targetType, "VARIANT");
  assert.equal(specificPrice.variantKey, "variant-red");
  assert.equal(specificPrice.currency, "EUR");
  assert.equal(specificPrice.country, null);
  assert.equal(specificPrice.minQuantity, 1);
  assert.equal(specificPrice.priceTableId, "vip-table");
  assert.equal(specificPrice.basePriceMinor, 3999);
  assert.equal(specificPrice.tax.taxCode, "BIKE_STANDARD");
});

test("draftFromEditorData preserves specific prices from editor-state", () => {
  const draft = draftModule.draftFromEditorData({
    product: {
      productId: "product-1",
      name: "Urban Runner",
      slug: "urban-runner",
      isActive: false,
      isVisible: true,
      defaultVariantId: "variant-default",
    },
    variants: [
      {
        variantId: "variant-default",
        name: "Urban Runner",
        refId: "URBAN-RUNNER",
        ean: null,
        options: [],
        isActive: true,
        isVisible: true,
        isDefault: true,
      },
      {
        variantId: "variant-red",
        name: "Urban Runner / Rojo",
        refId: "URBAN-RUNNER-RED",
        ean: null,
        options: [{ attributeCode: "color", valueCode: "red", isActive: true }],
        isActive: true,
        isVisible: true,
        isDefault: false,
      },
    ],
    variantRows: [],
    mediaItems: [],
    mediaAssignments: {},
    mediaMainByVariant: {},
    productPrice: {
      pricingId: "price-base",
      basePriceMinor: 5000,
      listPriceMinor: null,
      costPriceMinor: null,
      currency: "EUR",
      taxIncluded: true,
      taxCode: "BIKE_STANDARD",
      tax: validTax(),
      priceTableId: null,
      tradePolicy: "default",
      channel: "web",
      customerGroup: null,
      country: "ES",
    },
    variantPrices: {},
    specificPrices: [{
      pricingId: "specific-red",
      targetType: "VARIANT",
      productId: "product-1",
      variantId: "variant-red",
      variantKey: "variant-red",
      currency: "EUR",
      country: "ES",
      customerGroup: null,
      channel: "web",
      tradePolicy: "default",
      priceTableId: null,
      minQuantity: 2,
      validFrom: "2026-06-26T00:00:00.000Z",
      validUntil: null,
      unlimited: true,
      impactType: "FIXED_PRICE",
      basePriceMinor: 5000,
      fixedPriceMinor: 3999,
      reductionValue: null,
      reductionTaxIncluded: true,
      taxIncluded: true,
      tax: validTax(),
      active: true,
      priority: 100,
    }],
    offeringsByVariant: {},
    stockByVariant: {},
    warnings: [],
    correlationIds: [],
  }, "es-ES", "EUR");

  assert.equal(draft.pricing.specificPrices.length, 1);
  assert.equal(draft.pricing.specificPrices[0].pricingId, "specific-red");
  assert.equal(draft.pricing.specificPrices[0].variantKey, "variant-red");
  assert.equal(draft.variants[0].variantId, "variant-red");
});

test("restores persisted variant media preview from fresh editor state after reload", () => {
  const mediaAssetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const initialDraft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  initialDraft.productId = "product-1";
  initialDraft.media.items = [{
    localId: mediaAssetId,
    mediaAssetId,
    fileName: "variant-blue.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
    previewUrl: "https://cdn.example.test/variant-blue-medium.jpg",
    isMain: false,
    active: true,
    alt: { "es-ES": "Variante azul" },
    title: { "es-ES": "Variante azul" },
    persisted: true,
  }];
  initialDraft.media.assignments["variant-blue"] = [mediaAssetId];
  initialDraft.media.mainByVariant["variant-blue"] = mediaAssetId;

  const storedDraft = draftModule.sanitizeDraftForStorage({
    ...initialDraft,
    media: {
      ...initialDraft.media,
      items: [{
        ...initialDraft.media.items[0],
        previewUrl: undefined,
      }],
    },
  });

  const restored = draftModule.mergeStoredProductDraft(initialDraft, storedDraft);

  assert.equal(restored.media.assignments["variant-blue"][0], mediaAssetId);
  assert.equal(restored.media.mainByVariant["variant-blue"], mediaAssetId);
  assert.equal(
    restored.media.items.find((item) => item.mediaAssetId === mediaAssetId)?.previewUrl,
    "https://cdn.example.test/variant-blue-medium.jpg",
  );
});

test("keeps rich HTML in product summary and description payloads", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Producto rich text";
  draft.basic.slug = "producto-rich-text";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "PRODUCTO-RICH";
  draft.basic.shortDescription = "<p><strong>Resumen</strong> corto</p>";
  draft.basic.description = "<section><h2>Detalle</h2><p>Contenido <em>enriquecido</em></p></section>";

  const payload = validationModule.toCreateProductPayload(draft, "es-ES");

  assert.equal(payload.shortDescription, "<p><strong>Resumen</strong> corto</p>");
  assert.equal(payload.description, "<section><h2>Detalle</h2><p>Contenido <em>enriquecido</em></p></section>");
});

test("includes product shipping metadata in catalog create and update payloads", () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Producto transportable";
  draft.basic.slug = "producto-transportable";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "PRODUCTO-TRANSPORTABLE";
  draft.shipping.package.weightGrams = 450;
  draft.shipping.package.widthMm = 120;
  draft.shipping.package.heightMm = 80;
  draft.shipping.package.depthMm = 60;
  draft.shipping.additionalShippingCostMinor = 299;
  draft.shipping.allowedCarrierIds = ["carrier-bike", "carrier-express"];
  draft.shipping.deliveryTimeMode = "specific";
  draft.shipping.deliveryTimeNotes.inStock["es-ES"] = "Entrega en 24h";

  const createPayload = validationModule.toCreateProductPayload(draft, "es-ES");
  const updatePayload = validationModule.toUpdateProductPayload(draft);

  assert.equal(createPayload.shipping.package.weightGrams, 450);
  assert.equal(createPayload.shipping.additionalShippingCostMinor, 299);
  assert.equal(JSON.stringify(createPayload.shipping.allowedCarrierIds), JSON.stringify(["carrier-bike", "carrier-express"]));
  assert.equal(createPayload.shipping.deliveryTimeNotes.inStock["es-ES"], "Entrega en 24h");
  assert.equal(JSON.stringify(updatePayload.shipping), JSON.stringify(createPayload.shipping));
});

test("save orchestrator creates catalog first and keeps later blocks independent", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.pricing.productPrice.basePriceMinor = 1099;
  draft.pricing.productPrice.taxCode = "BIKE_STANDARD";
  draft.pricing.productPrice.tax = validTax();
  draft.inventory.stockByVariant.default.onHandQuantity = 5;

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct(payload) {
      calls.push(["createProduct", payload.name]);
      return ok({
        productId: "product-1",
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        mediaCollectionId: null,
      }, "corr-create");
    },
    async updateProduct() {
      throw new Error("updateProduct should not run");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([{
        variantId: "variant-1",
        name: "Urban Runner",
        refId: "URBAN-RUNNER",
        ean: null,
        isActive: true,
        isVisible: true,
        isDefault: true,
      }], "corr-variants");
    },
    async createVariant() {
      throw new Error("createVariant should not run for simple products");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run for simple products");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run without files");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run without files");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run without media");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run without media assignments");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run without media assignments");
    },
    async createProductPrice(input) {
      calls.push(["createProductPrice", input.productId, input.price.basePriceMinor]);
      return ok({ pricingId: "price-1" }, "corr-price");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run for new product price");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run for simple products");
    },
    async putStockLevel(input) {
      calls.push(["putStockLevel", input.variantId, input.stock.onHandQuantity]);
      return ok({ updatedAt: "2026-06-17T00:00:00.000Z" }, "corr-stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, true);
  assert.equal(report.productId, "product-1");
  assert.equal(report.defaultVariantId, "variant-1");
  assert.equal(report.blocks.catalog, "success");
  assert.equal(report.blocks.shipping, "success");
  assert.equal(report.blocks.pricing, "success");
  assert.equal(report.blocks.inventory, "success");
  assert.deepEqual(calls, [
    ["createProduct", "Urban Runner"],
    ["listVariants", "product-1"],
    ["createProductPrice", "product-1", 1099],
    ["putStockLevel", "variant-1", 5],
  ]);
});

test("save orchestrator persists combination media, variant price overrides and stock independently", async () => {
  const calls = [];
  const mediaAssetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.mode = "variants";
  draft.media.items = [{
    localId: mediaAssetId,
    mediaAssetId,
    fileName: "shoe-blue.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
    isMain: true,
    active: true,
    alt: { "es-ES": "Shoe blue" },
    title: { "es-ES": "Shoe blue" },
    persisted: true,
  }];
  draft.variants = [{
    localId: "variant-local-blue-42",
    name: "Urban Runner / Azul / 42",
    refId: "URBAN-RUNNER-BLUE-42",
    ean: null,
    options: [
      { attributeCode: "color", valueCode: "blue" },
      { attributeCode: "size", valueCode: "42" },
    ],
    isActive: true,
    isVisible: true,
  }];
  draft.media.assignments["variant-local-blue-42"] = [mediaAssetId];
  draft.media.mainByVariant["variant-local-blue-42"] = mediaAssetId;
  draft.pricing.variantPrices["variant-local-blue-42"] = {
    basePriceMinor: 1299,
    listPriceMinor: null,
    costPriceMinor: null,
    currency: "EUR",
    taxIncluded: true,
    taxCode: "BIKE_STANDARD",
    tax: validTax(),
  };
  draft.inventory.stockByVariant["variant-local-blue-42"] = {
    warehouseId: "main-warehouse",
    onHandQuantity: 7,
    reservedQuantity: 0,
    safetyStockQuantity: 1,
  };

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  let variantCreated = false;
  const gateway = {
    async createProduct(payload) {
      calls.push(["createProduct", payload.name]);
      return ok({
        productId: "product-1",
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        mediaCollectionId: "collection-1",
        defaultVariantId: "variant-default",
      }, "corr-create");
    },
    async updateProduct() {
      throw new Error("updateProduct should not run");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId, variantCreated]);
      return ok([
        {
          variantId: "variant-default",
          name: "Urban Runner",
          refId: "URBAN-RUNNER",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: true,
        },
        ...(variantCreated ? [{
          variantId: "variant-blue-42",
          name: "Urban Runner / Azul / 42",
          refId: "URBAN-RUNNER-BLUE-42",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: false,
        }] : []),
      ], "corr-variants");
    },
    async createVariant(productId, payload) {
      calls.push(["createVariant", productId, payload.refId]);
      variantCreated = true;
      return ok({
        variantId: "variant-blue-42",
        name: payload.name,
        refId: payload.refId,
        ean: null,
        isActive: true,
        isVisible: true,
        isDefault: false,
      }, "corr-create-variant");
    },
    async createVariantOption(variantId, payload) {
      calls.push(["createVariantOption", variantId, payload.attributeCode, payload.valueCode]);
      return ok({ id: `${payload.attributeCode}-${payload.valueCode}` }, "corr-option");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run for persisted media");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run for persisted media");
    },
    async assignVariantMedia(input) {
      calls.push(["assignVariantMedia", input.variantId, input.mediaAssetIds, input.mainMediaAssetId]);
      return ok({ assigned: true }, "corr-variant-media");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run when media is assigned");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run directly");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run without base product price");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run for new variant override");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice(input) {
      calls.push(["createVariantPrice", input.variantId, input.price.basePriceMinor]);
      return ok({ pricingId: "price-variant-1" }, "corr-variant-price");
    },
    async putStockLevel(input) {
      calls.push(["putStockLevel", input.variantId, input.stock.onHandQuantity]);
      return ok({ updatedAt: "2026-06-17T00:00:00.000Z" }, "corr-stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, true);
  assert.equal(report.blocks.variants, "success");
  assert.equal(report.blocks.variantMedia, "success");
  assert.equal(report.blocks.pricing, "success");
  assert.equal(report.blocks.inventory, "success");
  assert.equal(report.draftPatch.variants[0].variantId, "variant-blue-42");
  assert.deepEqual(calls, [
    ["createProduct", "Urban Runner"],
    ["listVariants", "product-1", false],
    ["createVariant", "product-1", "URBAN-RUNNER-BLUE-42"],
    ["createVariantOption", "variant-blue-42", "color", "blue"],
    ["createVariantOption", "variant-blue-42", "size", "42"],
    ["listVariants", "product-1", true],
    ["assignVariantMedia", "variant-blue-42", [mediaAssetId], mediaAssetId],
    ["createVariantPrice", "variant-blue-42", 1299],
    ["putStockLevel", "variant-blue-42", 7],
  ]);
});

test("save orchestrator reports variant media errors before sending local image ids to Catalog", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.productId = "product-1";
  draft.defaultVariantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.mode = "variants";
  draft.media.items = [{
    localId: "media-local-1",
    fileName: "shoe-blue.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
    isMain: true,
    active: true,
    alt: { "es-ES": "Shoe blue" },
    title: { "es-ES": "Shoe blue" },
    persisted: false,
  }];
  draft.variants = [{
    localId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    variantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Urban Runner / Azul / 42",
    refId: "URBAN-RUNNER-BLUE-42",
    ean: null,
    options: [{ attributeCode: "color", valueCode: "blue" }],
    isActive: true,
    isVisible: true,
  }];
  draft.media.assignments["cccccccc-cccc-4ccc-8ccc-cccccccccccc"] = ["media-local-1"];
  draft.media.mainByVariant["cccccccc-cccc-4ccc-8ccc-cccccccccccc"] = "media-local-1";

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct() {
      throw new Error("createProduct should not run for existing products");
    },
    async updateProduct(productId, payload) {
      calls.push(["updateProduct", productId, payload.name]);
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }, "corr-product");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([
        {
          variantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Urban Runner",
          refId: "URBAN-RUNNER",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: true,
        },
        {
          variantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          name: "Urban Runner / Azul / 42",
          refId: "URBAN-RUNNER-BLUE-42",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: false,
        },
      ], "corr-variants");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant() {
      return ok({}, "corr-update-variant");
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run without files");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run without files");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not receive local media ids");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run for unresolved media");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run");
    },
    async putStockLevel() {
      return ok({ updatedAt: "2026-06-17T00:00:00.000Z" }, "corr-stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, false);
  assert.equal(report.blocks.variantMedia, "failed");
  assert.match(
    report.fieldErrors["media:cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    /mediaAssetId valido/,
  );
  assert.deepEqual(calls, [
    ["updateProduct", "product-1", "Urban Runner"],
    ["listVariants", "product-1"],
    ["listVariants", "product-1"],
  ]);
});

test("save orchestrator updates persisted default and product variants", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.productId = "product-1";
  draft.defaultVariantId = "variant-default";
  draft.basic.name = "Urban Runner Updated";
  draft.basic.slug = "urban-runner-updated";
  draft.basic.categoryId = "category-1";
  draft.basic.isActive = false;
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.defaultVariant.ean = "8430000000001";
  draft.mode = "variants";
  draft.variants = [{
    localId: "variant-red-42",
    variantId: "variant-red-42",
    name: "Urban Runner / Rojo / 42",
    refId: "URBAN-RUNNER-RED-42",
    ean: "8430000000042",
    options: [
      { attributeCode: "color", valueCode: "red" },
      { attributeCode: "size", valueCode: "42" },
    ],
    isActive: false,
    isVisible: true,
  }];
  draft.inventory.stockByVariant["variant-red-42"] = {
    warehouseId: "main-warehouse",
    onHandQuantity: 3,
    reservedQuantity: 0,
    safetyStockQuantity: 0,
  };

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct() {
      throw new Error("createProduct should not run for existing products");
    },
    async updateProduct(productId, payload) {
      calls.push(["updateProduct", productId, payload.name, payload.isActive]);
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-update-product");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([
        {
          variantId: "variant-default",
          name: "Urban Runner Updated",
          refId: "URBAN-RUNNER",
          ean: "8430000000001",
          isActive: true,
          isVisible: true,
          isDefault: true,
        },
        {
          variantId: "variant-red-42",
          name: "Urban Runner / Rojo / 42",
          refId: "URBAN-RUNNER-RED-42",
          ean: "8430000000042",
          isActive: false,
          isVisible: true,
          isDefault: false,
        },
      ], "corr-list-variants");
    },
    async createVariant() {
      throw new Error("createVariant should not run for persisted variants");
    },
    async updateVariant(variantId, payload) {
      calls.push(["updateVariant", variantId, payload.refId, payload.ean, payload.isActive]);
      return ok({
        variantId,
        name: payload.name,
        refId: payload.refId,
        ean: payload.ean,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        isDefault: variantId === "variant-default",
      }, `corr-update-${variantId}`);
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run during save");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run for persisted variants");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run without files");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run without files");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run without assignments");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run without assignments");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run without assignments");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run without positive product price");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run without price IDs");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run without variant price");
    },
    async createOffering() {
      throw new Error("createOffering should not run during save");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run during save");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run during save");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run during save");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run during save");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run during save");
    },
    async putStockLevel(input) {
      calls.push(["putStockLevel", input.variantId, input.stock.onHandQuantity]);
      return ok({ updatedAt: "2026-06-17T00:00:00.000Z" }, "corr-stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, true);
  assert.equal(report.blocks.variants, "success");
  assert.deepEqual(calls, [
    ["updateProduct", "product-1", "Urban Runner Updated", false],
    ["listVariants", "product-1"],
    ["updateVariant", "variant-default", "URBAN-RUNNER", "8430000000001", false],
    ["updateVariant", "variant-red-42", "URBAN-RUNNER-RED-42", "8430000000042", false],
    ["listVariants", "product-1"],
    ["putStockLevel", "variant-red-42", 3],
  ]);
});

test("save orchestrator syncs persisted product variant options", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.productId = "product-1";
  draft.defaultVariantId = "variant-default";
  draft.basic.name = "Cable de freno";
  draft.basic.slug = "cable-de-freno";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "CABLE-FRENO";
  draft.mode = "variants";
  draft.variants = [{
    localId: "variant-double",
    variantId: "variant-double",
    name: "Cable de freno Accion Doble",
    refId: "CABLE-FRENO-DOBLE",
    ean: "8430000001111",
    options: [
      { variantOptionId: "option-color", attributeCode: "color", valueCode: "negro", isActive: true },
      { variantOptionId: "option-length", attributeCode: "longitud", valueCode: "1-metro", isActive: false, markedForDeletion: true },
      { attributeCode: "material", valueCode: "acero", isActive: true, createdInDraft: true },
    ],
    isActive: true,
    isVisible: true,
  }];

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct() {
      throw new Error("createProduct should not run");
    },
    async updateProduct(productId, payload) {
      calls.push(["updateProduct", productId, payload.name]);
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-product");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([
        {
          variantId: "variant-default",
          name: "Cable de freno",
          refId: "CABLE-FRENO",
          ean: null,
          isActive: false,
          isVisible: true,
          isDefault: true,
        },
        {
          variantId: "variant-double",
          name: "Cable de freno Accion Doble",
          refId: "CABLE-FRENO-DOBLE",
          ean: "8430000001111",
          isActive: true,
          isVisible: true,
          isDefault: false,
        },
      ], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant(variantId, payload) {
      calls.push(["updateVariant", variantId, payload.refId]);
      return ok({
        variantId,
        name: payload.name,
        refId: payload.refId,
        ean: payload.ean,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        isDefault: variantId === "variant-default",
      }, `corr-update-${variantId}`);
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption(variantId, payload) {
      calls.push(["createVariantOption", variantId, payload.attributeCode, payload.valueCode, payload.isActive]);
      return ok({ variantOptionId: "option-material", variantId, ...payload }, "corr-create-option");
    },
    async updateVariantOption(variantId, variantOptionId, payload) {
      calls.push(["updateVariantOption", variantId, variantOptionId, payload.attributeCode, payload.valueCode, payload.isActive]);
      return ok({ variantOptionId, variantId, ...payload }, "corr-update-option");
    },
    async deleteVariantOption(variantId, variantOptionId) {
      calls.push(["deleteVariantOption", variantId, variantOptionId]);
      return ok({ variantOptionId, deleted: true }, "corr-delete-option");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run");
    },
    async putStockLevel() {
      throw new Error("putStockLevel should not run without stock changes");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, true);
  assert.equal(report.blocks.variants, "success");
  assert.deepEqual(calls, [
    ["updateProduct", "product-1", "Cable de freno"],
    ["listVariants", "product-1"],
    ["updateVariant", "variant-default", "CABLE-FRENO"],
    ["updateVariant", "variant-double", "CABLE-FRENO-DOBLE"],
    ["updateVariantOption", "variant-double", "option-color", "color", "negro", true],
    ["deleteVariantOption", "variant-double", "option-length"],
    ["createVariantOption", "variant-double", "material", "acero", true],
    ["listVariants", "product-1"],
  ]);
});

test("save orchestrator keeps activation requests offline when commercial minimums are missing", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.productId = "product-1";
  draft.defaultVariantId = "variant-default";
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.basic.isActive = true;
  draft.defaultVariant.refId = "URBAN-RUNNER";

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct() {
      throw new Error("createProduct should not run for existing products");
    },
    async updateProduct(productId, payload) {
      calls.push(["updateProduct", productId, payload.isActive]);
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, `corr-product-${payload.isActive}`);
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([{
        variantId: "variant-default",
        name: "Urban Runner",
        refId: "URBAN-RUNNER",
        ean: null,
        isActive: false,
        isVisible: true,
        isDefault: true,
      }], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant(variantId, payload) {
      calls.push(["updateVariant", variantId, payload.isActive]);
      return ok({
        variantId,
        name: payload.name,
        refId: payload.refId,
        ean: payload.ean,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        isDefault: true,
      }, "corr-variant");
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run without files");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run without files");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run without media");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run without positive product price");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run");
    },
    async putStockLevel() {
      throw new Error("putStockLevel should not run without configured stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, false);
  assert.equal(report.blocks.catalog, "success");
  assert.equal(report.fieldErrors.publication, "No se puede activar todavia.");
  assert.equal(report.draftPatch.basic.isActive, false);
  assert.deepEqual(calls, [
    ["updateProduct", "product-1", false],
    ["listVariants", "product-1"],
    ["updateVariant", "variant-default", false],
    ["listVariants", "product-1"],
  ]);
});

test("save orchestrator activates a new product only after media price and stock are persisted", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.basic.isActive = true;
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.media.items = [{
    localId: "media-local-1",
    fileName: "shoe.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
    isMain: true,
    active: true,
    alt: { "es-ES": "Shoe" },
    title: { "es-ES": "Shoe" },
    persisted: false,
  }];
  draft.pricing.productPrice.basePriceMinor = 1099;
  draft.pricing.productPrice.taxCode = "BIKE_STANDARD";
  draft.pricing.productPrice.tax = validTax();
  draft.inventory.stockByVariant.default.onHandQuantity = 5;

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct(payload) {
      calls.push(["createProduct", payload.isActive]);
      return ok({
        productId: "product-1",
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-create");
    },
    async updateProduct(productId, payload) {
      calls.push(["updateProduct", productId, payload.isActive]);
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-activate-product");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([{
        variantId: "variant-default",
        name: "Urban Runner",
        refId: "URBAN-RUNNER",
        ean: null,
        isActive: false,
        isVisible: true,
        isDefault: true,
      }], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run for simple products");
    },
    async updateVariant(variantId, payload) {
      calls.push(["updateVariant", variantId, payload.isActive]);
      return ok({
        variantId,
        name: payload.name,
        refId: payload.refId,
        ean: payload.ean,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        isDefault: true,
      }, "corr-activate-variant");
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async createMediaCollection(input) {
      calls.push(["createMediaCollection", input.productId, input.files.length]);
      return ok({
        mediaCollectionId: "collection-1",
        mediaAssetIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      }, "corr-media");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run for new collection");
    },
    async assignVariantMedia(input) {
      calls.push(["assignVariantMedia", input.variantId, input.mediaAssetIds, input.mainMediaAssetId]);
      return ok({ assigned: true }, "corr-variant-media");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice(input) {
      calls.push(["createProductPrice", input.productId, input.price.basePriceMinor]);
      return ok({ pricingId: "price-1" }, "corr-price");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run for simple products");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run");
    },
    async putStockLevel(input) {
      calls.push(["putStockLevel", input.variantId, input.stock.onHandQuantity]);
      return ok({
        warehouseId: input.stock.warehouseId,
        onHandQuantity: input.stock.onHandQuantity,
        reservedQuantity: 0,
        safetyStockQuantity: 0,
        availableQuantity: 5,
        available: true,
      }, "corr-stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
    files: [{ name: "shoe.jpg" }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.draftPatch.basic.isActive, true);
  assert.deepEqual(calls, [
    ["createProduct", false],
    ["listVariants", "product-1"],
    ["createMediaCollection", "product-1", 1],
    ["assignVariantMedia", "variant-default", ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"], "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ["createProductPrice", "product-1", 1099],
    ["putStockLevel", "variant-default", 5],
    ["updateVariant", "variant-default", true],
    ["updateProduct", "product-1", true],
  ]);
});

test("save orchestrator uploads media files matched by local id", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.media.items = [
    {
      localId: "media-local-cover",
      fileName: "cover.jpg",
      fileSize: 100,
      mimeType: "image/jpeg",
      isMain: true,
      active: true,
      alt: { "es-ES": "Cover" },
      title: { "es-ES": "Cover" },
      persisted: false,
    },
    {
      localId: "media-local-side",
      fileName: "side.jpg",
      fileSize: 100,
      mimeType: "image/jpeg",
      isMain: false,
      active: true,
      alt: { "es-ES": "Side" },
      title: { "es-ES": "Side" },
      persisted: false,
    },
  ];

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct(payload) {
      calls.push(["createProduct", payload.name]);
      return ok({
        productId: "product-1",
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-create");
    },
    async updateProduct() {
      throw new Error("updateProduct should not run");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([{
        variantId: "variant-default",
        name: "Urban Runner",
        refId: "URBAN-RUNNER",
        ean: null,
        isActive: false,
        isVisible: true,
        isDefault: true,
      }], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant() {
      throw new Error("updateVariant should not run");
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async createMediaCollection(input) {
      calls.push([
        "createMediaCollection",
        input.files.map((file) => file.name),
        input.metadata.map((item) => item.localId),
      ]);
      return ok({
        mediaCollectionId: "collection-1",
        mediaAssetIds: [
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ],
      }, "corr-media");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run for new collection");
    },
    async assignVariantMedia(input) {
      calls.push(["assignVariantMedia", input.variantId, input.mediaAssetIds, input.mainMediaAssetId]);
      return ok({ assigned: true }, "corr-variant-media");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run");
    },
    async putStockLevel() {
      throw new Error("putStockLevel should not run");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
    mediaFiles: [
      { localId: "media-local-side", file: { name: "side.jpg" } },
      { localId: "media-local-cover", file: { name: "cover.jpg" } },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.blocks.media, "success");
  assert.deepEqual(report.draftPatch.media.items.map((item) => item.mediaAssetId), [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ]);
  assert.deepEqual(calls, [
    ["createProduct", "Urban Runner"],
    ["listVariants", "product-1"],
    [
      "createMediaCollection",
      ["cover.jpg", "side.jpg"],
      ["media-local-cover", "media-local-side"],
    ],
    [
      "assignVariantMedia",
      "variant-default",
      ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ],
  ]);
});

test("save orchestrator skips media upload when a pending item has no local file", async () => {
  const calls = [];
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.media.items = [
    {
      localId: "media-local-cover",
      fileName: "cover.jpg",
      fileSize: 100,
      mimeType: "image/jpeg",
      isMain: true,
      active: true,
      alt: { "es-ES": "Cover" },
      title: { "es-ES": "Cover" },
      persisted: false,
    },
    {
      localId: "media-local-side",
      fileName: "side.jpg",
      fileSize: 100,
      mimeType: "image/jpeg",
      isMain: false,
      active: true,
      alt: { "es-ES": "Side" },
      title: { "es-ES": "Side" },
      persisted: false,
    },
  ];

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct(payload) {
      calls.push(["createProduct", payload.name]);
      return ok({
        productId: "product-1",
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-create");
    },
    async updateProduct() {
      throw new Error("updateProduct should not run");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants(productId) {
      calls.push(["listVariants", productId]);
      return ok([{
        variantId: "variant-default",
        name: "Urban Runner",
        refId: "URBAN-RUNNER",
        ean: null,
        isActive: false,
        isVisible: true,
        isDefault: true,
      }], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant() {
      throw new Error("updateVariant should not run");
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run with missing files");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run with missing files");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run without uploaded media");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run");
    },
    async putStockLevel() {
      throw new Error("putStockLevel should not run");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
    mediaFiles: [
      { localId: "media-local-cover", file: { name: "cover.jpg" } },
    ],
  });

  assert.equal(report.blocks.media, "skipped");
  assert.equal(report.blocks.variantMedia, "skipped");
  assert.equal(report.fieldErrors.media, "Hay imagenes nuevas sin archivo local asociado. Vuelve a seleccionarlas y guarda de nuevo.");
  assert.deepEqual(calls, [
    ["createProduct", "Urban Runner"],
    ["listVariants", "product-1"],
  ]);
});

test("save orchestrator reports row errors when a persisted variant update fails", async () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.productId = "product-1";
  draft.defaultVariantId = "variant-default";
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.mode = "variants";
  draft.variants = [{
    localId: "variant-red-42",
    variantId: "variant-red-42",
    name: "Urban Runner / Rojo / 42",
    refId: "URBAN-RUNNER-RED-42",
    ean: null,
    options: [{ attributeCode: "color", valueCode: "red" }],
    isActive: true,
    isVisible: true,
  }];

  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct() {
      throw new Error("createProduct should not run");
    },
    async updateProduct(productId, payload) {
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-update-product");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants() {
      return ok([
        {
          variantId: "variant-default",
          name: "Urban Runner",
          refId: "URBAN-RUNNER",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: true,
        },
        {
          variantId: "variant-red-42",
          name: "Urban Runner / Rojo / 42",
          refId: "URBAN-RUNNER-RED-42",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: false,
        },
      ], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant(variantId) {
      if (variantId === "variant-red-42") {
        return { ok: false, error: "refId already exists", status: 409, correlationId: "corr-variant-fail" };
      }

      return ok({
        variantId,
        name: "Urban Runner",
        refId: "URBAN-RUNNER",
        ean: null,
        isActive: true,
        isVisible: true,
        isDefault: true,
      }, "corr-default");
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run during save");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      throw new Error("listOfferingsByVariant should not run");
    },
    async resolveOfferingsBatchByVariants() {
      throw new Error("resolveOfferingsBatchByVariants should not run");
    },
    async putStockLevel() {
      return ok({ updatedAt: "2026-06-17T00:00:00.000Z" }, "corr-stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, false);
  assert.equal(report.blocks.variants, "failed");
  assert.equal(report.fieldErrors["variant:variant-red-42"], "refId already exists");
  assert.ok(report.messages.includes("Producto guardado, pero fallo la variante URBAN-RUNNER-RED-42."));
});

test("save orchestrator deletes removed media after clearing variant assignments", async () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.productId = "product-1";
  draft.defaultVariantId = "variant-default";
  draft.mediaCollectionId = "collection-1";
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.mode = "variants";
  draft.media.items = [{
    localId: "media-cover",
    mediaAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    fileName: "cover.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
    previewUrl: "/cover.jpg",
    isMain: true,
    active: true,
    persisted: true,
    alt: { "es-ES": "Cover" },
    title: { "es-ES": "Cover" },
  }];
  draft.media.removedItems = [{
    localId: "media-red",
    mediaAssetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    fileName: "red.jpg",
    fileSize: 100,
    mimeType: "image/jpeg",
    previewUrl: "/red.jpg",
    isMain: false,
    active: true,
    persisted: true,
    alt: { "es-ES": "Red" },
    title: { "es-ES": "Red" },
  }];
  draft.media.assignments["variant-red-42"] = [];
  draft.variants = [{
    localId: "variant-red-42",
    variantId: "variant-red-42",
    name: "Urban Runner / Rojo / 42",
    refId: "URBAN-RUNNER-RED-42",
    ean: null,
    options: [{ attributeCode: "color", valueCode: "red" }],
    isActive: true,
    isVisible: true,
  }];

  const calls = [];
  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct() {
      throw new Error("createProduct should not run");
    },
    async updateProduct(productId, payload) {
      calls.push(["updateProduct", productId]);
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-update-product");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants() {
      calls.push(["listVariants"]);
      return ok([
        {
          variantId: "variant-default",
          name: "Urban Runner",
          refId: "URBAN-RUNNER",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: true,
        },
        {
          variantId: "variant-red-42",
          name: "Urban Runner / Rojo / 42",
          refId: "URBAN-RUNNER-RED-42",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: false,
        },
      ], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant(variantId) {
      calls.push(["updateVariant", variantId]);
      return ok({
        variantId,
        name: "Urban Runner",
        refId: variantId === "variant-red-42" ? "URBAN-RUNNER-RED-42" : "URBAN-RUNNER",
        ean: null,
        isActive: true,
        isVisible: true,
        isDefault: variantId === "variant-default",
      }, `corr-${variantId}`);
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async updateVariantOption() {
      throw new Error("updateVariantOption should not run");
    },
    async deleteVariantOption() {
      throw new Error("deleteVariantOption should not run");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run");
    },
    async deleteMediaItem(input) {
      calls.push(["deleteMediaItem", input.mediaCollectionId, input.mediaAssetId]);
      return ok({ deleted: true }, "corr-delete-media");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run");
    },
    async clearVariantMedia(input) {
      calls.push(["clearVariantMedia", input.variantId]);
      return ok({ cleared: 1 }, "corr-clear-media");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      return ok([], "corr-offerings");
    },
    async resolveOfferingsBatchByVariants() {
      return ok({}, "corr-offerings-batch");
    },
    async putStockLevel() {
      throw new Error("putStockLevel should not run");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, true);
  assert.equal(report.blocks.variantMedia, "success");
  assert.equal(report.blocks.media, "success");
  assert.equal(report.draftPatch.media.removedItems.length, 0);
  assert.equal(JSON.stringify(calls.filter((call) => call[0] === "clearVariantMedia" || call[0] === "deleteMediaItem")), JSON.stringify([
    ["clearVariantMedia", "variant-red-42"],
    ["deleteMediaItem", "collection-1", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  ]));
});

test("save orchestrator does not materialize inherited default stock on variants", async () => {
  const draft = draftModule.createEmptyProductDraft("es-ES", "EUR");
  draft.productId = "product-1";
  draft.defaultVariantId = "variant-default";
  draft.basic.name = "Urban Runner";
  draft.basic.slug = "urban-runner";
  draft.basic.categoryId = "category-1";
  draft.defaultVariant.refId = "URBAN-RUNNER";
  draft.mode = "variants";
  draft.inventory.stockByVariant.default.onHandQuantity = 10;
  draft.variants = [{
    localId: "variant-blue-42",
    variantId: "variant-blue-42",
    name: "Urban Runner / Azul / 42",
    refId: "URBAN-RUNNER-BLUE-42",
    ean: null,
    options: [{ attributeCode: "color", valueCode: "blue" }],
    isActive: true,
    isVisible: true,
  }];

  const calls = [];
  const ok = (data, correlationId) => ({ ok: true, data, status: 200, correlationId });
  const gateway = {
    async createProduct() {
      throw new Error("createProduct should not run");
    },
    async updateProduct(productId, payload) {
      calls.push(["updateProduct", productId]);
      return ok({
        productId,
        name: payload.name,
        slug: payload.slug,
        isActive: payload.isActive,
        isVisible: payload.isVisible,
        defaultVariantId: "variant-default",
      }, "corr-update-product");
    },
    async getProduct() {
      throw new Error("getProduct should not run");
    },
    async listVariants() {
      calls.push(["listVariants"]);
      return ok([
        {
          variantId: "variant-default",
          name: "Urban Runner",
          refId: "URBAN-RUNNER",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: true,
        },
        {
          variantId: "variant-blue-42",
          name: "Urban Runner / Azul / 42",
          refId: "URBAN-RUNNER-BLUE-42",
          ean: null,
          isActive: true,
          isVisible: true,
          isDefault: false,
        },
      ], "corr-list");
    },
    async createVariant() {
      throw new Error("createVariant should not run");
    },
    async updateVariant(variantId) {
      calls.push(["updateVariant", variantId]);
      return ok({
        variantId,
        name: "Urban Runner",
        refId: variantId === "variant-blue-42" ? "URBAN-RUNNER-BLUE-42" : "URBAN-RUNNER",
        ean: null,
        isActive: true,
        isVisible: true,
        isDefault: variantId === "variant-default",
      }, `corr-${variantId}`);
    },
    async deleteVariant() {
      throw new Error("deleteVariant should not run");
    },
    async createVariantOption() {
      throw new Error("createVariantOption should not run");
    },
    async updateVariantOption() {
      throw new Error("updateVariantOption should not run");
    },
    async deleteVariantOption() {
      throw new Error("deleteVariantOption should not run");
    },
    async createMediaCollection() {
      throw new Error("createMediaCollection should not run");
    },
    async appendMediaItems() {
      throw new Error("appendMediaItems should not run");
    },
    async deleteMediaItem() {
      throw new Error("deleteMediaItem should not run");
    },
    async assignVariantMedia() {
      throw new Error("assignVariantMedia should not run");
    },
    async clearVariantMedia() {
      throw new Error("clearVariantMedia should not run");
    },
    async setVariantMainMedia() {
      throw new Error("setVariantMainMedia should not run");
    },
    async createProductPrice() {
      throw new Error("createProductPrice should not run");
    },
    async updatePrice() {
      throw new Error("updatePrice should not run");
    },
    async deletePrice() {
      throw new Error("deletePrice should not run");
    },
    async createVariantPrice() {
      throw new Error("createVariantPrice should not run");
    },
    async createOffering() {
      throw new Error("createOffering should not run");
    },
    async attachOfferingToVariant() {
      throw new Error("attachOfferingToVariant should not run");
    },
    async detachOfferingFromVariant() {
      throw new Error("detachOfferingFromVariant should not run");
    },
    async setOfferingVariantActivation() {
      throw new Error("setOfferingVariantActivation should not run");
    },
    async listOfferingsByVariant() {
      return ok([], "corr-offerings");
    },
    async resolveOfferingsBatchByVariants() {
      return ok({}, "corr-offerings-batch");
    },
    async putStockLevel(input) {
      calls.push(["putStockLevel", input.variantId, input.stock.onHandQuantity]);
      return ok({ updatedAt: "2026-06-17T00:00:00.000Z" }, "corr-stock");
    },
  };

  const report = await orchestratorModule.saveProductDraft({
    draft,
    context: {
      organizationId: "org-1",
      shopId: "shop-1",
      shopAlias: "main",
      shopName: "Main",
      primaryDomain: "",
      shopStatus: "ACTIVE",
      locale: "es-ES",
      currency: "EUR",
      country: "ES",
      channel: "web",
    },
    gateway,
  });

  assert.equal(report.ok, true);
  assert.equal(JSON.stringify(calls.filter((call) => call[0] === "putStockLevel")), JSON.stringify([
    ["putStockLevel", "variant-default", 10],
  ]));
});
