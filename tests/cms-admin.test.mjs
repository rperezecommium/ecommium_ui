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
  return loadTsModule("packages/cms-blocks/src/index.ts");
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
  const builderPageSource = readFileSync(path.resolve(root, "app/(admin)/admin/cms/builder/page.tsx"), "utf8");
  const settingsViewSource = readFileSync(path.resolve(root, "src/modules/cms/cms-basic-settings-page.tsx"), "utf8");
  const layoutEditorSource = readFileSync(path.resolve(root, "src/modules/cms/cms-layout-area-editor-client.tsx"), "utf8");
  const blockBuilderSource = readFileSync(path.resolve(root, "src/modules/cms/cms-block-builder-client.tsx"), "utf8");
  const actionsSource = readFileSync(path.resolve(root, "src/modules/cms/cms-admin-actions.ts"), "utf8");

  assert.match(shellSource, /href: "\/admin\/cms"/);
  assert.match(shellSource, /href: "\/admin\/cms\/builder"/);
  assert.match(shellSource, /href: "\/admin\/cms\/ajustes-basicos"/);
  assert.match(shellSource, /label: "CMS"/);
  assert.match(shellSource, /label: "Builder"/);
  assert.match(shellSource, /label: "Ajustes basicos"/);
  assert.match(permissionsSource, /"admin:cms:view"/);
  assert.match(permissionsSource, /"admin:cms-settings:view"/);
  assert.match(permissionsSource, /"admin:cms-builder:view"/);
  assert.match(permissionsSource, /cms\.pages\.read/);
  assert.match(permissionsSource, /cms\.settings\.read/);
  assert.match(pageSource, /getCmsAdminData/);
  assert.match(settingsPageSource, /Ajustes basicos/);
  assert.match(settingsPageSource, /admin:cms-settings:view/);
  assert.match(builderPageSource, /admin:cms-builder:view/);
  assert.match(builderPageSource, /CmsBlockBuilderPage/);
  assert.match(builderPageSource, /getCmsAdminData/);
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
  assert.match(blockBuilderSource, /blockId: "cms-builder-empty-banner-hero"/);
  assert.match(actionsSource, /saveCmsGlobalSettingsAction/);
  assert.match(actionsSource, /saveCmsBuilderDraftAction/);
  assert.match(actionsSource, /saveCmsVisualModuleDefinitionAction/);
  assert.match(actionsSource, /visualDefinitionIntent.*publish|intent === "publish"/s);
  assert.match(actionsSource, /Modulo visual publicado y agregado a Bloques guardados/);
  assert.match(actionsSource, /visualDefinitionReturn/);
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
  assert.match(actionsSource, /createCmsTemplateAction/);
  assert.match(actionsSource, /saveCmsTemplateSettingsAction/);
  assert.match(actionsSource, /createCmsTemplate/);
  assert.match(actionsSource, /patchCmsTemplate/);
  assert.match(actionsSource, /patchCmsGlobalSettings/);
  assert.match(actionsSource, /cmsTypographyTokenFromFamily/);
  assert.match(actionsSource, /cms\.settings\.write/);
  assert.match(actionsSource, /cmsBuilderMessage/);
  assert.match(actionsSource, /Draft CMS guardado desde Builder/);
  assert.match(actionsSource, /visualModuleSaveError/);
  assert.match(actionsSource, /normalizeCmsVisualModuleProps/);
  assert.match(actionsSource, /normalizeArea/);
  assert.match(actionsSource, /areas\.map/);
  assert.match(actionsSource, /overrides: templateOverrides/);
});

test("cms block builder exposes the first interactive builder surface", () => {
  const readmeSource = readFileSync(path.resolve(root, "README.md"), "utf8");
  const packageReadmeSource = readFileSync(path.resolve(root, "packages/cms-blocks/README.md"), "utf8");
  const routeSource = readFileSync(path.resolve(root, "app/(admin)/admin/cms/builder/page.tsx"), "utf8");
  const pageSource = readFileSync(path.resolve(root, "src/modules/cms/cms-block-builder-page.tsx"), "utf8");
  const clientSource = readFileSync(path.resolve(root, "src/modules/cms/cms-block-builder-client.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(readmeSource, /## CMS Block Builder/);
  assert.match(readmeSource, /\/admin\/cms\/builder/);
  assert.match(readmeSource, /Portabilidad JSON/);
  assert.match(readmeSource, /saveCmsBuilderDraftAction/);
  assert.match(readmeSource, /normalized `props\.tree`/);
  assert.match(readmeSource, /visual presets/);
  assert.match(readmeSource, /localStorage/);
  assert.match(readmeSource, /blocksFromJson/);
  assert.match(packageReadmeSource, /Contrato para builders externos/);
  assert.match(packageReadmeSource, /CmsBlock\[\]/);
  assert.match(packageReadmeSource, /se guarda dentro del/);
  assert.match(packageReadmeSource, /resolved-settings/);
  assert.match(packageReadmeSource, /visual presets/);
  assert.match(packageReadmeSource, /Validaciones esperadas en UI/);
  assert.match(routeSource, /getAdminSession/);
  assert.match(routeSource, /getCmsAdminData/);
  assert.match(routeSource, /cmsBuilderMessage/);
  assert.match(routeSource, /admin:cms-builder:view/);
  assert.match(pageSource, /CMS Block Builder/);
  assert.match(pageSource, /pageVersionBlocks/);
  assert.match(pageSource, /saveCmsBuilderDraftAction/);
  assert.match(pageSource, /saveCmsVisualModuleDefinitionAction/);
  assert.match(pageSource, /canSaveDraft/);
  assert.match(pageSource, /seoTitle/);
  assert.match(pageSource, /seoDescription/);
  assert.match(pageSource, /resolvedCanvas/);
  assert.match(pageSource, /resolvedSummary/);
  assert.match(pageSource, /Biblioteca visual/);
  assert.match(pageSource, /visualModuleStats/);
  assert.match(pageSource, /data\.visualModules/);
  assert.match(cssSource, /cmsBlockBuilderVisualLibrary/);
  assert.match(cssSource, /cmsBlockBuilderVisualModuleList/);
  assert.match(cssSource, /cmsBlockBuilderVisualModuleItem/);
  assert.match(cssSource, /cmsBlockBuilderVisualDefinitionForm/);
  assert.match(cssSource, /cmsBlockBuilderVisualDefinitionActions/);
  assert.match(clientSource, /"use client"/);
  assert.match(clientSource, /initialBlocks/);
  assert.match(clientSource, /pageOptions/);
  assert.match(clientSource, /CmsBlockBuilderResolvedCanvas/);
  assert.match(clientSource, /Pagina cargada/);
  assert.match(clientSource, /Canvas libre/);
  assert.match(clientSource, /getCmsBlockDefinitions/);
  assert.match(clientSource, /getCmsBlockDefinition/);
  assert.match(clientSource, /editorFields/);
  assert.match(clientSource, /createCmsBlockFromPreset/);
  assert.match(clientSource, /CmsBlockRenderer/);
  assert.match(clientSource, /CmsPlpStorefrontPreviewRenderer/);
  assert.match(clientSource, /blocksFromJson/);
  assert.match(clientSource, /blocksToJson/);
  assert.match(clientSource, /ArrowUp/);
  assert.match(clientSource, /ArrowDown/);
  assert.match(clientSource, /Clipboard/);
  assert.match(clientSource, /CopyPlus/);
  assert.match(clientSource, /FileJson/);
  assert.match(clientSource, /Trash2/);
  assert.match(clientSource, /Upload/);
  assert.match(clientSource, /BuilderBlockFields/);
  assert.match(clientSource, /BuilderPlacementFields/);
  assert.match(clientSource, /BuilderPlpTargetFields/);
  assert.match(clientSource, /BuilderJsonField/);
  assert.match(clientSource, /BuilderPreviewItem/);
  assert.match(clientSource, /duplicateBlock/);
  assert.match(clientSource, /moveBlock/);
  assert.match(clientSource, /moveArrayItem/);
  assert.match(clientSource, /renumberModuleSlotOrders/);
  assert.match(clientSource, /builderValidationIssues/);
  assert.match(clientSource, /CmsBlockBuilderValidationIssue/);
  assert.match(clientSource, /CmsBlockBuilderState/);
  assert.match(clientSource, /cmsBlockBuilderReducer/);
  assert.match(clientSource, /builderHistoryLimit = 40/);
  assert.match(clientSource, /history: \{ future: \[\], past: \[\] \}/);
  assert.match(clientSource, /type: "undo"/);
  assert.match(clientSource, /type: "redo"/);
  assert.match(clientSource, /setMediaUpload/);
  assert.match(clientSource, /mediaUploads/);
  assert.match(clientSource, /Undo2/);
  assert.match(clientSource, /Redo2/);
  assert.match(clientSource, /Historial del Builder/);
  assert.match(clientSource, /type: "mutateBlocks"/);
  assert.match(clientSource, /visualStylePropertyRegistry/);
  assert.match(clientSource, /CmsVisualStylePropertyDefinition/);
  assert.match(clientSource, /visualStyleTargetForNode/);
  assert.match(clientSource, /normalizeVisualStyleJsonObject/);
  assert.match(clientSource, /VisualStylePropertyControl/);
  assert.match(clientSource, /Styles JSON directo/);
  assert.match(clientSource, /JSON sincronizado con inputs y preview/);
  assert.match(clientSource, /data-style-key=\{field\.key\}/);
  assert.match(clientSource, /placeholder="asset:hero-background"/);
  assert.match(clientSource, /uploadCmsBuilderMediaAction/);
  assert.match(clientSource, /CmsVisualAssetRef/);
  assert.match(clientSource, /VisualMediaReferenceControl/);
  assert.match(clientSource, /upsertVisualBlockAssetRef/);
  assert.match(clientSource, /removeVisualBlockAssetRef/);
  assert.match(clientSource, /visualBuilderAssetPreviewUrl/);
  assert.match(clientSource, /accept="image\/\*,video\/\*"/);
  assert.match(clientSource, /Quitar media/);
  assert.match(clientSource, /CmsVisualContentField/);
  assert.match(clientSource, /CmsVisualContentSchema/);
  assert.match(clientSource, /Content binding/);
  assert.match(clientSource, /Visibility/);
  assert.match(clientSource, /Motion/);
  assert.match(clientSource, /Hover styles JSON/);
  assert.match(clientSource, /normalizeVisualHoverStyleJsonObject/);
  assert.match(clientSource, /backgroundColor.*no es una key hover permitida|Hover sincronizado con preview/s);
  assert.match(clientSource, /updateSelectedVisualNodeHoverStyles/);
  assert.match(clientSource, /onHoverTransitionChange/);
  assert.match(clientSource, /updateSelectedVisualNodeVisibility/);
  assert.match(clientSource, /updateSelectedVisualNodeAnimation/);
  assert.match(clientSource, /visualModuleAccessibilityIssues/);
  assert.match(clientSource, /visualHeadingLevel/);
  assert.match(clientSource, /updateSelectedVisualNodeContentBinding/);
  assert.match(clientSource, /VisualModuleContentEditor/);
  assert.match(clientSource, /VisualContentSchemaJsonField/);
  assert.match(clientSource, /VisualContentValuesEditor/);
  assert.match(clientSource, /Inferir schema desde bindings/);
  assert.match(clientSource, /Contenido de instancia/);
  assert.match(clientSource, /visualModuleContentValidationIssues/);
  assert.match(clientSource, /Valores sin schema actual/);
  assert.match(clientSource, /key: "borderRadius"/);
  assert.match(clientSource, /control: "radius"/);
  assert.match(clientSource, /key: "backgroundImage"/);
  assert.match(clientSource, /control: "media"/);
  assert.match(clientSource, /key: "display"/);
  assert.match(clientSource, /key: "flexDirection"/);
  assert.match(clientSource, /property: "display", values: \["flex"\]/);
  assert.match(clientSource, /validationErrorCount/);
  assert.match(clientSource, /validationWarningCount/);
  assert.match(clientSource, /canSubmitDraft/);
  assert.match(clientSource, /builderBlocksForSave/);
  assert.match(clientSource, /NEXT_PUBLIC_ECOMMIUM_CMS_VISUAL_MODULE_V2_ROLLOUT/);
  assert.match(clientSource, /cmsVisualModuleV2RolloutModes/);
  assert.match(clientSource, /visualModuleBlockForRollout/);
  assert.match(clientSource, /migrateCmsVisualModuleV1ToV2ForRenderer/);
  assert.match(clientSource, /visualModuleSaveSummary/);
  assert.match(clientSource, /visualModuleValidationIssues/);
  assert.match(clientSource, /visualNodeHasRenderableContent/);
  assert.match(clientSource, /visualNodeIds/);
  assert.match(clientSource, /CmsVisualModulePreset/);
  assert.match(clientSource, /definitionId/);
  assert.match(clientSource, /revision/);
  assert.match(clientSource, /schemaMinorVersion/);
  assert.match(clientSource, /status: "ACTIVE"/);
  assert.match(clientSource, /visualModulePresetsStorageKey/);
  assert.match(clientSource, /normalizeVisualModulePreset/);
  assert.match(clientSource, /visualModulePresetsFromJson/);
  assert.match(clientSource, /visualModulePresetsToJson/);
  assert.match(clientSource, /window\.localStorage/);
  assert.match(clientSource, /copyExportJson/);
  assert.match(clientSource, /loadCurrentExportIntoImport/);
  assert.match(clientSource, /applyImportedBlocks/);
  assert.match(clientSource, /Portabilidad JSON/);
  assert.match(clientSource, /Import JSON/);
  assert.match(clientSource, /Aplicar JSON/);
  assert.match(clientSource, /JSON copiado/);
  assert.match(clientSource, /bloques importados/);
  assert.match(clientSource, /Corrige los errores antes de guardar el draft/);
  assert.match(clientSource, /Validacion local con registry/);
  assert.match(clientSource, /requiere/);
  assert.match(clientSource, /slot que no existe/);
  assert.match(clientSource, /Orden .* duplicado/);
  assert.match(clientSource, /URL PLP ni slug de categoria/);
  assert.match(clientSource, /onPropChange/);
  assert.match(clientSource, /onPlacementChange/);
  assert.match(clientSource, /onSurfaceChange/);
  assert.match(clientSource, /saveDraftAction/);
  assert.match(clientSource, /blocksJson/);
  assert.match(clientSource, /Cambios locales pendientes/);
  assert.match(clientSource, /Guardar draft desde Builder/);
  assert.match(clientSource, /visualBlockPresets/);
  assert.match(clientSource, /totalBlockLibraryItems/);
  assert.match(clientSource, /Crear nuevo módulo/);
  assert.match(clientSource, /cmsBlockBuilderCreateVisualButton/);
  assert.match(clientSource, /createBlankVisualModuleBlock/);
  assert.match(clientSource, /addBlankVisualModuleBlock/);
  assert.match(clientSource, /name: "Nuevo modulo visual"/);
  assert.match(clientSource, /onClick=\{addBlankVisualModuleBlock\}/);
  assert.match(clientSource, /selectedVisualTreeIsEmpty/);
  assert.match(clientSource, /VisualModuleStarter/);
  assert.match(clientSource, /Construir modulo/);
  assert.match(clientSource, /Editar root avanzado/);
  assert.match(clientSource, /cmsBlockBuilderVisualRootAction/);
  assert.match(clientSource, /selectVisualNode", nodeId: selectedVisualTree\.nodeId/);
  assert.match(clientSource, /definition\.type === "visual\.module" \? null/);
  assert.match(clientSource, /Bloques visuales/);
  assert.match(clientSource, /SYSTEM visual\.module/);
  assert.match(clientSource, /CMS visual\.module guardado/);
  assert.match(clientSource, /guardado y agregado a la lista de bloques/);
  assert.match(clientSource, /Guardar en lista de bloques/);
  assert.match(clientSource, /fallbackPreset = systemVisualModulePresets\[0\]/);
  assert.match(clientSource, /canSaveBlock = canSaveOrReplace \|\| presets\.length > 0/);
  assert.match(clientSource, /visual\.module listo/);
  assert.match(clientSource, /cambios solo se guardan en borradores/);
  assert.match(clientSource, /Region \/ area \/ columna/);
  assert.match(clientSource, /Target PLP/);
  assert.match(clientSource, /Props JSON/);
  assert.match(clientSource, /JSON invalido/);
  assert.match(clientSource, /defaultColumnGap/);
  assert.match(clientSource, /defaultModuleGap/);
  assert.match(clientSource, /gridTemplateColumns/);
  assert.match(clientSource, /ResolvedPageCanvas/);
  assert.match(clientSource, /Slot vacio/);
  assert.match(clientSource, /Sin slot valido/);
  assert.match(clientSource, /Desktop/);
  assert.match(clientSource, /Tablet/);
  assert.match(clientSource, /Mobile/);
  assert.match(clientSource, /visualNodeCatalog/);
  assert.match(clientSource, /VisualNodeLibrary/);
  assert.match(clientSource, /VisualModulePresetLibrary/);
  assert.match(clientSource, /saveVisualModuleDefinitionAction/);
  assert.match(clientSource, /createCmsVisualModuleReferenceBlock/);
  assert.match(clientSource, /builderBlocksForCmsDraftPayload/);
  assert.match(clientSource, /visualDefinitionReference/);
  assert.match(clientSource, /addCmsVisualModuleReference/);
  assert.match(clientSource, /visualModuleDefinitionModuleFromBlock/);
  assert.match(clientSource, /selectedVisualDefinitionModuleJson/);
  assert.match(clientSource, /visualDefinitionIntent/);
  assert.match(clientSource, /Insertar referencia/);
  assert.match(clientSource, /Guardar en CMS/);
  assert.match(clientSource, /Publicar modulo/);
  assert.match(clientSource, /currentBlocksJson/);
  assert.match(clientSource, /visualBlockId/);
  assert.match(clientSource, /pageSummary\.seoTitle/);
  assert.match(clientSource, /selectedBlockIsCmsReference/);
  assert.match(clientSource, /canPublishSelectedBlock/);
  assert.match(clientSource, /canCreateDefinitionFromSelectedBlock/);
  assert.match(clientSource, /disabled=\{!canCreateDefinitionFromSelectedBlock\}/);
  assert.match(clientSource, /Publicado en CMS/);
  assert.match(clientSource, /Actualizar draft/);
  assert.match(clientSource, /Nueva revision/);
  assert.match(clientSource, /createDraftRevision/);
  assert.match(clientSource, /Activar/);
  assert.match(clientSource, /Archivar/);
  assert.match(clientSource, /cmsBlockBuilderVisualDefinitionArchiveForm/);
  assert.match(clientSource, /createSystemVisualModulePresets/);
  assert.match(clientSource, /Hero prototype images/);
  assert.match(clientSource, /system-heroModule-prototype-images-001/);
  assert.match(clientSource, /Sol High split hero/);
  assert.match(clientSource, /system-sol-high-split-hero-001/);
  assert.match(clientSource, /createSolHighSplitHeroTree/);
  assert.match(clientSource, /Consult works split CTA/);
  assert.match(clientSource, /system-consult-works-split-cta-001/);
  assert.match(clientSource, /leftOverlayOpacity/);
  assert.match(clientSource, /rightPanelBackgroundColor/);
  assert.match(clientSource, /FourInfoSquares/);
  assert.match(clientSource, /system-four-info-squares-001/);
  assert.match(clientSource, /createFourInfoSquaresTree/);
  assert.match(clientSource, /cardMargin/);
  assert.match(clientSource, /cardTextColor/);
  assert.match(clientSource, /card1BackgroundColor/);
  assert.match(clientSource, /columnRatio/);
  assert.match(clientSource, /type="range"/);
  assert.match(clientSource, /% imagen \/ .*% contenido/);
  assert.match(clientSource, /Book a Consultation/);
  assert.match(clientSource, /Explore Our Work/);
  assert.match(clientSource, /assetRefs: preset\.assetRefs/);
  assert.match(clientSource, /mergeVisualModulePresets/);
  assert.match(clientSource, /presets disponibles/);
  assert.match(clientSource, /Los presets del sistema no se eliminan/);
  assert.match(clientSource, /createVisualBuilderNode/);
  assert.match(clientSource, /addVisualNodeToSelectedBlock/);
  assert.match(clientSource, /addVisualNodeToParent/);
  assert.match(clientSource, /VisualNodeTreeEditor/);
  assert.match(clientSource, /VisualNodeTreeItem/);
  assert.match(clientSource, /selectedVisualNodeId/);
  assert.match(clientSource, /selectedVisualNode/);
  assert.match(clientSource, /findVisualNode/);
  assert.match(clientSource, /visualTreeWithUniqueNodeIds/);
  assert.match(clientSource, /visualBlockWithUniqueNodeIds/);
  assert.match(clientSource, /updateVisualNodeChildren/);
  assert.match(clientSource, /removeVisualNodeFromBlock/);
  assert.match(clientSource, /duplicateVisualNodeInBlock/);
  assert.match(clientSource, /moveVisualNodeInBlock/);
  assert.match(clientSource, /updateVisualNodeInBlock/);
  assert.match(clientSource, /VisualNodeInspector/);
  assert.match(clientSource, /visualNodePropFields/);
  assert.match(clientSource, /visualStylePropertyRegistry/);
  assert.match(clientSource, /visualContainerNodeTypes/);
  assert.match(clientSource, /visualNodeMoveTargets/);
  assert.match(clientSource, /findVisualParentId/);
  assert.match(clientSource, /extractVisualNodeFromChildren/);
  assert.match(clientSource, /moveVisualNodeToParentInBlock/);
  assert.match(clientSource, /moveVisualNodeOutInBlock/);
  assert.match(clientSource, /remapVisualNodeIds/);
  assert.match(clientSource, /replaceVisualNodeInBlock/);
  assert.match(clientSource, /visualImportDraft/);
  assert.match(clientSource, /visualPortabilityMessage/);
  assert.match(clientSource, /copySelectedVisualNodeJson/);
  assert.match(clientSource, /copyVisualTreeJson/);
  assert.match(clientSource, /loadSelectedVisualNodeIntoImport/);
  assert.match(clientSource, /loadVisualTreeIntoImport/);
  assert.match(clientSource, /applyVisualImportAsChild/);
  assert.match(clientSource, /replaceSelectedVisualNodeFromImport/);
  assert.match(clientSource, /saveSelectedVisualModulePreset/);
  assert.match(clientSource, /contentSchema = inferredVisualContentSchema/);
  assert.match(clientSource, /contentValues = \{/);
  assert.match(clientSource, /preset\.contentSchema/);
  assert.match(clientSource, /preset\.contentValues/);
  assert.match(clientSource, /field\.type === "color"/);
  assert.match(clientSource, /visualStyleBindingsForNode/);
  assert.match(clientSource, /binding:/);
  assert.match(clientSource, /applyVisualModulePresetAsBlock/);
  assert.match(clientSource, /replaceSelectedVisualModuleWithPreset/);
  assert.match(clientSource, /deleteVisualModulePreset/);
  assert.match(clientSource, /normalizeCmsVisualNode/);
  assert.match(clientSource, /canMoveVisualNodeOut/);
  assert.match(clientSource, /moveSelectedVisualNodeToParent/);
  assert.match(clientSource, /moveSelectedVisualNodeOut/);
  assert.match(clientSource, /updateSelectedVisualNodeLabel/);
  assert.match(clientSource, /updateSelectedVisualNodeProp/);
  assert.match(clientSource, /updateSelectedVisualNodeStyle/);
  assert.match(clientSource, /updateSelectedVisualNodeResponsiveStyle/);
  assert.match(clientSource, /visualStyleScope/);
  assert.match(clientSource, /visualStyleScopes/);
  assert.match(clientSource, /responsiveStyles/);
  assert.match(clientSource, /visualViewport=\{viewport\}/);
  assert.match(clientSource, /cloneVisualBuilderNode/);
  assert.match(clientSource, /normalizeCmsVisualModuleProps/);
  assert.match(clientSource, /Nodos visuales/);
  assert.match(clientSource, /Arbol visual/);
  assert.match(clientSource, /Nodo seleccionado/);
  assert.match(clientSource, /Portabilidad visual/);
  assert.match(clientSource, /Presets visuales/);
  assert.match(clientSource, /Guardar en lista de bloques/);
  assert.match(clientSource, /Insertar/);
  assert.match(clientSource, /Reemplazar/);
  assert.match(clientSource, /Import visual JSON/);
  assert.match(clientSource, /Importar como hijo/);
  assert.match(clientSource, /Reemplazar nodo/);
  assert.match(clientSource, /Mover nodo/);
  assert.match(clientSource, /Mover dentro de/);
  assert.match(clientSource, /Sacar un nivel/);
  assert.match(clientSource, /Styles responsive/);
  assert.match(clientSource, /Base/);
  assert.match(clientSource, /Desktop/);
  assert.match(clientSource, /Tablet/);
  assert.match(clientSource, /Mobile/);
  assert.match(clientSource, /Nodo JSON/);
  assert.match(clientSource, /marginLeft/);
  assert.match(clientSource, /gridTemplateColumns/);
  assert.match(clientSource, /Selecciona el nodo destino/);
  assert.match(clientSource, /Selecciona visual\.module/);
  assert.match(clientSource, /Container/);
  assert.match(clientSource, /Grid/);
  assert.match(clientSource, /Button/);
  assert.match(clientSource, /HTML embed/);
  assert.match(cssSource, /cmsBlockBuilderResolvedCanvas/);
  assert.match(cssSource, /cmsBlockBuilderColumns/);
  assert.match(cssSource, /cmsBlockBuilderFields/);
  assert.match(cssSource, /cmsBlockBuilderPreviewActions/);
  assert.match(cssSource, /cmsBlockBuilderCreateVisualButton/);
  assert.match(cssSource, /cmsBlockBuilderSavedBlocks/);
  assert.match(cssSource, /cmsBlockBuilderPreviewContent/);
  assert.match(cssSource, /cmsBlockBuilderValidation/);
  assert.match(cssSource, /cmsBlockBuilderMediaUploads/);
  assert.match(cssSource, /cmsBlockBuilderValidationError/);
  assert.match(cssSource, /cmsBlockBuilderIssueButton/);
  assert.match(cssSource, /cmsBlockBuilderPortablePanel/);
  assert.match(cssSource, /cmsBlockBuilderPortabilityActions/);
  assert.match(cssSource, /cmsBlockBuilderImportMessage/);
  assert.match(cssSource, /cmsBlockBuilderSavePanel/);
  assert.match(cssSource, /cmsBlockBuilderWorkspace/);
  assert.match(cssSource, /cmsBlockBuilderPreviewFrameMobile/);
  assert.match(cssSource, /cmsBlockBuilderVisualNodes/);
  assert.match(cssSource, /cmsBlockBuilderVisualPresets/);
  assert.match(cssSource, /cmsBlockBuilderVisualPresetList/);
  assert.match(cssSource, /cmsBlockBuilderVisualDefinitionList/);
  assert.match(cssSource, /cmsBlockBuilderVisualDefinitionItem/);
  assert.match(cssSource, /cmsBlockBuilderVisualDefinitionItemActions/);
  assert.match(cssSource, /cmsBlockBuilderVisualDefinitionArchiveForm/);
  assert.match(cssSource, /cmsBlockBuilderVisualPresetItem/);
  assert.match(cssSource, /cmsBlockBuilderVisualPresetActions/);
  assert.match(cssSource, /cmsBlockBuilderVisualStarter/);
  assert.match(cssSource, /cmsBlockBuilderVisualStarterGrid/);
  assert.match(cssSource, /cmsBlockBuilderVisualAdvancedRoot/);
  assert.match(cssSource, /cmsBlockBuilderVisualRootAction/);
  assert.match(cssSource, /cmsBlockBuilderVisualNodeGrid/);
  assert.match(cssSource, /cmsBlockBuilderVisualNodeButton/);
  assert.match(cssSource, /cmsBlockBuilderVisualTree/);
  assert.match(cssSource, /cmsBlockBuilderVisualTreeRowActive/);
  assert.match(cssSource, /cmsBlockBuilderVisualTreeActions/);
  assert.match(cssSource, /cmsBlockBuilderVisualInspector/);
  assert.match(cssSource, /cmsBlockBuilderVisualFieldset/);
  assert.match(cssSource, /cmsBlockBuilderVisualMoveControls/);
  assert.match(cssSource, /cmsBlockBuilderVisualPortability/);
  assert.match(cssSource, /cmsBlockBuilderVisualImportActions/);
  assert.match(cssSource, /cmsBlockBuilderVisualStyleScopes/);
  assert.match(cssSource, /cmsBlockBuilderVisualStyleGrid/);
  assert.match(cssSource, /cmsBlockBuilderInspectorMeta/);
  assert.match(cssSource, /cmsBlockBuilderColorInputRow/);
  assert.match(cssSource, /cmsBlockBuilderMediaControlRow/);
  assert.match(cssSource, /cmsBlockBuilderMediaPreview/);
  assert.match(cssSource, /cmsBlockBuilderMediaControlActions/);
  assert.match(cssSource, /cmsBlockBuilderStyleJsonField/);
  assert.match(cssSource, /max-width: 760px/);
  assert.match(cssSource, /--cms-visual-mobile/);
  assert.match(cssSource, /--cms-visual-tablet/);
  assert.match(cssSource, /--cms-visual-desktop/);
  assert.match(cssSource, /cmsVisualModule/);
  assert.match(cssSource, /cmsVisualButton/);
  assert.match(cssSource, /cmsVisualHtmlEmbed/);
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
  const { getCmsAdminData } = loadCmsAdminModule(requestBff);

  const data = await getCmsAdminData(context, { pageId: "page-1" });

  assert.equal(data.pageSettings.data.settings.templateId, "template-1");
  assert.equal(data.resolvedPageSettings.data.layout.regions.main.areas[0].areaId, "page-main");
  assert.equal(data.templates.data.items[0].templateId, "template-1");
  assert.equal(data.visualModules.data.items[0].moduleId, "heroModule-prototype-images-001");
  assert.ok(calls.some((call) => call.includes("/pages/page-1/settings")));
  assert.ok(calls.some((call) => call.includes("/pages/page-1/resolved-settings")));
  assert.ok(calls.some((call) => call.includes("/templates") && call.includes("pageType=LANDING")));
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
  const rendererSource = readFileSync(path.resolve(root, "packages/cms-blocks/src/react.tsx"), "utf8");
  const cssSource = readFileSync(path.resolve(root, "app/globals.css"), "utf8");

  assert.match(pageSource, /Routing\/SEO/);
  assert.match(pageSource, /cmsBuilderHref/);
  assert.match(pageSource, /\/admin\/cms\/builder/);
  assert.match(pageSource, /href=\{cmsBuilderHref\(filters, page\.pageId\)\}/);
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
  assert.match(editorSource, /Biblioteca de bloques/);
  assert.match(editorSource, /visualModulePresetsStorageKey/);
  assert.match(editorSource, /savedVisualModulePresetsFromJson/);
  assert.match(editorSource, /savedVisualModulePresetsFromDefinitions/);
  assert.match(editorSource, /hydrateCmsVisualModuleReferences/);
  assert.match(editorSource, /hydrateCmsVisualModuleReferenceBlock/);
  assert.match(editorSource, /editorBlocksForCmsDraftPayload/);
  assert.match(editorSource, /blocksToJson\(editorBlocksForCmsDraftPayload\(orderedBlocks\)\)/);
  assert.match(editorSource, /CmsVisualModuleDefinitionsList/);
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
  assert.match(editorSource, /moduleSlots/);
  assert.match(editorSource, /Region \/ area \/ columna/);
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
  assert.match(editorSource, /CmsBlockRenderer/);
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

test("cms visual module definitions use shop-scoped BFF writes", async () => {
  const calls = [];
  const requestBff = async (pathValue, options = {}) => {
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
  } = loadCmsAdminModule(requestBff);
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
