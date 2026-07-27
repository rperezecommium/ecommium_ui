import Link from "next/link";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import type { BffResult } from "../../shared/bff/types";
import {
  createCmsTemplateAction,
  saveCmsGlobalSettingsAction,
  saveCmsTemplateSettingsAction,
} from "./cms-admin-actions";
import { CmsLayoutAreaEditorClient } from "./cms-layout-area-editor-client";
import {
  CMS_FALLBACK_FONT_OPTIONS,
  cmsTypographyFamily,
  resolveCmsLayoutSpacing,
} from "./cms-admin";
import type {
  CmsGlobalSettingsResponse,
  CmsFontOption,
  CmsFontOptionsResponse,
  CmsLayout,
  CmsPageType,
  CmsRegionCode,
  CmsTemplateSettings,
  CmsTemplateSettingsList,
  CmsTemplateStatus,
} from "./cms-admin";

type CmsSettingsTab = "global" | "templates";

type CmsBasicSettingsPageProps = {
  activeTab: CmsSettingsTab;
  context: AdminContext;
  drawer?: "create";
  locale: string;
  message?: string;
  fontOptionsResult: BffResult<CmsFontOptionsResponse>;
  result: BffResult<CmsGlobalSettingsResponse>;
  selectedTemplateId?: string;
  templateFilters: {
    pageType: CmsPageType | "all";
    status: CmsTemplateStatus | "all";
    limit: number;
    offset: number;
  };
  templatesResult: BffResult<CmsTemplateSettingsList>;
};

const editableRegions: Array<{ code: CmsRegionCode; label: string }> = [
  { code: "header", label: "Header" },
  { code: "main", label: "Main" },
  { code: "footer", label: "Footer" },
];

function settingsHref({
  drawer,
  locale,
  pageType,
  status,
  tab,
  templateId,
}: {
  drawer?: "create";
  locale: string;
  pageType?: CmsPageType | "all";
  status?: CmsTemplateStatus | "all";
  tab: CmsSettingsTab;
  templateId?: string;
}) {
  const params = new URLSearchParams({ tab, locale });
  if (pageType && pageType !== "all") params.set("pageType", pageType);
  if (status && status !== "all") params.set("status", status);
  if (templateId) params.set("templateId", templateId);
  if (drawer) params.set("drawer", drawer);
  return `/admin/cms/ajustes-basicos?${params.toString()}`;
}

function regionAreaCount(layout: CmsLayout, region: CmsRegionCode) {
  return layout.regions[region]?.areas.length ?? 0;
}

function colorValue(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value as string : fallback;
}

function entriesPreview(values: Record<string, string>, limit = 5) {
  const entries = Object.entries(values);
  if (!entries.length) return "Sin valores";
  return entries.slice(0, limit).map(([key, value]) => `${key}: ${value}`).join(" - ");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function fontOptionsFromResult(result: BffResult<CmsFontOptionsResponse>) {
  return result.ok && result.data.items.length ? result.data.items : CMS_FALLBACK_FONT_OPTIONS;
}

function fontSelectValue(fonts: CmsFontOption[], value: string, fallback: string) {
  if (fonts.some((font) => font.family === value)) return value;
  if (fonts.some((font) => font.family === fallback)) return fallback;
  return fonts[0]?.family ?? fallback;
}

function TypographySelect({
  fonts,
  label,
  name,
  value,
}: {
  fonts: CmsFontOption[];
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="adminField">
      <span>{label}</span>
      <select name={name} defaultValue={fontSelectValue(fonts, value, name.includes("Mono") ? "Roboto Mono" : "Inter")}>
        {fonts.map((font) => (
          <option key={`${name}-${font.family}`} value={font.family}>
            {font.family} · {font.category} · {font.weights.join("/")}
          </option>
        ))}
      </select>
    </label>
  );
}

function overrideMaxWidth(template: CmsTemplateSettings, fallback: string) {
  const overrides = template.settings.overrides;
  const tokens = asRecord(overrides.tokens);
  if (typeof overrides.maxWidth === "string" && overrides.maxWidth.trim()) return overrides.maxWidth;
  if (typeof tokens.maxWidth === "string" && tokens.maxWidth.trim()) return tokens.maxWidth;
  return fallback;
}

function overrideLayout(template: CmsTemplateSettings, fallback: CmsLayout) {
  const layout = template.settings.overrides.layout;
  return typeof layout === "object" && layout !== null && !Array.isArray(layout) ? layout as CmsLayout : fallback;
}

function overrideTypographyFamily(template: CmsTemplateSettings, slot: string, fallback: string) {
  const tokens = asRecord(template.settings.overrides.tokens);
  const typography = asRecord(tokens.typography);
  const value = typography[slot];
  if (typeof value === "string" && value.trim()) return value;
  const token = asRecord(value);
  return typeof token.family === "string" && token.family.trim() ? token.family : fallback;
}

function templateBadgeClass(status: CmsTemplateStatus) {
  if (status === "ACTIVE") return "adminBadge adminBadgeSuccess";
  if (status === "ARCHIVED") return "adminBadge adminBadgeWarning";
  return "adminBadge";
}

function pageTypeLabel(value: string) {
  if (value === "HOME") return "Home";
  if (value === "CONTENT") return "Contenido";
  return "Landing";
}

function SettingsTabs({
  activeTab,
  locale,
  templateFilters,
}: {
  activeTab: CmsSettingsTab;
  locale: string;
  templateFilters: CmsBasicSettingsPageProps["templateFilters"];
}) {
  const tabs: Array<{ id: CmsSettingsTab; label: string }> = [
    { id: "global", label: "Global" },
    { id: "templates", label: "Plantillas" },
  ];

  return (
    <nav className="productEditorTabs pricingTabs" aria-label="Ajustes CMS">
      {tabs.map((item) => (
        <Link
          className={`productEditorTab${activeTab === item.id ? " productEditorTabActive" : ""}`}
          href={settingsHref({
            locale,
            pageType: templateFilters.pageType,
            status: templateFilters.status,
            tab: item.id,
          })}
          key={item.id}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function GlobalSettingsPanel({
  context,
  fontOptionsResult,
  hasContext,
  locale,
  response,
}: {
  context: AdminContext;
  fontOptionsResult: BffResult<CmsFontOptionsResponse>;
  hasContext: boolean;
  locale: string;
  response: CmsGlobalSettingsResponse;
}) {
  const settings = response.settings;
  const tokens = settings.tokens;
  const layout = settings.layout;
  const colors = tokens.colors;
  const typography = tokens.typography;
  const spacing = tokens.spacing;
  const fonts = fontOptionsFromResult(fontOptionsResult);
  const regionsConfigured = editableRegions.filter((region) => regionAreaCount(layout, region.code) > 0).length;
  const totalAreas = editableRegions.reduce((total, region) => total + regionAreaCount(layout, region.code), 0);

  return (
    <>
      {response.configurationState === "INITIAL" ? (
        <div className="adminBanner adminBannerInfo">
          Esta tienda aun no tiene ajustes CMS guardados. Al guardar se persiste la base global.
        </div>
      ) : null}

      <section className="adminSummaryGrid" aria-label="Resumen de ajustes CMS globales">
        <div><span>Estado</span><strong>{response.configurationState}</strong></div>
        <div><span>Max width</span><strong>{tokens.maxWidth}</strong></div>
        <div><span>Regiones</span><strong>{regionsConfigured}/3</strong></div>
        <div><span>Areas</span><strong>{totalAreas}</strong></div>
      </section>

      <form action={saveCmsGlobalSettingsAction} className="adminForm cmsSettingsForm">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="tokensJson" value={JSON.stringify(tokens)} />
        <section className="pricingPanel cmsEditorPanel">
          <div className="pricingPanelHeader">
            <div>
              <h2>Tokens globales</h2>
              <p>Valores predeterminados para cualquier pagina que herede la configuracion global.</p>
            </div>
            <span className="adminBadge">global</span>
          </div>
          <div className="adminFormGrid adminFormGridTwo">
            <label className="adminField"><span>Ancho maximo</span><input name="maxWidth" defaultValue={tokens.maxWidth} placeholder="1280px" /></label>
            <label className="adminField"><span>Gap modulos</span><input name="defaultModuleGap" defaultValue={tokens.defaultModuleGap} placeholder="24px" /></label>
            <label className="adminField"><span>Gap columnas</span><input name="defaultColumnGap" defaultValue={tokens.defaultColumnGap} placeholder="24px" /></label>
            <TypographySelect fonts={fonts} label="Tipografia body" name="typographyBody" value={cmsTypographyFamily(typography.body, "Inter")} />
            <TypographySelect fonts={fonts} label="Tipografia headings" name="typographyHeading" value={cmsTypographyFamily(typography.heading, "Inter")} />
            <TypographySelect fonts={fonts} label="Tipografia mono" name="typographyMono" value={cmsTypographyFamily(typography.mono, "Roboto Mono")} />
          </div>
        </section>

        <section className="pricingPanel cmsEditorPanel">
          <div className="pricingPanelHeader"><div><h2>Colores</h2><p>{entriesPreview(colors)}</p></div></div>
          <div className="adminFormGrid">
            <label className="adminField cmsColorField"><span>Primario</span><input name="colorPrimary" type="color" defaultValue={colorValue(colors.primary, "#25b9d7")} /><input name="colorPrimaryText" defaultValue={colors.primary ?? "#25b9d7"} /></label>
            <label className="adminField cmsColorField"><span>Fondo</span><input name="colorBackground" type="color" defaultValue={colorValue(colors.background, "#ffffff")} /><input name="colorBackgroundText" defaultValue={colors.background ?? "#ffffff"} /></label>
            <label className="adminField cmsColorField"><span>Texto</span><input name="colorText" type="color" defaultValue={colorValue(colors.text, "#1f2937")} /><input name="colorTextText" defaultValue={colors.text ?? "#1f2937"} /></label>
            <label className="adminField cmsColorField"><span>Superficie</span><input name="colorSurface" type="color" defaultValue={colorValue(colors.surface, "#f8fafc")} /><input name="colorSurfaceText" defaultValue={colors.surface ?? "#f8fafc"} /></label>
          </div>
        </section>

        <section className="pricingPanel cmsEditorPanel">
          <div className="pricingPanelHeader"><div><h2>Espaciado y responsive</h2><p>Escala base para separacion entre secciones, columnas y modulos.</p></div></div>
          <div className="adminFormGrid">
            <label className="adminField"><span>XS</span><input name="spacingXs" defaultValue={spacing.xs ?? "4px"} /></label>
            <label className="adminField"><span>SM</span><input name="spacingSm" defaultValue={spacing.sm ?? "8px"} /></label>
            <label className="adminField"><span>MD</span><input name="spacingMd" defaultValue={spacing.md ?? "16px"} /></label>
            <label className="adminField"><span>LG</span><input name="spacingLg" defaultValue={spacing.lg ?? "24px"} /></label>
            <label className="adminField"><span>XL</span><input name="spacingXl" defaultValue={spacing.xl ?? "32px"} /></label>
            <label className="adminField"><span>Mobile</span><input name="breakpointMobile" defaultValue={tokens.breakpoints.mobile} /></label>
            <label className="adminField"><span>Tablet</span><input name="breakpointTablet" defaultValue={tokens.breakpoints.tablet} /></label>
            <label className="adminField"><span>Desktop</span><input name="breakpointDesktop" defaultValue={tokens.breakpoints.desktop} /></label>
          </div>
        </section>

        <section className="pricingPanel cmsEditorPanel">
          <div className="pricingPanelHeader"><div><h2>Layout base</h2><p>Areas reutilizables por region, preparadas para recibir modulos por columna.</p></div></div>
          <CmsLayoutAreaEditorClient initialLayout={layout} maxWidth={tokens.maxWidth} />
        </section>

        <div className="cmsEditorFooter">
          <div className="adminContextHint">{context.shopName || context.shopAlias || "Shop"} - {locale} - Herencia: global a plantilla a pagina a modulo</div>
          <button className="adminButton adminButtonPrimary" disabled={!hasContext} type="submit">Guardar ajustes globales</button>
        </div>
      </form>
    </>
  );
}

function TemplateFilters({
  locale,
  templateFilters,
}: {
  locale: string;
  templateFilters: CmsBasicSettingsPageProps["templateFilters"];
}) {
  return (
    <form className="pricingFilterBar cmsTemplatesFilterBar" action="/admin/cms/ajustes-basicos">
      <input type="hidden" name="tab" value="templates" />
      <label className="adminField"><span>Locale</span><input name="locale" defaultValue={locale} placeholder="es-ES" /></label>
      <label className="adminField">
        <span>Tipo</span>
        <select name="pageType" defaultValue={templateFilters.pageType}>
          <option value="all">Todos</option>
          <option value="LANDING">Landing</option>
          <option value="CONTENT">Contenido</option>
          <option value="HOME">Home</option>
        </select>
      </label>
      <label className="adminField">
        <span>Estado</span>
        <select name="status" defaultValue={templateFilters.status}>
          <option value="all">Todos</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Activa</option>
          <option value="ARCHIVED">Archivada</option>
        </select>
      </label>
      <button className="adminButton adminButtonPrimary" type="submit">Aplicar</button>
    </form>
  );
}

function CreateTemplateDrawer({
  drawer,
  locale,
  templateFilters,
}: {
  drawer?: "create";
  locale: string;
  templateFilters: CmsBasicSettingsPageProps["templateFilters"];
}) {
  if (drawer !== "create") return null;

  return (
    <div className="adminDrawerBackdrop">
      <aside className="adminSideDrawer" aria-label="Crear plantilla CMS">
        <div className="adminSideDrawerHeader">
          <div><h2>Crear plantilla</h2><p>Base reutilizable para paginas CMS.</p></div>
          <Link className="adminButton adminButtonTiny" href={settingsHref({ locale, pageType: templateFilters.pageType, status: templateFilters.status, tab: "templates" })}>Cerrar</Link>
        </div>
        <form action={createCmsTemplateAction} className="pricingDenseForm">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="pageTypeFilter" value={templateFilters.pageType} />
          <input type="hidden" name="statusFilter" value={templateFilters.status} />
          <label className="adminField"><span>Nombre</span><input name="name" placeholder="Landing editorial" /></label>
          <label className="adminField">
            <span>Tipo pagina</span>
            <select name="pageType" defaultValue={templateFilters.pageType === "all" ? "LANDING" : templateFilters.pageType}>
              <option value="LANDING">Landing</option>
              <option value="CONTENT">Contenido</option>
              <option value="HOME">Home</option>
            </select>
          </label>
          <label className="adminField">
            <span>Estado</span>
            <select name="status" defaultValue="DRAFT">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Activa</option>
            </select>
          </label>
          <button className="adminButton adminButtonPrimary" type="submit">Crear plantilla</button>
        </form>
      </aside>
    </div>
  );
}

function TemplatesList({
  locale,
  selectedTemplateId,
  templateFilters,
  templates,
}: {
  locale: string;
  selectedTemplateId?: string;
  templateFilters: CmsBasicSettingsPageProps["templateFilters"];
  templates: CmsTemplateSettings[];
}) {
  if (!templates.length) {
    return <div className="adminEmptyState">No hay plantillas CMS para los filtros actuales.</div>;
  }

  return (
    <div className="adminTableScroller">
      <table className="adminTable cmsTemplatesTable">
        <thead><tr><th>Plantilla</th><th>Tipo</th><th>Estado</th><th>Overrides</th><th>Acciones</th></tr></thead>
        <tbody>
          {templates.map((template) => {
            const overrideKeys = Object.keys(template.settings.overrides);
            return (
              <tr key={template.templateId}>
                <td><strong>{template.name}</strong><div className="adminContextHint">{template.templateId}</div></td>
                <td>{pageTypeLabel(template.pageType)}</td>
                <td><span className={templateBadgeClass(template.status)}>{template.status}</span></td>
                <td>{overrideKeys.length ? overrideKeys.join(", ") : "Hereda global"}</td>
                <td>
                  <Link
                    className={`adminButton adminButtonTiny${selectedTemplateId === template.templateId ? " adminButtonPrimary" : ""}`}
                    href={settingsHref({
                      locale,
                      pageType: templateFilters.pageType,
                      status: templateFilters.status,
                      tab: "templates",
                      templateId: template.templateId,
                    })}
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TemplateEditor({
  fonts,
  globalLayout,
  globalResponse,
  locale,
  selectedTemplate,
  templateFilters,
}: {
  fonts: CmsFontOption[];
  globalLayout: CmsLayout;
  globalResponse: CmsGlobalSettingsResponse;
  locale: string;
  selectedTemplate?: CmsTemplateSettings;
  templateFilters: CmsBasicSettingsPageProps["templateFilters"];
}) {
  if (!selectedTemplate) {
    return (
      <section className="pricingPanel cmsTemplateEditorPanel">
        <div className="adminEmptyState">Selecciona una plantilla para editar sus overrides.</div>
      </section>
    );
  }

  const globalTokens = globalResponse.settings.tokens;
  const globalMaxWidth = globalTokens.maxWidth;
  const templateMaxWidth = overrideMaxWidth(selectedTemplate, globalMaxWidth);
  const templateLayout = resolveCmsLayoutSpacing(overrideLayout(selectedTemplate, globalLayout), globalTokens.spacing);
  const bodyFamily = overrideTypographyFamily(selectedTemplate, "body", cmsTypographyFamily(globalTokens.typography.body, "Inter"));
  const headingFamily = overrideTypographyFamily(selectedTemplate, "heading", cmsTypographyFamily(globalTokens.typography.heading, "Inter"));
  const monoFamily = overrideTypographyFamily(selectedTemplate, "mono", cmsTypographyFamily(globalTokens.typography.mono, "Roboto Mono"));

  return (
    <form action={saveCmsTemplateSettingsAction} className="adminForm cmsSettingsForm cmsTemplateEditorPanel">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="templateId" value={selectedTemplate.templateId} />
      <input type="hidden" name="pageTypeFilter" value={templateFilters.pageType} />
      <input type="hidden" name="statusFilter" value={templateFilters.status} />
      <section className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader">
          <div><h2>{selectedTemplate.name}</h2><p>Overrides de plantilla aplicados entre global y pagina.</p></div>
          <span className={templateBadgeClass(selectedTemplate.status)}>{selectedTemplate.status}</span>
        </div>
        <div className="adminFormGrid adminFormGridTwo">
          <label className="adminField"><span>Nombre</span><input name="name" defaultValue={selectedTemplate.name} /></label>
          <label className="adminField"><span>Tipo pagina</span><output>{pageTypeLabel(selectedTemplate.pageType)}</output></label>
          <label className="adminField">
            <span>Estado</span>
            <select name="status" defaultValue={selectedTemplate.status}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Activa</option>
              <option value="ARCHIVED">Archivada</option>
            </select>
          </label>
          <label className="adminField">
            <span>Herencia global</span>
            <select name="inheritGlobalSettings" defaultValue={String(selectedTemplate.settings.inheritGlobalSettings)}>
              <option value="true">Heredar global</option>
              <option value="false">No heredar</option>
            </select>
          </label>
          <label className="adminField">
            <span>Override max width</span>
            <input name="templateMaxWidth" defaultValue={templateMaxWidth} placeholder={globalMaxWidth} />
            <small>Se guarda como override de plantilla.</small>
          </label>
          <TypographySelect fonts={fonts} label="Tipografia body" name="templateTypographyBody" value={bodyFamily} />
          <TypographySelect fonts={fonts} label="Tipografia headings" name="templateTypographyHeading" value={headingFamily} />
          <TypographySelect fonts={fonts} label="Tipografia mono" name="templateTypographyMono" value={monoFamily} />
        </div>
      </section>

      <section className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader"><div><h2>Layout de plantilla</h2><p>Areas que reemplazan o amplian la base global para este tipo de pagina.</p></div></div>
        <CmsLayoutAreaEditorClient initialLayout={templateLayout} maxWidth={templateMaxWidth} />
      </section>

      <div className="cmsEditorFooter">
        <div className="adminContextHint">Template {selectedTemplate.templateId} - {locale}</div>
        <button className="adminButton adminButtonPrimary" type="submit">Guardar plantilla</button>
      </div>
    </form>
  );
}

function TemplatesPanel({
  drawer,
  fontOptionsResult,
  globalResponse,
  locale,
  selectedTemplateId,
  templateFilters,
  templatesResult,
}: {
  drawer?: "create";
  fontOptionsResult: BffResult<CmsFontOptionsResponse>;
  globalResponse: CmsGlobalSettingsResponse;
  locale: string;
  selectedTemplateId?: string;
  templateFilters: CmsBasicSettingsPageProps["templateFilters"];
  templatesResult: BffResult<CmsTemplateSettingsList>;
}) {
  const templates = templatesResult.ok ? templatesResult.data.items : [];
  const selectedTemplate = templates.find((template) => template.templateId === selectedTemplateId) ?? templates[0];
  const fonts = fontOptionsFromResult(fontOptionsResult);

  return (
    <section className="cmsTemplatesPanel">
      {!templatesResult.ok ? (
        <div className="adminBanner adminBannerError">
          <p>{templatesResult.error}</p>
          {templatesResult.status ? <p>Estado BFF: {templatesResult.status}</p> : null}
        </div>
      ) : null}

      <div className="pricingPanel cmsEditorPanel">
        <div className="pricingPanelHeader">
          <div><h2>Plantillas</h2><p>Layouts reutilizables por tipo de pagina, resueltos entre global y pagina.</p></div>
          <Link className="adminButton adminButtonPrimary" href={settingsHref({ drawer: "create", locale, pageType: templateFilters.pageType, status: templateFilters.status, tab: "templates" })}>Crear plantilla</Link>
        </div>
        <TemplateFilters locale={locale} templateFilters={templateFilters} />
        <TemplatesList locale={locale} selectedTemplateId={selectedTemplate?.templateId} templateFilters={templateFilters} templates={templates} />
      </div>

      <TemplateEditor
        fonts={fonts}
        globalLayout={globalResponse.settings.layout}
        globalResponse={globalResponse}
        locale={locale}
        selectedTemplate={selectedTemplate}
        templateFilters={templateFilters}
      />
      <CreateTemplateDrawer drawer={drawer} locale={locale} templateFilters={templateFilters} />
    </section>
  );
}

export function CmsBasicSettingsPageView({
  activeTab,
  context,
  drawer,
  fontOptionsResult,
  locale,
  message,
  result,
  selectedTemplateId,
  templateFilters,
  templatesResult,
}: CmsBasicSettingsPageProps) {
  const hasContext = hasRequiredAdminContext(context);
  const response = result.ok ? result.data : undefined;

  return (
    <main className="adminPage cmsAdminPage cmsSettingsPage">
      <header className="adminPageHeader">
        <div>
          <div className="adminBreadcrumb">Admin / CMS / Ajustes basicos</div>
          <h1 className="adminPageTitle">Ajustes basicos</h1>
          <p className="adminPageIntro">Configuracion global heredada por plantillas, paginas y modulos.</p>
        </div>
        <div className="adminButtonRow"><Link className="adminButton" href="/admin/cms">Volver a paginas</Link></div>
      </header>

      {!hasContext ? <div className="adminBanner adminBannerWarning"><p>Selecciona Organization y Shop para editar la configuracion CMS.</p></div> : null}
      {message ? <div className="adminBanner">{message}</div> : null}
      <SettingsTabs activeTab={activeTab} locale={locale} templateFilters={templateFilters} />

      {!result.ok ? (
        <section className="adminBanner adminBannerError">
          <strong>No se pudo consultar la configuracion global CMS.</strong>
          <p>{result.error}</p>
          {result.status ? <p>Estado BFF: {result.status}</p> : null}
          <p className="adminContextHint">Locale solicitado: {locale}</p>
        </section>
      ) : null}

      {response && activeTab === "global" ? (
        <GlobalSettingsPanel context={context} fontOptionsResult={fontOptionsResult} hasContext={hasContext} locale={locale} response={response} />
      ) : null}
      {response && activeTab === "templates" ? (
        <TemplatesPanel
          drawer={drawer}
          fontOptionsResult={fontOptionsResult}
          globalResponse={response}
          locale={locale}
          selectedTemplateId={selectedTemplateId}
          templateFilters={templateFilters}
          templatesResult={templatesResult}
        />
      ) : null}
    </main>
  );
}
