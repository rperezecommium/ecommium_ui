import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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
  return loadTsModule("packages/cms-blocks/src/index.ts");
}

function loadCmsAdminModule(requestAdminBff) {
  return loadTsModule("src/modules/cms/cms-admin.ts", (specifier) => {
    if (specifier.endsWith("/shared/bff/admin-client")) {
      return { requestAdminBff };
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
  assert.match(permissionsSource, /"admin:cms-builder:view"/);
  assert.match(permissionsSource, /cms\.pages\.read/);
  assert.match(permissionsSource, /cms\.settings\.read/);
  assert.match(pageSource, /getCmsAdminData/);
  assert.match(settingsPageSource, /Ajustes basicos/);
  assert.match(settingsPageSource, /admin:cms-settings:view/);
  assert.match(settingsPageSource, /cms\.settings\.read/);
  assert.match(settingsPageSource, /getCmsGlobalSettings/);
  assert.match(settingsPageSource, /getCmsFontOptions/);
  assert.doesNotMatch(settingsPageSource, /listCmsTemplates|getCmsTemplateUsage/);

  assert.match(settingsPageSource, /CmsBasicSettingsPageView/);
  assert.match(settingsViewSource, /saveCmsGlobalSettingsAction/);
  assert.match(settingsViewSource, /TypographySelect/);
  assert.match(settingsViewSource, /fontOptionsResult/);
  assert.match(settingsViewSource, /Tokens globales/);
  assert.doesNotMatch(settingsViewSource, /CmsLayoutAreaEditorClient|Layout base|TemplatesPanel|TemplateEditor|DeleteTemplateDrawer|createCmsTemplateAction|saveCmsTemplateSettingsAction|deleteCmsTemplateAction/);
  assert.match(settingsViewSource, /disabled=\{!hasContext \|\| !canWrite\}/);
  const templateRoute=readFileSync(path.resolve(root,"app/(admin)/admin/cms/plantillas/page.tsx"),"utf8");
  assert.doesNotMatch(templateRoute,/Layout y ajustes|CmsBasicSettingsPageView|listCmsTemplates/);
  assert.match(templateRoute,/redirect\('\/admin\/cms\/plantillas'\)/);
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
  assert.match(actionsSource, /saveCmsVisualModuleDefinitionAction/);
  assert.match(actionsSource, /visualDefinitionIntent.*publish|intent === "publish"/s);
  assert.match(actionsSource, /Modulo visual publicado y agregado a Bloques guardados/);
  assert.match(actionsSource, /attachPublishedVisualModuleToDraft/);
  assert.match(actionsSource, /replaceVisualModuleBlockWithCmsReference/);
  assert.match(actionsSource, /publishedVisualModuleDefinitionId/);
  assert.match(actionsSource, /intent === "publish" \|\| intent === "create"/);
  assert.match(actionsSource, /Modulo visual ya publicado en CMS/);
  assert.match(actionsSource, /visualContentValuesForSave/);
  assert.match(actionsSource, /Modulo visual publicado, agregado a Bloques guardados y enlazado al draft/);
  assert.match(actionsSource, /updateCmsDraft\(context, pageId, payload, locale\)/);
  assert.match(actionsSource, /activateCmsVisualModuleDefinition/);
  assert.match(actionsSource, /archiveCmsVisualModuleDefinition/);
  assert.match(actionsSource, /createCmsVisualModuleDefinition/);
  assert.match(actionsSource, /createCmsVisualModuleDefinitionDraftRevision/);
  assert.match(actionsSource, /updateCmsVisualModuleDefinitionDraft/);
  assert.match(actionsSource, /uploadCmsBuilderMediaAction/);
  assert.match(actionsSource, /cmsBuilderMediaCollectionTitle/);
  assert.match(actionsSource, /createMediaCollection/);
  assert.match(actionsSource, /addMediaCollectionItems/);
  assert.match(actionsSource, /listMediaCollections/);
  assert.doesNotMatch(actionsSource, /createCmsTemplateAction/);
  assert.doesNotMatch(actionsSource, /saveCmsTemplateSettingsAction/);
  assert.doesNotMatch(actionsSource, /deleteCmsTemplateAction/);
  assert.match(actionsSource, /deleteCmsPageAction/);
  assert.doesNotMatch(actionsSource, /createCmsTemplate/);
  assert.doesNotMatch(actionsSource, /patchCmsTemplate/);
  assert.doesNotMatch(actionsSource, /deleteCmsTemplate/);
  assert.match(actionsSource, /patchCmsGlobalSettings/);
  assert.match(actionsSource, /cmsTypographyTokenFromFamily/);
  assert.match(actionsSource, /cms\.settings\.write/);
  assert.match(actionsSource, /normalizeArea/);
  assert.match(actionsSource, /areas\.map/);
  assert.doesNotMatch(actionsSource, /templateOverrides/);
});

test("cms exposes independent reusable header and footer libraries", () => {
  const shell = readFileSync(path.resolve(root, "src/app-shell/admin-shell.tsx"), "utf8");
  const page = readFileSync(path.resolve(root, "src/modules/cms/cms-site-parts-page.tsx"), "utf8");
  const composer = readFileSync(path.resolve(root, "src/modules/cms/cms-shell-sections-client.tsx"), "utf8");
  const assignment = readFileSync(path.resolve(root, "src/modules/cms/cms-shell-assignment-form.tsx"), "utf8");
  const storefrontSitePart = readFileSync(path.resolve(root, "src/modules/storefront/storefront-site-part.tsx"), "utf8") + readFileSync(path.resolve(root, "src/modules/cms/cms-system-block-view.tsx"), "utf8");
  const actions = readFileSync(path.resolve(root, "src/modules/cms/cms-site-parts-actions.ts"), "utf8");

  assert.match(shell, /\/admin\/cms\/headers/);
  assert.match(shell, /\/admin\/cms\/footers/);
  assert.match(assignment, /Default tienda/);
  assert.match(assignment, /Superficie/);
  assert.match(assignment, /PAGE/);
  assert.match(page, /item\.usageCount > 0/);
  assert.match(page, /CmsShellSectionsClient/);
  assert.match(page, /CmsSavedSitePartPreview/);
  assert.doesNotMatch(page, /CmsSitePartBuilderClient/);
  assert.doesNotMatch(page, />Layout JSON</);
  assert.doesNotMatch(page, />Bloques JSON</);
  assert.match(composer, /insertShellLibrarySection/);
  assert.match(composer, /CmsSectionBuilderClient/);
  assert.match(composer, /canWrite&&canPublish/);
  assert.match(storefrontSitePart, /props\.imageUrl/);
  assert.match(storefrontSitePart, /data-visible-mobile/);
  assert.match(storefrontSitePart, /data-visible-tablet/);
  assert.match(storefrontSitePart, /data-visible-desktop/);
  assert.match(storefrontSitePart, /placement\?\.spacing/);
  assert.match(storefrontSitePart, /data-cms-block-type/);
  assert.match(storefrontSitePart, /store\.assurances/);
  assert.match(storefrontSitePart, /props\.dynamic !== false/);
  assert.match(storefrontSitePart, /function categoryTree/);
  assert.match(storefrontSitePart, /storefrontCategorySubmenu/);
  assert.match(storefrontSitePart, /storefrontSitePartSearch/);
  assert.doesNotMatch(storefrontSitePart, /storefrontSitePartSearch[^;]+<button/);
  assert.match(actions, /kind === "HEADER" \? \{ headerId: selectedId \} : \{ footerId: selectedId \}/);
});

test("cms full width slider has a structured editor and responsive controls", () => {
  const editor = readFileSync(path.resolve(root, "src/modules/cms/cms-block-editor-client.tsx"), "utf8");
  const catalog = readFileSync(path.resolve(root, "packages/cms-blocks/src/index.ts"), "utf8");

  assert.match(editor, /function SliderFields/);
  assert.match(editor, /Altura escritorio \(px\)/);
  assert.match(editor, /Posicion de imagen/);
  assert.match(editor, /Posicion del contenido/);
  assert.match(editor, /Duplicar diapositiva/);
  assert.match(editor, /Eliminar diapositiva/);
  assert.doesNotMatch(editor, /label="Slides JSON"/);
  assert.match(catalog, /heightDesktop: 380/);
  assert.match(catalog, /autoplayDelay: 2500/);
});

test("cms commercial product grid renders the complete bounded set of 20", () => {
  const renderer = readFileSync(path.resolve(root, "packages/cms-blocks/src/react.tsx"), "utf8");
  assert.match(renderer, /const products = productItems\(block\.props\.hydratedProducts\)/);
  assert.match(renderer, /function productItems[\s\S]*?\.slice\(0, 20\)/);
});

test("cms category image tiles expose a structured editor and safe linked renderer", () => {
  const builder = readFileSync(path.resolve(root, "src/modules/cms/cms-category-tiles-editor.tsx"), "utf8");
  const catalog = readFileSync(path.resolve(root, "packages/cms-blocks/src/index.ts"), "utf8");
  const renderer = readFileSync(path.resolve(root, "packages/cms-blocks/src/react.tsx"), "utf8");
  const storefront = readFileSync(path.resolve(root, "src/modules/storefront/storefront-cms-page.tsx"), "utf8");
  const css = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(catalog, /type: "category\.imageTiles"/);
  assert.match(catalog, /widthPercent: 90/);
  assert.match(builder, /function CmsCategoryTilesEditor/);
  assert.match(builder, /Tarjetas de categoria/);
  assert.match(renderer, /function CategoryImageTilesBlock/);
  assert.match(renderer, /safeLinkHref\(item\.href\)/);
  assert.match(storefront, /children \?\? label/);
  assert.match(css, /storefrontCmsCategoryTile:hover/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("retired Builder has no route, screen, navigation or exclusive mutation; shared editors remain", () => {
  for(const file of ["app/(admin)/admin/cms/builder/page.tsx","src/modules/cms/cms-block-builder-page.tsx","src/modules/cms/cms-block-builder-client.tsx","src/modules/cms/cms-site-part-builder-client.tsx"])assert.equal(existsSync(path.resolve(root,file)),false);
  for(const file of ["src/app-shell/admin-shell.tsx","src/modules/cms/cms-admin-page.tsx","src/modules/cms/cms-admin-actions.ts"]) {
    const source=readFileSync(path.resolve(root,file),"utf8");
    assert.doesNotMatch(source,/\/admin\/cms\/builder|saveCmsBuilderDraftAction|finishCmsBuilder/);
  }
  for(const file of ["app/(admin)/admin/cms/transicion/page.tsx","src/modules/cms/cms-page-migration-entry.tsx","src/modules/cms/cms-page-migration-actions.ts","src/modules/cms/cms-page-migration-client.tsx","src/modules/cms/cms-reproduce-page-button.tsx","src/modules/cms/cms-shell-readiness-panel.tsx"])assert.equal(existsSync(path.resolve(root,file)),false);
  for(const file of ["src/app-shell/admin-shell.tsx","src/modules/cms/cms-admin-page.tsx","src/modules/cms/cms-site-parts-page.tsx","src/modules/cms/cms-shell-sections-client.tsx"]) {
    assert.doesNotMatch(readFileSync(path.resolve(root,file),"utf8"),/\/admin\/cms\/transicion|CmsReproduce|CmsConvertShell|CmsPageMigration/);
  }
  const sitePartActions=readFileSync(path.resolve(root,"src/modules/cms/cms-site-parts-actions.ts"),"utf8");
  assert.doesNotMatch(sitePartActions,/saveCmsSitePartDraftAction|publishCmsSitePartAction/);
  for(const file of ["src/modules/cms/cms-visual-editor.tsx","src/modules/cms/cms-page-composer-client.tsx","src/modules/cms/cms-block-editor-client.tsx","packages/cms-blocks/src/react.tsx"])assert.ok(existsSync(path.resolve(root,file)));
  const fields=readFileSync(path.resolve(root,"src/modules/cms/cms-module-builder-client.tsx"),"utf8");
  assert.match(fields,/CmsCategoryTilesEditor/);
  assert.match(fields,/module\.SliderFields/);
  assert.match(fields,/editableFields\.includes\("items"\)/);
});

test("cms admin data uses scoped BFF endpoints and maps permissions", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
    });

    if (pathValue.startsWith("/admin/cms/pages/page-1?")) {
      return { ok: false, status: 403, error: "Forbidden", correlationId: "corr-1" };
    }

    const raw = pathValue.includes("/admin/cms/visual-modules")
      ? {
          total: 1,
          limit: 50,
          offset: 0,
          items: [{
            definitionId: "definition-1",
            organizationId: "org-1",
            shopId: "shop-1",
            moduleId: "heroModule-prototype-images-001",
            name: "Reusable hero",
            schemaVersion: 2,
            schemaMinorVersion: 0,
            revision: 1,
            status: "ACTIVE",
            module: {
              schemaVersion: 2,
              moduleId: "heroModule-prototype-images-001",
              type: "visual.module",
              panels: [{ panelId: "heroModule-prototype-images-001-panel" }],
              contentSchema: {},
            },
            createdAt: "2026-07-29T00:00:00.000Z",
            updatedAt: "2026-07-29T00:00:00.000Z",
            activatedAt: "2026-07-29T00:00:00.000Z",
            archivedAt: null,
          }],
        }
      : {
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
  const { getCmsAdminData } = loadCmsAdminModule(requestAdminBff);

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
  assert.ok(calls.some((call) =>
    call.path === "/admin/cms/visual-modules?organizationId=org-1&shopId=shop-1&limit=50&offset=0"
  ));
  assert.ok(calls.every((call) => !call.path.includes("/visual-modules") || !call.path.includes("locale=")));
  assert.equal(data.pages.source, "bff");
  assert.equal(data.visualModules.data.items[0].definitionId, "definition-1");
  assert.equal(data.selectedPage.source, "unavailable");
  assert.equal(data.selectedPage.permission, "cms.pages.read");
  assert.equal(data.selectedPage.correlationId, "corr-1");
});

test("cms admin data preserves resolved page settings without loading retired templates", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
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
    } else if (pathValue.includes("/admin/cms/visual-modules")) {
      raw = {
        total: 1,
        limit: 50,
        offset: 0,
        items: [{
          definitionId: "definition-1",
          organizationId: "org-1",
          shopId: "shop-1",
          moduleId: "heroModule-prototype-images-001",
          name: "Reusable hero",
          schemaVersion: 2,
          schemaMinorVersion: 0,
          revision: 1,
          status: "ACTIVE",
          module: {
            schemaVersion: 2,
            moduleId: "heroModule-prototype-images-001",
            type: "visual.module",
            panels: [{ panelId: "heroModule-prototype-images-001-panel" }],
            contentSchema: {},
          },
          createdAt: "2026-07-29T00:00:00.000Z",
          updatedAt: "2026-07-29T00:00:00.000Z",
          activatedAt: "2026-07-29T00:00:00.000Z",
          archivedAt: null,
        }],
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
  const { getCmsAdminData } = loadCmsAdminModule(requestAdminBff);

  const data = await getCmsAdminData(context, { pageId: "page-1" });

  assert.equal(data.pageSettings.data.settings.templateId, "template-1");
  assert.equal(data.resolvedPageSettings.data.layout.regions.main.areas[0].areaId, "page-main");
  assert.equal(data.templates, undefined);
  assert.equal(data.visualModules.data.items[0].moduleId, "heroModule-prototype-images-001");
  assert.ok(calls.some((call) => call.includes("/pages/page-1/settings")));
  assert.ok(calls.some((call) => call.includes("/pages/page-1/resolved-settings")));
  assert.ok(calls.every((call) => !call.includes("/templates")));
  assert.ok(calls.some((call) => call.includes("/visual-modules") && !call.includes("locale=")));
  assert.ok(calls.every((call) => !call.includes("status=ACTIVE") || !call.includes("limit=50")));
});

test("cms block presets provide PLP-ready placements and JSON serialization", () => {
  const cmsBlocksSource = readFileSync(path.resolve(root, "packages/cms-blocks/src/index.ts"), "utf8");
  const cmsAdminSource = readFileSync(path.resolve(root, "src/modules/cms/cms-admin.ts"), "utf8");
  const packageReadmeSource = readFileSync(path.resolve(root, "packages/cms-blocks/README.md"), "utf8");
  const {
    blocksFromJson,
    blocksToJson,
    createCmsBlockFromPreset,
    getCmsBlockDefinition,
    getCmsBlockRegistry,
    getCmsBlockPlpTarget,
    getCmsBlockSurface,
    migrateCmsVisualModuleV1ToV2ForRenderer,
    normalizeCmsVisualModuleForRenderer,
    normalizeCmsVisualModuleProps,
    normalizeCmsVisualModuleV2Props,
    normalizeCmsVisualNode,
    summarizePlacements,
    summarizePlpComposition,
  } =
    loadCmsAdminModule(async () => ({ ok: true, data: {} }));

  assert.match(cmsBlocksSource, /export type CmsVisualNodeType/);
  assert.match(cmsBlocksSource, /export type CmsVisualNodeStyle/);
  assert.match(cmsBlocksSource, /export type CmsVisualResponsiveStyles/);
  assert.match(cmsBlocksSource, /export type CmsVisualNodeProps/);
  assert.match(cmsBlocksSource, /export type CmsVisualNode/);
  assert.match(cmsBlocksSource, /export type CmsVisualModuleProps/);
  assert.match(cmsBlocksSource, /export type CmsVisualModuleV2Props/);
  assert.match(cmsBlocksSource, /export type CmsVisualModuleDefinition/);
  assert.match(cmsBlocksSource, /export type CmsVisualAnimation/);
  assert.match(cmsBlocksSource, /export type CmsVisualResponsiveVisibility/);
  assert.match(cmsBlocksSource, /schemaMinorVersion\?: number/);
  assert.match(cmsBlocksSource, /migrateCmsVisualModuleV1ToV2ForRenderer/);
  assert.match(cmsBlocksSource, /export function normalizeCmsVisualModuleForRenderer/);
  assert.match(cmsBlocksSource, /Prototype hero/);
  assert.match(cmsBlocksSource, /heroModule-prototype-images-001-copy/);
  assert.match(cmsBlocksSource, /heroModule-prototype-images-001-art/);
  assert.match(cmsBlocksSource, /heroModule-prototype-images-001-phone/);
  assert.match(cmsBlocksSource, /heroModule-prototype-images-001-gesture-list/);
  assert.match(cmsBlocksSource, /Design and prototype hero images/);
  assert.match(cmsBlocksSource, /buttonText/);
  assert.match(cmsBlocksSource, /backgroundImage/);
  assert.match(cmsBlocksSource, /contentSchema/);
  assert.match(cmsBlocksSource, /contentBinding\?: string/);
  assert.match(cmsBlocksSource, /contentValues\?: Record<string, unknown>/);
  assert.match(cmsBlocksSource, /assetRefs/);
  assert.match(cmsBlocksSource, /assetRefs\?: CmsVisualAssetRef\[\]/);
  assert.match(cmsBlocksSource, /normalizeCmsVisualNode/);
  assert.match(cmsBlocksSource, /normalizeCmsVisualModuleProps/);
  assert.match(cmsBlocksSource, /type: "visual\.module"/);
  assert.match(cmsBlocksSource, /Visual tree JSON/);
  assert.match(cmsBlocksSource, /htmlEmbed/);
  assert.match(cmsBlocksSource, /marginLeft/);
  assert.match(cmsAdminSource, /type CmsVisualNode/);
  assert.match(cmsAdminSource, /type CmsVisualModuleProps/);
  assert.match(cmsAdminSource, /normalizeCmsVisualNode/);
  assert.match(cmsAdminSource, /normalizeCmsVisualModuleProps/);
  assert.match(packageReadmeSource, /Modelo visual libre/);
  assert.match(packageReadmeSource, /CmsVisualNode/);
  assert.match(packageReadmeSource, /`visual\.module` ya existe/);
  assert.match(packageReadmeSource, /responsiveStyles/);

  const blocks = [
    createCmsBlockFromPreset("banner.hero"),
    createCmsBlockFromPreset("plp.categoryIntro"),
    createCmsBlockFromPreset("plp.subcategoryTiles"),
    createCmsBlockFromPreset("carousel"),
    createCmsBlockFromPreset("accordion"),
    createCmsBlockFromPreset("visual.module"),
  ];
  const parsed = blocksFromJson(blocksToJson(blocks));
  const summary = summarizePlacements(parsed);
  const placedVisualReference = blocksFromJson(blocksToJson([{
    blockId: "four-info-squares",
    type: "visual.module",
    placement: {
      region: "main",
      areaId: "main-split",
      columnIndex: 2,
      order: 4,
      width: "50%",
      align: "stretch",
      spacing: {},
      visibility: { mobile: true, tablet: true, desktop: true },
      containerMode: "inherit",
    },
    props: {
      definitionId: "definition-four-info-squares",
      contentValues: {},
      surface: "page",
      placement: "main",
      visualDefinitionReference: true,
    },
  }]))[0];

  assert.equal(parsed[0].type, "banner.hero");
  assert.equal(parsed[1].type, "plp.categoryIntro");
  assert.equal(parsed[2].type, "plp.subcategoryTiles");
  assert.equal(parsed[3].type, "carousel");
  assert.equal(parsed[4].type, "accordion");
  assert.equal(parsed[5].type, "visual.module");
  assert.equal(getCmsBlockRegistry()["accordion"].schemaVersion, 1);
  assert.equal(getCmsBlockRegistry()["visual.module"].schemaVersion, 1);
  const defaultVisualModule = normalizeCmsVisualModuleProps(createCmsBlockFromPreset("visual.module").props);
  assert.equal(defaultVisualModule.name, "Hero prototype images");
  assert.equal(defaultVisualModule.contentSchema.heading.required, true);
  assert.equal(defaultVisualModule.contentSchema.buttonText.type, "text");
  assert.equal(defaultVisualModule.contentValues.heading, "Design and prototype hero images for your website");
  assert.equal(defaultVisualModule.contentValues.buttonText, "Download Free");
  assert.equal(defaultVisualModule.tree.nodeId, "heroModule-prototype-images-001");
  assert.equal(defaultVisualModule.tree.children[0].nodeId, "heroModule-prototype-images-001-copy");
  assert.equal(defaultVisualModule.tree.children[1].nodeId, "heroModule-prototype-images-001-art");
  assert.equal(defaultVisualModule.tree.children[1].children?.some((node) => node.nodeId === "heroModule-prototype-images-001-phone"), true);
  assert.equal(defaultVisualModule.tree.children[1].children?.some((node) => node.nodeId === "heroModule-prototype-images-001-gesture-list"), true);
  assert.equal(JSON.stringify(getCmsBlockDefinition("accordion").supportedSurfaces), JSON.stringify(["page", "plp"]));
  assert.equal(JSON.stringify(getCmsBlockDefinition("visual.module").supportedSurfaces), JSON.stringify(["page"]));
  assert.ok(getCmsBlockDefinition("accordion").editorFields.some((field) => field.key === "items" && field.type === "json"));
  assert.ok(getCmsBlockDefinition("visual.module").editorFields.some((field) => field.key === "tree" && field.type === "json"));
  assert.equal(normalizeCmsVisualNode({ nodeId: "cta", type: "button", styles: { marginLeft: "20px", unknown: "nope" }, props: { text: "Comprar" } }).styles.marginLeft, "20px");
  assert.equal(normalizeCmsVisualModuleProps({ name: "Libre", tree: { nodeId: "root", type: "container" } }).tree.type, "container");
  assert.equal(normalizeCmsVisualModuleProps({ contentSchema: { themeColor: { type: "color", required: false } }, tree: { nodeId: "root", type: "container" } }).contentSchema.themeColor.type, "color");
  assert.equal(normalizeCmsVisualModuleProps({ assetRefs: [{ assetKey: "bg", mediaAssetId: "media-1" }], tree: { nodeId: "root", type: "container" } }).assetRefs[0].mediaAssetId, "media-1");
  const migratedVisualModule = migrateCmsVisualModuleV1ToV2ForRenderer({
    name: "Hero migrado",
    contentSchema: { heading: { type: "text", required: true } },
    contentValues: { heading: "Hero certificado" },
    tree: {
      nodeId: "hero-root",
      type: "container",
      styles: { display: "flex", padding: "24px" },
      responsiveStyles: { mobile: { padding: "16px" } },
      children: [
        {
          nodeId: "hero-heading",
          type: "heading",
          contentBinding: "heading",
          styles: { fontSize: "32px" },
        },
      ],
    },
  });
  assert.equal(migratedVisualModule.schemaVersion, 2);
  assert.equal(migratedVisualModule.moduleId, "hero-root");
  assert.equal(migratedVisualModule.styles.base.padding, "24px");
  assert.equal(migratedVisualModule.styles.mobile.padding, "16px");
  assert.equal(migratedVisualModule.panels[0].elements[0].elementId, "hero-heading");
  assert.equal(migratedVisualModule.panels[0].elements[0].contentBinding, "heading");
  const migratedVisualModuleWithDuplicatePanelSeed = migrateCmsVisualModuleV1ToV2ForRenderer({
    tree: {
      nodeId: "root",
      type: "container",
      children: [
        {
          nodeId: "root-panel-1",
          type: "heading",
          props: { text: "Titulo" },
        },
      ],
    },
  });
  assert.equal(migratedVisualModuleWithDuplicatePanelSeed.panels[0].panelId, "root-panel-1-2");
  assert.equal(migratedVisualModuleWithDuplicatePanelSeed.panels[0].elements[0].elementId, "root-panel-1");
  const migratedSplitHero = migrateCmsVisualModuleV1ToV2ForRenderer({
    tree: {
      nodeId: "split-root",
      type: "container",
      styles: { display: "grid", gridTemplateColumns: "binding:columnRatio" },
      children: [
        { nodeId: "split-image-panel", type: "section", children: [{ nodeId: "split-image", type: "image" }] },
        { nodeId: "split-copy-panel", type: "section", children: [{ nodeId: "split-heading", type: "heading" }] },
      ],
    },
    contentSchema: { columnRatio: { type: "number", required: true } },
    contentValues: { columnRatio: 45 },
  });
  assert.equal(migratedSplitHero.panels.length, 2);
  assert.equal(migratedSplitHero.panels[0].panelId, "split-image-panel");
  assert.equal(migratedSplitHero.panels[0].elements[0].elementId, "split-image");
  assert.equal(migratedSplitHero.panels[1].panelId, "split-copy-panel");
  assert.equal(migratedSplitHero.styles.base.gridTemplateColumns, "binding:columnRatio");
  assert.equal(readFileSync(path.resolve(root, "public/storefront/cms/sol-high-hero.jpeg")).byteLength > 0, true);
  const visualModuleV2 = normalizeCmsVisualModuleV2Props({
    schemaVersion: 2,
    moduleId: "heroModule-bg-animated-001",
    type: "visual.module",
    styles: { base: { display: "flex", "flex-direction": "column", backgroundImage: "asset:bg" } },
    panels: [
      {
        panelId: "heroModule-bg-animated-001-leftPanel",
        styles: { base: { "border-radius": "12px", width: "50%" } },
        elements: [
          {
            elementId: "heroModule-bg-animated-001-heading",
            elementType: "heading",
            contentBinding: "heading",
            styles: { base: { "font-size": "var:fontSize.3xl", color: "var:color.primary" } },
          },
        ],
      },
    ],
    contentSchema: { heading: { type: "text", required: true } },
    contentValues: { heading: "Disfruta de nuestros especiales" },
    assetRefs: [{ assetKey: "bg", mediaAssetId: "media-1", src: "https://cdn.example.test/hero.jpg" }],
  });
  assert.equal(visualModuleV2.schemaVersion, 2);
  assert.equal(visualModuleV2.schemaMinorVersion, 0);
  assert.equal(visualModuleV2.styles.base.flexDirection, "column");
  assert.equal(visualModuleV2.panels[0].styles.base.borderRadius, "12px");
  assert.equal(visualModuleV2.panels[0].elements[0].contentBinding, "heading");
  assert.equal(normalizeCmsVisualModuleForRenderer(visualModuleV2).schemaVersion, 2);
  assert.equal(summary.main, 2);
  assert.equal(summary.beforeList, 3);
  assert.equal(summary.afterList, 1);
  assert.equal(getCmsBlockSurface(parsed[0]), "page");
  assert.equal(getCmsBlockSurface(parsed[1]), "plp");
  assert.equal(placedVisualReference.placement.columnIndex, 2);
  assert.equal(placedVisualReference.placement.width, "50%");
  assert.equal(placedVisualReference.props.placement, "main");
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
  const guardianSource = readFileSync(path.resolve(root, "src/app-shell/admin-session-guardian.tsx"), "utf8");
  const editorSource = readFileSync(path.resolve(root, "src/modules/cms/cms-block-editor-client.tsx"), "utf8");
  const layoutPreviewSource = readFileSync(path.resolve(root, "src/modules/cms/cms-layout-preview.tsx"), "utf8");
  const rendererSource = readFileSync(path.resolve(root, "packages/cms-blocks/src/react.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(pageSource, /Routing\/SEO/);
  assert.match(pageSource, /DeletePageDrawer/);
  assert.match(pageSource, /deleteCmsPageAction/);
  assert.match(pageSource, /Despublica la pagina antes de eliminarla/);
  assert.match(pageSource, /confirmDeletePage/);
  assert.match(pageSource, /name="seoDescription"[^>]+required/);
  assert.match(actionsSource, /!payload\.seo\.description/);
  assert.match(actionsSource, /SEO description/);
  assert.match(pageSource, /<Trash2/);
  assert.match(pageSource, /Antes PLP/);
  assert.doesNotMatch(pageSource, /Base PLP|PlpBasePanel/);
  assert.match(pageSource, /Configuracion/);
  assert.match(pageSource, /PageSettingsPanel/);
  assert.doesNotMatch(pageSource, /selectableTemplates|name="templateId"|kind=layout/);
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
  assert.match(pageSource, /<CmsBlockEditorClient\s+disabled=\{!canEditDraft\}/);
  assert.match(pageSource, /autoComplete="off" className="cmsEditorForm"/);
  assert.match(guardianSource, /function recoveryEnabledForPathname/);
  assert.match(guardianSource, /!pathname\.startsWith\("\/admin\/cms"\)/);
  assert.match(guardianSource, /clearRecoveryForPathPrefix\(employeeId, "\/admin\/cms"\)/);
  assert.match(guardianSource, /recoveryEnabled && recovery/);
  assert.match(pageSource, /moduleSlots={moduleSlots}/);
  assert.match(pageSource, /resolvedLayout=\{resolved\?\.layout \?\? null\}/);
  assert.match(pageSource, /Esta pagina usa configuracion propia/);
  assert.match(pageSource, /valores propios de esta página tienen prioridad/);
  assert.match(pageSource, /visualModules={data\.visualModules\.data}/);
  assert.match(pageSource, /<PreviewPanel resolved={data\.resolvedPageSettings\.data} version={version} \/>/);
  assert.match(rendererSource, /visualInteractionStyleVariables/);
  assert.match(rendererSource, /visualInteractionClassNames/);
  assert.match(rendererSource, /visualHoverStyleKeys/);
  assert.match(cssSource, /\.cmsVisualHoverBackgroundColor:hover/);
  assert.match(cssSource, /\.cmsVisualHoverTransform:hover/);
  assert.match(pageSource, /Preview resuelto/);
  assert.match(pageSource, /modulePlacementForBlock/);
  assert.match(pageSource, /moduleSlotsForResolvedSettings/);
  assert.match(pageSource, /moduleSlotsFromResolvedLayout/);
  assert.match(pageSource, /<CmsLayoutPreview/);
  assert.match(layoutPreviewSource, /export function CmsLayoutPreview/);
  assert.match(layoutPreviewSource, /CmsBlockRenderer/);
  assert.match(layoutPreviewSource, /blocksForColumn/);
  assert.match(layoutPreviewSource, /slotKeysForAreas/);
  assert.match(layoutPreviewSource, /gridTemplateColumns/);
  assert.match(layoutPreviewSource, /data-cms-column/);
  assert.match(layoutPreviewSource, /resolvedPlacementMap/);
  assert.match(pageSource, /resolved\.modules/);
  assert.match(pageSource, /cmsResolvedFrame/);
  assert.match(cssSource, /cmsResolvedPreview/);
  assert.match(cssSource, /cmsLayoutPreviewColumns/);
  assert.match(cssSource, /grid-template-columns: 1fr !important/);
  assert.match(actionsSource, /saveCmsPageSettingsAction/);
  assert.match(actionsSource, /patchCmsPageSettings/);
  assert.match(actionsSource, /pageOverrides/);
  assert.match(editorSource, /Biblioteca de bloques/);
  assert.match(editorSource, /visualModulePresetsStorageKey/);
  assert.match(editorSource, /savedVisualModulePresetsFromJson/);
  assert.match(editorSource, /savedVisualModulePresetsFromDefinitions/);
  assert.match(editorSource, /hydrateCmsVisualModuleReferences/);
  assert.match(editorSource, /hydrateCmsVisualModuleReferenceBlock/);
  assert.match(editorSource, /editorBlocksForCmsDraftPayload/);
  assert.match(editorSource, /blocksToJson\(editorBlocksForCmsDraftPayload\(orderedBlocks\)\)/);
  assert.match(editorSource, /CmsVisualModuleDefinitionsList/);
  assert.match(editorSource, /CmsLayoutPreview/);
  assert.match(editorSource, /resolvedModules={resolvedModules}/);
  assert.match(editorSource, /definition\.status === "ACTIVE"/);
  assert.match(editorSource, /source: "cms"/);
  assert.match(editorSource, /system-sol-high-split-hero-001/);
  assert.match(editorSource, /Sol High split hero/);
  assert.match(editorSource, /system-consult-works-split-cta-001/);
  assert.match(editorSource, /Consult works split CTA/);
  assert.match(editorSource, /consult-works-engineers\.jpg/);
  assert.match(editorSource, /system-four-info-squares-001/);
  assert.match(editorSource, /FourInfoSquares/);
  assert.match(editorSource, /createFourInfoSquaresTree/);
  assert.match(editorSource, /cardMargin/);
  assert.match(editorSource, /cardTextColor/);
  assert.match(editorSource, /mergeSavedVisualModulePresets/);
  assert.match(editorSource, /cmsSavedVisualModulePresets/);
  assert.match(editorSource, /createCmsBlockFromSavedVisualPreset/);
  assert.match(editorSource, /contentSchema: preset\.contentSchema/);
  assert.match(editorSource, /visualDefinitionReference: true/);
  assert.match(editorSource, /props: \{\s*definitionId,\s*contentValues:/s);
  assert.match(editorSource, /\.\.\.recordValue\(visualModule\.contentValues\),\s*\.\.\.recordValue\(block\.props\.contentValues\)/s);
  assert.match(editorSource, /VisualModuleContentFields/);
  assert.match(editorSource, /Contenido del modulo visual/);
  assert.match(editorSource, /field\.type === "color"/);
  assert.match(editorSource, /inferVisualContentSchema/);
  assert.match(editorSource, /savedVisualModulePresets/);
  assert.match(editorSource, /cmsSavedVisualPresetList/);
  assert.match(editorSource, /Bloques guardados/);
  assert.match(editorSource, /publishVisualModuleAction/);
  assert.match(editorSource, /Publicar modulo/);
  assert.match(editorSource, /isPublishedReference/);
  assert.match(editorSource, /visualDefinitionId-\$\{block\.blockId\}/);
  assert.match(editorSource, /Publicado en CMS/);
  assert.match(editorSource, /visualDefinitionReturn/);
  assert.match(editorSource, /visualDefinitionIntent/);
  assert.match(editorSource, /addSavedVisualBlock/);
  assert.match(editorSource, /Bloques PLP/);
  assert.match(editorSource, /Placement del modulo/);
  assert.match(editorSource, /Editor bloqueado/);
  assert.match(editorSource, /Esta pagina esta publicada\. Despublicala antes de cambiar bloques o placements/);
  assert.match(editorSource, /disabled=\{disabled \|\| moduleSlots\.length === 0\}/);
  assert.match(editorSource, /moduleSlots/);
  assert.match(editorSource, /Region \/ area \/ columna/);
  assert.match(editorSource, /const selectedSlot = moduleSlots\.find/);
  assert.match(editorSource, /width: selectedSlot\.width/);
  assert.match(editorSource, /containerMode/);
  assert.match(editorSource, /modulePlacementIssues/);
  assert.match(editorSource, /placementMatchesSlot/);
  assert.match(editorSource, /Orden .* duplicado/);
  assert.match(editorSource, /alertas de placement/);
  assert.match(cssSource, /cmsEditorValidation/);
  assert.match(cssSource, /cmsSavedVisualPresetList/);
  assert.match(cssSource, /cmsVisualModuleContentFieldset/);
  assert.match(cssSource, /cmsEditorValidationWarning/);
  assert.match(cssSource, /cmsEditorValidationOk/);
  assert.match(cssSource, /cmsReadinessPanel/);
  assert.match(cssSource, /cmsReadinessGrid/);
  assert.match(cssSource, /cmsReadinessItemWarning/);
  assert.match(cssSource, /cmsReadinessItemOk/);
  assert.match(editorSource, /CmsPlpStorefrontPreviewRenderer/);
  assert.match(editorSource, /CmsLayoutPreview/);
  assert.match(layoutPreviewSource, /CmsBlockRenderer/);
  assert.match(rendererSource, /Ordenar por: Relevancia/);
  assert.match(rendererSource, /Hummingbird printed t-shirt/);
  assert.match(rendererSource, /VisualModuleBlock/);
  assert.match(rendererSource, /VisualModuleV2Block/);
  assert.match(rendererSource, /normalizeCmsVisualModuleForRenderer/);
  assert.match(rendererSource, /visualModuleV2RootNode/);
  assert.match(rendererSource, /visualStyleValueForCss/);
  assert.match(rendererSource, /binding:/);
  assert.match(rendererSource, /visualStyleBindingValue/);
  assert.match(rendererSource, /rawValue\.startsWith\("binding:"\)/);
  assert.match(rendererSource, /visualRuntimeStyleValueIsSafe/);
  assert.match(rendererSource, /visualAssetUrl/);
  assert.match(rendererSource, /visualAssetPreviewUrl/);
  assert.match(rendererSource, /api\/admin\/media-assets/);
  assert.match(rendererSource, /visualTokenValueForCss/);
  assert.match(rendererSource, /data-cms-visual-schema-version="2"/);
  assert.match(rendererSource, /VisualNodeRenderer/);
  assert.match(rendererSource, /visualNodeBoundProps/);
  assert.match(rendererSource, /visualAnimationClassNames/);
  assert.match(rendererSource, /visualVisibilityClassNames/);
  assert.match(rendererSource, /visualHeadingTag/);
  assert.match(rendererSource, /prefers-reduced-motion|cmsVisualAnimated/);
  assert.match(rendererSource, /contentValues=\{legacyContentValues\}/);
  assert.match(rendererSource, /maximumVisualNodeDepth = 8/);
  assert.match(rendererSource, /maximumVisualChildrenPerNode = 24/);
  assert.match(rendererSource, /normalizeCmsVisualModuleProps/);
  assert.match(rendererSource, /responsiveStyles/);
  assert.match(rendererSource, /visualViewport/);
  assert.match(rendererSource, /visualViewportStyleValue/);
  assert.match(rendererSource, /visualModuleContentStyleOverrides/);
  assert.match(rendererSource, /visualModuleStyleKeyFromContentField/);
  assert.match(rendererSource, /\\b\(background\|fondo\)\\b/);
  assert.match(rendererSource, /\\b\(margin\|margen\)\\b/);
  assert.match(rendererSource, /visualStyleVariableKeys/);
  assert.match(rendererSource, /style\[key\] = resolvedBaseValue/);
  assert.match(rendererSource, /style\[key\] = resolvedScopedValue/);
  assert.match(rendererSource, /cmsPreviewVisualModule/);
  assert.match(cssSource, /\.cmsVisualNode/);
  assert.match(cssSource, /background-repeat: no-repeat/);
  assert.match(rendererSource, /node\.type === "htmlEmbed"/);
  assert.match(editorSource, /Preview draft/);
  assert.match(editorSource, /Target PLP/);
});

test("cms page deletion uses the tenant-scoped BFF contract", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
    });
    const raw = { pageId: "page-1", deleted: true };
    return {
      ok: true,
      data: options.parse ? options.parse(raw) : raw,
      correlationId: "corr-delete-page",
    };
  };
  const { deleteCmsPage } = loadCmsAdminModule(requestAdminBff);

  const result = await deleteCmsPage(context, "page-1", "es-ES");

  assert.equal(result.ok, true);
  assert.equal(result.data.pageId, "page-1");
  assert.equal(result.data.deleted, true);
  assert.deepEqual(calls, [{
    method: "DELETE",
    path: "/admin/cms/pages/page-1?organizationId=org-1&shopId=shop-1&locale=es-ES",
  }]);
});

test("cms settings client exposes scoped BFF accessors", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
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
    getCmsFontOptions,
    getCmsGlobalSettings,
    getCmsPageSettings,
    getCmsResolvedPageSettings,
    patchCmsGlobalSettings,
    patchCmsPageSettings,
  } = loadCmsAdminModule(requestAdminBff);

  const global = await getCmsGlobalSettings(context, "es-ES");
  const fontOptions = await getCmsFontOptions(context, "es-ES");
  const patchedGlobal = await patchCmsGlobalSettings(context, { tokens: { maxWidth: "1440px" } }, "es-ES");
  const pageSettings = await getCmsPageSettings(context, "page-1", "es-ES");
  await patchCmsPageSettings(context, "page-1", { overrides: { maxWidth: "1440px" } }, "es-ES");
  const resolved = await getCmsResolvedPageSettings(context, "page-1", "es-ES");

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
  assert.deepEqual(calls.map((call) => [call.method, call.path]), [
    ["GET", "/admin/cms/settings/global?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["GET", "/admin/cms/font-options?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["PATCH", "/admin/cms/settings/global?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["GET", "/admin/cms/pages/page-1/settings?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["PATCH", "/admin/cms/pages/page-1/settings?organizationId=org-1&shopId=shop-1&locale=es-ES"],
    ["GET", "/admin/cms/pages/page-1/resolved-settings?organizationId=org-1&shopId=shop-1&locale=es-ES"],
  ]);
});

test("cms visual module definitions use shop-scoped BFF writes", async () => {
  const calls = [];
  const requestAdminBff = async (pathValue, options = {}) => {
    calls.push({
      path: pathValue,
      method: options.init?.method ?? "GET",
      body: options.init?.body ? JSON.parse(String(options.init.body)) : null,
    });

    const raw = {
      definitionId: "definition-1",
      organizationId: "org-1",
      shopId: "shop-1",
      moduleId: "heroModule-test",
      name: "Hero reusable",
      schemaVersion: 2,
      schemaMinorVersion: 0,
      revision: 2,
      status: pathValue.includes("/archive") ? "ARCHIVED" : pathValue.includes("/activate") ? "ACTIVE" : "DRAFT",
      module: {
        schemaVersion: 2,
        moduleId: "heroModule-test",
        type: "visual.module",
        panels: [{ panelId: "heroModule-test-panel", type: "section" }],
        contentSchema: {},
      },
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      activatedAt: pathValue.includes("/activate") ? "2026-07-29T00:00:00.000Z" : null,
      archivedAt: pathValue.includes("/archive") ? "2026-07-29T00:00:00.000Z" : null,
    };

    return { ok: true, data: options.parse ? options.parse(raw) : raw, correlationId: "corr-visual-write" };
  };
  const {
    activateCmsVisualModuleDefinition,
    archiveCmsVisualModuleDefinition,
    createCmsVisualModuleDefinition,
    createCmsVisualModuleDefinitionDraftRevision,
    updateCmsVisualModuleDefinitionDraft,
  } = loadCmsAdminModule(requestAdminBff);
  const modulePayload = {
    schemaVersion: 2,
    moduleId: "heroModule-test",
    type: "visual.module",
    panels: [{ panelId: "heroModule-test-panel", type: "section" }],
    contentSchema: {},
  };

  const created = await createCmsVisualModuleDefinition(context, { name: "Hero reusable", module: modulePayload });
  const updated = await updateCmsVisualModuleDefinitionDraft(context, "definition-1", { name: "Hero reusable v2", module: modulePayload });
  const draftRevision = await createCmsVisualModuleDefinitionDraftRevision(context, "definition-1", { name: "Hero reusable v3" });
  const activated = await activateCmsVisualModuleDefinition(context, "definition-1");
  const archived = await archiveCmsVisualModuleDefinition(context, "definition-1");

  assert.equal(created.data.definitionId, "definition-1");
  assert.equal(updated.data.status, "DRAFT");
  assert.equal(draftRevision.data.status, "DRAFT");
  assert.equal(activated.data.status, "ACTIVE");
  assert.equal(archived.data.status, "ARCHIVED");
  assert.deepEqual(calls.map((call) => [call.method, call.path]), [
    ["POST", "/admin/cms/visual-modules?organizationId=org-1&shopId=shop-1"],
    ["PATCH", "/admin/cms/visual-modules/definition-1/draft?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/cms/visual-modules/definition-1/draft-revisions?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/cms/visual-modules/definition-1/activate?organizationId=org-1&shopId=shop-1"],
    ["POST", "/admin/cms/visual-modules/definition-1/archive?organizationId=org-1&shopId=shop-1"],
  ]);
  assert.equal(calls.every((call) => !call.path.includes("locale=") && !call.path.includes("pageId=")), true);
  assert.equal(calls[0].body.name, "Hero reusable");
  assert.equal(calls[1].body.name, "Hero reusable v2");
  assert.equal(calls[2].body.name, "Hero reusable v3");
  assert.deepEqual(calls[3].body, {});
  assert.deepEqual(calls[4].body, {});
});


function settingsActions(permissions=['cms.settings.write']) {
  const calls=[];
  const actions=loadTsModule('src/modules/cms/cms-admin-actions.ts',specifier=>({
    'next/cache':{revalidatePath(){}},
    'next/navigation':{redirect(destination){throw Object.assign(new Error('redirect'),{destination});}},
    '../auth/current-admin-session':{getCurrentAdminSession:async()=>({scope:'admin',permissions})},
    '../../shared/config/admin-context':{getAdminContext:async()=>context},
    './cms-admin':{
      cmsTypographyTokenFromFamily:(_slot,family)=>({family}),
      patchCmsGlobalSettings:async(...args)=>{calls.push({operation:'global',args});return {ok:true};},
      patchCmsPageSettings:async(...args)=>{calls.push({operation:'page',args});return {ok:true};},
    },
  }[specifier]??{}));
  return {actions,calls};
}
test('global design save preserves stored layouts by sending tokens only and requires write permission',async()=>{
  const form=new FormData();form.set('locale','es-ES');form.set('maxWidth','1360px');form.set('layoutJson',JSON.stringify({regions:{main:{areas:[]}}}));
  const {actions,calls}=settingsActions();
  await assert.rejects(actions.saveCmsGlobalSettingsAction(form),error=>error.destination?.startsWith('/admin/cms/ajustes-basicos?'));
  assert.equal(calls.length,1);assert.equal(calls[0].operation,'global');
  assert.deepEqual(Object.keys(calls[0].args[1]),['tokens']);
  assert.equal(calls[0].args[1].tokens.maxWidth,'1360px');assert.equal(calls[0].args[1].layout,undefined);
  const reader=settingsActions(['cms.settings.read']);
  await assert.rejects(reader.actions.saveCmsGlobalSettingsAction(form),/No tienes permiso/);assert.equal(reader.calls.length,0);
});
test('page settings no longer assign or detach old templates from posted values',async()=>{
  const {actions,calls}=settingsActions(),form=new FormData();
  form.set('pageId','page-1');form.set('templateId','retired-template');form.set('settingsMode','inherit');
  await assert.rejects(actions.saveCmsPageSettingsAction(form),error=>error.destination?.startsWith('/admin/cms?'));
  assert.equal(calls.length,1);assert.equal(calls[0].operation,'page');
  assert.equal(Object.hasOwn(calls[0].args[2],'templateId'),false);
});
