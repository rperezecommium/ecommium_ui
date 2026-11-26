import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import type { BffResult } from "../../shared/bff/types";
import { saveCmsGlobalSettingsAction } from "./cms-admin-actions";
import { CMS_FALLBACK_FONT_OPTIONS, cmsTypographyFamily } from "./cms-admin";
import type { CmsGlobalSettingsResponse, CmsFontOption, CmsFontOptionsResponse } from "./cms-admin";

type CmsBasicSettingsPageProps = {
  context: AdminContext;
  canWrite: boolean;
  locale: string;
  message?: string;
  fontOptionsResult: BffResult<CmsFontOptionsResponse>;
  result: BffResult<CmsGlobalSettingsResponse>;
};

function colorValue(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value as string : fallback;
}

function entriesPreview(values: Record<string, string>, limit = 5) {
  const entries = Object.entries(values);
  if (!entries.length) return "Sin valores";
  return entries.slice(0, limit).map(([key, value]) => `${key}: ${value}`).join(" - ");
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

function GlobalSettingsPanel({
  context,
  canWrite,
  fontOptionsResult,
  hasContext,
  locale,
  response,
}: {
  context: AdminContext;
  canWrite: boolean;
  fontOptionsResult: BffResult<CmsFontOptionsResponse>;
  hasContext: boolean;
  locale: string;
  response: CmsGlobalSettingsResponse;
}) {
  const settings = response.settings;
  const tokens = settings.tokens;
  const colors = tokens.colors;
  const typography = tokens.typography;
  const spacing = tokens.spacing;
  const fonts = fontOptionsFromResult(fontOptionsResult);

  return (
    <>
      {response.configurationState === "INITIAL" ? (
        <div className="adminBanner adminBannerInfo">
          Esta tienda aun no tiene ajustes CMS guardados. Al guardar se persiste la base global.
        </div>
      ) : null}

      <form action={saveCmsGlobalSettingsAction} className="adminForm cmsSettingsForm">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="tokensJson" value={JSON.stringify(tokens)} />
        <fieldset className="cmsSettingsGroups" disabled={!hasContext || !canWrite} style={{border:0,margin:0,padding:0,minWidth:0}}>
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

        <div className="cmsEditorFooter">
          <div className="adminContextHint">{context.shopName || context.shopAlias || "Shop"} - {locale}</div>
          <button className="adminButton adminButtonPrimary" disabled={!hasContext || !canWrite} type="submit">Guardar ajustes globales</button>
        </div>
        </fieldset>
      </form>
    </>
  );
}

export function CmsBasicSettingsPageView({context,canWrite,fontOptionsResult,locale,message,result}:CmsBasicSettingsPageProps) {
  const hasContext=hasRequiredAdminContext(context);
  return <main className="adminPage cmsAdminPage cmsSettingsPage">
    <header className="adminPageHeader">
      <div><div className="adminBreadcrumb">Admin / CMS / Ajustes básicos</div><h1 className="adminPageTitle">Ajustes básicos</h1><p className="adminPageIntro">Valores predeterminados de diseño para el contenido CMS.</p></div>
    </header>
    {!hasContext?<div className="adminBanner adminBannerWarning"><p>Selecciona Organization y Shop para editar la configuracion CMS.</p></div>:null}
    {!canWrite?<p role="status">Acceso de solo lectura.</p>:null}
    {message?<div className="adminBanner">{message}</div>:null}
    {!result.ok?<section className="adminBanner adminBannerError"><strong>No se pudo consultar la configuracion global CMS.</strong><p>{result.error}</p>{result.status?<p>Estado BFF: {result.status}</p>:null}<p className="adminContextHint">Locale solicitado: {locale}</p></section>:<GlobalSettingsPanel context={context} canWrite={canWrite} fontOptionsResult={fontOptionsResult} hasContext={hasContext} locale={locale} response={result.data}/>}
  </main>;
}
