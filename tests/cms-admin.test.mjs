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
    URLSearchParams,
    JSON,
    Date,
    Math,
    encodeURIComponent,
    exports: commonJsExports,
    module: { exports: commonJsExports },
    require(specifier) {
      return extraRequire(specifier);
    },
  };

  vm.runInNewContext(outputText, moduleContext);
  return moduleContext.module.exports;
}

function loadCmsBlocksModule() {
  return loadTsModule("src/modules/cms/cms-blocks.ts");
}

function loadCmsAdminModule(requestBff) {
  return loadTsModule("src/modules/cms/cms-admin.ts", (specifier) => {
    if (specifier.endsWith("/shared/bff/client")) {
      return { requestBff };
    }
    if (specifier === "./cms-blocks") {
      return loadCmsBlocksModule();
    }
    return {};
  });
}

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

test("cms navigation is exposed as its own admin menu", () => {
  const shellSource = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const permissionsSource = readFileSync(path.resolve(root, "src/shared/permissions/permissions.ts"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "app/(admin)/admin/cms/page.tsx"), "utf8");
  const settingsPageSource = readFileSync(path.resolve(root, "app/(admin)/admin/cms/ajustes-basicos/page.tsx"), "utf8");
  const settingsViewSource = readFileSync(path.resolve(root, "src/modules/cms/cms-basic-settings-page.tsx"), "utf8");
  const layoutEditorSource = readFileSync(path.resolve(root, "src/modules/cms/cms-layout-area-editor-client.tsx"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/cms/cms-admin-actions.ts"), "utf8");

  assert.match(shellSource, /href: "\/admin\/cms"/);
  assert.match(shellSource, /href: "\/admin\/cms\/ajustes-basicos"/);
  assert.match(shellSource, /label: "CMS"/);
  assert.match(shellSource, /label: "Ajustes basicos"/);
  assert.match(permissionsSource, /"admin:cms:view"/);
  assert.match(permissionsSource, /"admin:cms-settings:view"/);
  assert.match(permissionsSource, /cms\.pages\.read/);
  assert.match(permissionsSource, /cms\.settings\.read/);
  assert.match(pageSource, /getCmsAdminData/);
  assert.match(settingsPageSource, /Ajustes basicos/);
  assert.match(settingsPageSource, /admin:cms-settings:view/);
  assert.match(settingsPageSource, /cms\.settings\.read/);
  assert.match(settingsPageSource, /getCmsGlobalSettings/);
  assert.match(settingsPageSource, /getCmsFontOptions/);
  assert.match(settingsPageSource, /listCmsTemplates/);
  assert.match(settingsPageSource, /CmsBasicSettingsPageView/);
  assert.match(settingsViewSource, /saveCmsGlobalSettingsAction/);
  assert.match(settingsViewSource, /TypographySelect/);
  assert.match(settingsViewSource, /fontOptionsResult/);
  assert.match(settingsViewSource, /CmsLayoutAreaEditorClient/);
  assert.match(settingsViewSource, /Tokens globales/);
  assert.match(settingsViewSource, /Layout base/);
  assert.match(settingsViewSource, /Plantillas/);
  assert.match(settingsViewSource, /TemplatesPanel/);
  assert.match(settingsViewSource, /TemplateEditor/);
  assert.match(settingsViewSource, /createCmsTemplateAction/);
  assert.match(settingsViewSource, /saveCmsTemplateSettingsAction/);
  assert.match(layoutEditorSource, /export function CmsLayoutAreaEditorClient/);
  assert.match(layoutEditorSource, /name = "layoutJson"/);
  assert.match(layoutEditorSource, /70%, 30%/);
  assert.match(layoutEditorSource, /25%, 50%, 25%/);
  assert.match(layoutEditorSource, /mobile/);
  assert.match(layoutEditorSource, /tablet/);
  assert.match(layoutEditorSource, /desktop/);
  assert.match(layoutEditorSource, /addArea/);
  assert.match(layoutEditorSource, /duplicateArea/);
  assert.match(layoutEditorSource, /areaValidationMessages/);
  assert.match(layoutEditorSource, /columnPercentTotal/);
  assert.match(layoutEditorSource, /Las columnas suman/);
  assert.match(layoutEditorSource, /Area valida/);
  assert.match(actionsSource, /saveCmsGlobalSettingsAction/);
  assert.match(actionsSource, /createCmsTemplateAction/);
  assert.match(actionsSource, /saveCmsTemplateSettingsAction/);
  assert.match(actionsSource, /createCmsTemplate/);
  assert.match(actionsSource, /patchCmsTemplate/);
  assert.match(actionsSource, /patchCmsGlobalSettings/);
  assert.match(actionsSource, /cmsTypographyTokenFromFamily/);
  assert.match(actionsSource, /cms\.settings\.write/);
  assert.match(actionsSource, /normalizeArea/);
  assert.match(actionsSource, /areas\.map/);
  assert.match(actionsSource, /overrides: templateOverrides/);
});

test("cms admin data uses scoped BFF endpoints and maps permissions", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
    });

    if (pathValue.startsWith("/admin/cms/pages/page-1?")) {
      return { ok: false, status: 403, error: "Forbidden", correlationId: "corr-1" };
    }

    const raw = {
      total: 1,
      limit: 50,
      offset: 0,
      items: [{
        pageId: "page-1",
        organizationId: "org-1",
        shopId: "shop-1",
        locale: "es-ES",
        pageType: "LANDING",
        title: "Landing CMS",
        path: "/landing",
        status: "DRAFT",
        routeId: null,
        createdAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
        publishedAt: null,
      }],
    };

    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      correlationId: "corr-list",
    };
  };
  const { getCmsAdminData } = loadCmsAdminModule(requestBff);

  const data = await getCmsAdminData(context, {
    status: "DRAFT",
    pageType: "LANDING",
    pageId: "page-1",
  });

  assert.ok(calls.some((call) =>
    call.path === "/admin/cms/pages?organizationId=org-1&shopId=shop-1&locale=es-ES&status=DRAFT&pageType=LANDING&limit=50&offset=0"
  ));
  assert.ok(calls.some((call) =>
    call.path === "/admin/cms/pages/page-1?organizationId=org-1&shopId=shop-1&locale=es-ES"
  ));
  assert.equal(data.pages.source, "bff");
  assert.equal(data.selectedPage.source, "unavailable");
  assert.equal(data.selectedPage.permission, "cms.pages.read");
  assert.equal(data.selectedPage.correlationId, "corr-1");
});

test("cms admin data loads page settings, resolved layout and templates for editor", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push(pathValue);
    let raw;
    if (pathValue.includes("/resolved-settings")) {
      raw = {
        pageId: "page-1",
        globalSettingsState: "PERSISTED",
        pageSettingsState: "PERSISTED",
        inheritGlobalSettings: false,
        templateId: "template-1",
        resolvedFrom: ["global", "template", "page"],
        tokens: {
          colors: { primary: "#25b9d7" },
          typography: { body: "Inter" },
          maxWidth: "1440px",
          spacing: { md: "16px" },
          breakpoints: { mobile: "0px", tablet: "768px", desktop: "1024px" },
          defaultColumnGap: "24px",
          defaultModuleGap: "24px",
        },
        layout: { regions: { main: { source: "page", areas: [{ areaId: "page-main", containerMode: "container", columns: ["70%", "30%"] }] } } },
        moduleSlots: [{ region: "main", areaId: "page-main", columnIndex: 1, width: "70%", percentage: 70 }],
        modules: [],
      };
    } else if (pathValue.includes("/pages/page-1/settings")) {
      raw = {
        configurationState: "PERSISTED",
        settings: {
          pageId: "page-1",
          inheritGlobalSettings: false,
          templateId: "template-1",
          overrides: { maxWidth: "1440px" },
        },
      };
    } else if (pathValue.includes("/templates")) {
      raw = { total: 1, limit: 50, offset: 0, items: [{ templateId: "template-1", name: "Landing", status: "ACTIVE", pageType: "LANDING", settings: { inheritGlobalSettings: true, templateId: null, overrides: {} } }] };
    } else if (pathValue.includes("/pages/page-1?")) {
      raw = {
        pageId: "page-1",
        organizationId: "org-1",
        shopId: "shop-1",
        locale: "es-ES",
        pageType: "LANDING",
        title: "Landing CMS",
        path: "/landing",
        status: "DRAFT",
        routeId: null,
        createdAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
        publishedAt: null,
      };
    } else {
      raw = { total: 1, limit: 50, offset: 0, items: [] };
    }
    return { ok: true, data: options.parse ? options.parse(raw) : raw, correlationId: "corr" };
  };
  const { getCmsAdminData } = loadCmsAdminModule(requestBff);

  const data = await getCmsAdminData(context, { pageId: "page-1" });

  assert.equal(data.pageSettings.data.settings.templateId, "template-1");
  assert.equal(data.resolvedPageSettings.data.layout.regions.main.areas[0].areaId, "page-main");
  assert.equal(data.templates.data.items[0].templateId, "template-1");
  assert.ok(calls.some((call) => call.includes("/pages/page-1/settings")));
  assert.ok(calls.some((call) => call.includes("/pages/page-1/resolved-settings")));
  assert.ok(calls.some((call) => call.includes("/templates") && call.includes("pageType=LANDING")));
  assert.ok(calls.every((call) => !call.includes("status=ACTIVE") || !call.includes("limit=50")));
});

test("cms block presets provide PLP-ready placements and JSON serialization", () => {
  const {
    blocksFromJson,
    blocksToJson,
    createCmsBlockFromPreset,
    getCmsBlockPlpTarget,
    getCmsBlockSurface,
    summarizePlacements,
    summarizePlpComposition,
  } =
    loadCmsAdminModule(async () => ({ ok: true, data: {} }));

  const blocks = [
    createCmsBlockFromPreset("banner.hero"),
    createCmsBlockFromPreset("plp.categoryIntro"),
    createCmsBlockFromPreset("plp.subcategoryTiles"),
    createCmsBlockFromPreset("carousel"),
    createCmsBlockFromPreset("accordion"),
  ];
  const parsed = blocksFromJson(blocksToJson(blocks));
  const summary = summarizePlacements(parsed);

  assert.equal(parsed[0].type, "banner.hero");
  assert.equal(parsed[1].type, "plp.categoryIntro");
  assert.equal(parsed[2].type, "plp.subcategoryTiles");
  assert.equal(parsed[3].type, "carousel");
  assert.equal(parsed[4].type, "accordion");
  assert.equal(summary.main, 1);
  assert.equal(summary.beforeList, 3);
  assert.equal(summary.afterList, 1);
  assert.equal(getCmsBlockSurface(parsed[0]), "page");
  assert.equal(getCmsBlockSurface(parsed[1]), "plp");
  const target = getCmsBlockPlpTarget(parsed[1]);
  assert.equal(target.listingKind, "CATEGORY");
  assert.equal(target.routePath, "");
  assert.equal(target.categorySlug, "");

  const plpSummary = summarizePlpComposition(parsed);
  assert.equal(plpSummary.total, 4);
  assert.equal(plpSummary.beforeList, 3);
  assert.equal(plpSummary.afterList, 1);
});

test("cms page UI documents the Routing SEO and builder strategy", () => {
  const pageSource = readFileSync(path.resolve(root, "src/modules/cms/cms-admin-page.tsx"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/cms/cms-admin-actions.ts"), "utf8");
  const editorSource = readFileSync(path.resolve(root, "src/modules/cms/cms-block-editor-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(pageSource, /Routing\/SEO/);
  assert.match(pageSource, /Antes PLP/);
  assert.match(pageSource, /Base PLP/);
  assert.match(pageSource, /Configuracion/);
  assert.match(pageSource, /PageSettingsPanel/);
  assert.match(pageSource, /selectableTemplates/);
  assert.match(pageSource, /No activas/);
  assert.match(pageSource, /ninguna esta activa/);
  assert.match(pageSource, /CmsReadinessPanel/);
  assert.match(pageSource, /cmsReadinessItems/);
  assert.match(pageSource, /Preparacion MVP/);
  assert.match(pageSource, /Ver preview/);
  assert.match(pageSource, /placedPageBlockCount/);
  assert.match(pageSource, /layoutAreaCount/);
  assert.match(pageSource, /saveCmsPageSettingsAction/);
  assert.match(pageSource, /canEditDraft/);
  assert.match(pageSource, /page\.status !== "PUBLISHED"/);
  assert.match(pageSource, /Despublicala para editar un nuevo draft/);
  assert.match(pageSource, /disabled=\{!canEditDraft\}/);
  assert.match(pageSource, /moduleSlots={moduleSlots}/);
  assert.match(pageSource, /<PreviewPanel resolved={data\.resolvedPageSettings\.data} version={version} \/>/);
  assert.match(pageSource, /Preview resuelto/);
  assert.match(pageSource, /modulePlacementForBlock/);
  assert.match(pageSource, /previewModulesForColumn/);
  assert.match(pageSource, /gridTemplateColumns/);
  assert.match(pageSource, /resolved\.modules/);
  assert.match(pageSource, /cmsResolvedFrame/);
  assert.match(cssSource, /cmsResolvedPreview/);
  assert.match(cssSource, /cmsResolvedColumns/);
  assert.match(cssSource, /grid-template-columns: 1fr !important/);
  assert.match(actionsSource, /saveCmsPageSettingsAction/);
  assert.match(actionsSource, /patchCmsPageSettings/);
  assert.match(actionsSource, /pageOverrides/);
  assert.match(pageSource, /Plantillas de bloques/);
  assert.match(editorSource, /Biblioteca de bloques/);
  assert.match(editorSource, /Bloques PLP/);
  assert.match(editorSource, /Placement del modulo/);
  assert.match(editorSource, /moduleSlots/);
  assert.match(editorSource, /Region \/ area \/ columna/);
  assert.match(editorSource, /containerMode/);
  assert.match(editorSource, /modulePlacementIssues/);
  assert.match(editorSource, /placementMatchesSlot/);
  assert.match(editorSource, /Orden .* duplicado/);
  assert.match(editorSource, /alertas de placement/);
  assert.match(cssSource, /cmsEditorValidation/);
  assert.match(cssSource, /cmsEditorValidationWarning/);
  assert.match(cssSource, /cmsEditorValidationOk/);
  assert.match(cssSource, /cmsReadinessPanel/);
  assert.match(cssSource, /cmsReadinessGrid/);
  assert.match(cssSource, /cmsReadinessItemWarning/);
  assert.match(cssSource, /cmsReadinessItemOk/);
  assert.match(editorSource, /Ordenar por: Relevancia/);
  assert.match(editorSource, /Hummingbird printed t-shirt/);
  assert.match(editorSource, /Preview draft/);
  assert.match(editorSource, /Target PLP/);
});

test("cms settings client exposes scoped BFF accessors", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
      body: options.init?.body ? JSON.parse(String(options.init.body)) : null,
    });

    let raw;
    if (pathValue.includes("/settings/global")) {
      raw = {
        configurationState: "PERSISTED",
        settings: {
          organizationId: "org-1",
          shopId: "shop-1",
          locale: "es-ES",
          tokens: {
            colors: { background: "#ffffff", primary: "#25b9d7" },
            typography: { body: "Inter" },
            maxWidth: "1440px",
            spacing: { md: "16px" },
            breakpoints: { mobile: "0px", tablet: "768px", desktop: "1024px" },
            defaultColumnGap: "md",
            defaultModuleGap: "lg",
          },
          layout: {
            regions: {
              main: {
                source: "global",
                areas: [{ areaId: "main-default", containerMode: "container", columns: ["100%"] }],
              },
            },
          },
        },
      };
    } else if (pathValue.includes("/font-options")) {
      raw = {
        provider: "google",
        items: [
          { family: "Inter", provider: "google", weights: [400, 500, 600, 700], category: "sans" },
          { family: "Roboto Mono", provider: "google", weights: [400, 500], category: "mono" },
        ],
      };
    } else if (pathValue.includes("/resolved-settings")) {
      raw = {
        pageId: "page-1",
        globalSettingsState: "PERSISTED",
        pageSettingsState: "INITIAL",
        inheritGlobalSettings: true,
        templateId: null,
        resolvedFrom: ["global", "module"],
        tokens: {
          colors: { background: "#ffffff", primary: "#25b9d7" },
            typography: { body: "Inter" },
            maxWidth: "1280px",
            spacing: { md: "16px" },
            breakpoints: { mobile: "0px", tablet: "768px", desktop: "1024px" },
            defaultColumnGap: "md",
            defaultModuleGap: "lg",
          },
          layout: {
            regions: {
              main: {
                source: "page",
                areas: [{ areaId: "hero", containerMode: "full-width", columns: ["100%"], columnGap: "lg" }],
              },
            },
          },
          moduleSlots: [{ region: "main", areaId: "hero", columnIndex: 1, width: "100%", percentage: 100 }],
        modules: [{ blockId: "hero-main", type: "banner.hero", placement: { region: "main", areaId: "hero", columnIndex: 1, order: 1, spacing: { marginBottom: "md" } } }],
      };
    } else if (pathValue.includes("/pages/page-1/settings")) {
      raw = {
        configurationState: "PERSISTED",
        settings: {
          pageId: "page-1",
          inheritGlobalSettings: true,
          templateId: "template-1",
          overrides: { maxWidth: "1440px" },
        },
      };
    } else if (pathValue.includes("/templates/template-1")) {
      raw = {
        templateId: "template-1",
        organizationId: "org-1",
        shopId: "shop-1",
        locale: "es-ES",
        pageType: "LANDING",
        name: "Landing editorial",
        status: "ACTIVE",
        settings: { inheritGlobalSettings: true, templateId: null, overrides: { maxWidth: "1440px" } },
      };
    } else if (pathValue.includes("/templates")) {
      raw = pathValue.includes("limit=20")
        ? { total: 1, limit: 20, offset: 0, items: [{ templateId: "template-1", name: "Landing base", status: "ACTIVE", pageType: "LANDING", settings: { inheritGlobalSettings: true, templateId: null, overrides: {} } }] }
        : { templateId: "template-1", organizationId: "org-1", shopId: "shop-1", locale: "es-ES", pageType: "LANDING", name: "Landing base", status: "DRAFT", settings: { inheritGlobalSettings: true, templateId: null, overrides: {} } };
    } else {
      raw = {};
    }

    return { ok: true, data: options.parse ? options.parse(raw) : raw, correlationId: "corr-settings" };
  };
  const {
    createCmsTemplate,
    getCmsFontOptions,
    getCmsGlobalSettings,
    getCmsPageSettings,
    getCmsResolvedPageSettings,
    listCmsTemplates,
    patchCmsGlobalSettings,
    patchCmsPageSettings,
    patchCmsTemplate,
  } = loadCmsAdminModule(requestBff);

  const global = await getCmsGlobalSettings(context, "es-ES");
  const fontOptions = await getCmsFontOptions(context, "es-ES");
  const patchedGlobal = await patchCmsGlobalSettings(context, { tokens: { maxWidth: "1440px" } }, "es-ES");
  const pageSettings = await getCmsPageSettings(context, "page-1", "es-ES");
  await patchCmsPageSettings(context, "page-1", { overrides: { maxWidth: "1440px" } }, "es-ES");
  const resolved = await getCmsResolvedPageSettings(context, "page-1", "es-ES");
  const templates = await listCmsTemplates(context, { pageType: "LANDING", status: "ACTIVE", limit: 20, offset: 0 }, "es-ES");
  await createCmsTemplate(context, { pageType: "LANDING", name: "Landing base" }, "es-ES");
  await patchCmsTemplate(context, "template-1", { status: "ACTIVE" }, "es-ES");

  assert.equal(global.ok, true);
  assert.equal(global.data.settings.tokens.maxWidth, "1440px");
  assert.equal(global.data.settings.tokens.defaultColumnGap, "16px");
  assert.equal(global.data.settings.tokens.defaultModuleGap, "24px");
  assert.equal(global.data.settings.tokens.typography.body.family, "Inter");
  assert.equal(global.data.settings.tokens.spacing.xl, "32px");
  assert.equal(fontOptions.data.items[1].family, "Roboto Mono");
  assert.equal(patchedGlobal.data.configurationState, "PERSISTED");
  assert.equal(pageSettings.data.settings.templateId, "template-1");
  assert.equal(resolved.data.modules[0].placement.areaId, "hero");
  assert.equal(resolved.data.layout.regions.main.areas[0].columnGap, "24px");
  assert.equal(resolved.data.modules[0].placement.spacing.marginBottom, "16px");
  assert.equal(templates.data.items[0].templateId, "template-1");
  assert.deepEqual(calls.map((call) => [call.method, call.path]), [
    ["GET", "/admin/cms/settings/global?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["GET", "/admin/cms/font-options?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["PATCH", "/admin/cms/settings/global?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["GET", "/admin/cms/pages/page-1/settings?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["PATCH", "/admin/cms/pages/page-1/settings?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["GET", "/admin/cms/pages/page-1/resolved-settings?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["GET", "/admin/cms/templates?organizationId=org-1&shopId=shop-1&locale=es-ES&pageType=LANDING&status=ACTIVE&limit=20&offset=0"],
    ["POST", "/admin/cms/templates?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["PATCH", "/admin/cms/templates/template-1?organizationId=org-1&shopId=shop-1&locale=es-ES"],
  ]);
});
