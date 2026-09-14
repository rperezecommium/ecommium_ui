export type PublishedConsentIntegrationBinding = {
  providerKey: string;
  contractVersion: number;
  enabled: boolean;
  publicConfig: Record<string, string>;
};

const googleAnalyticsMeasurementId = /^G-[A-Z0-9]{6,32}$/;
const googleAnalyticsProviderKey = "google-analytics";
const googleAnalyticsContractVersion = 1;
const googleAnalyticsOrigin = "https://www.googletagmanager.com";
const googleAnalyticsPath = "/gtag/js";
const metaPixelId = /^[0-9]{15}$/;
const metaPixelProviderKey = "meta-pixel";
const metaPixelContractVersion = 1;
const metaPixelOrigin = "https://connect.facebook.net";
const metaPixelPath = "/en_US/fbevents.js";
const matomoCloudHost = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.matomo\.cloud$/;
const matomoCloudSiteId = /^[1-9][0-9]{0,8}$/;
const clarityProjectId = /^[a-z0-9]{6,32}$/;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

/**
 * Solo admite la versión publicada que tiene adapter revisado en código. La
 * lista es deliberadamente cerrada: un proveedor nuevo debe añadir política,
 * adapter, CSP y pruebas en el mismo cambio.
 */
export function parsePublishedConsentIntegration(value: unknown): PublishedConsentIntegrationBinding | undefined {
  const integration = record(value);
  const measurementId = text(record(integration.publicConfig).measurementId);
  if (
    integration.providerKey === googleAnalyticsProviderKey
    && integration.contractVersion === googleAnalyticsContractVersion
    && typeof integration.enabled === "boolean"
    && googleAnalyticsMeasurementId.test(measurementId)
    && Object.keys(record(integration.publicConfig)).length === 1
  ) return { providerKey: googleAnalyticsProviderKey, contractVersion: googleAnalyticsContractVersion, enabled: integration.enabled, publicConfig: { measurementId } };
  const pixelId = text(record(integration.publicConfig).pixelId);
  if (
    integration.providerKey === metaPixelProviderKey
    && integration.contractVersion === metaPixelContractVersion
    && typeof integration.enabled === "boolean"
    && metaPixelId.test(pixelId)
    && Object.keys(record(integration.publicConfig)).length === 1
  ) return { providerKey: metaPixelProviderKey, contractVersion: metaPixelContractVersion, enabled: integration.enabled, publicConfig: { pixelId } };
  const cloudHost = text(record(integration.publicConfig).cloudHost).toLowerCase();
  const siteId = text(record(integration.publicConfig).siteId);
  if (
    integration.providerKey === "matomo-cloud"
    && integration.contractVersion === 1
    && typeof integration.enabled === "boolean"
    && matomoCloudHost.test(cloudHost)
    && matomoCloudSiteId.test(siteId)
    && Object.keys(record(integration.publicConfig)).length === 2
  ) return { providerKey: "matomo-cloud", contractVersion: 1, enabled: integration.enabled, publicConfig: { cloudHost, siteId } };
  const projectId = text(record(integration.publicConfig).projectId).toLowerCase();
  if (
    integration.providerKey === "microsoft-clarity"
    && integration.contractVersion === 1
    && typeof integration.enabled === "boolean"
    && clarityProjectId.test(projectId)
    && Object.keys(record(integration.publicConfig)).length === 1
  ) return { providerKey: "microsoft-clarity", contractVersion: 1, enabled: integration.enabled, publicConfig: { projectId } };
  return undefined;
}

/**
 * Un StorefrontConsentScriptGate no acepta URLs genéricas ni URLs llegadas de
 * Admin. Solo admite los loaders exactos de los cuatro adapters revisados y
 * sus identificadores ya validados.
 */
export function safeConsentScriptSource(value: string, currentOrigin: string): string | null {
  try {
    const source = new URL(value, currentOrigin);
    const measurementId = source.searchParams.get("id") ?? "";
    if (source.protocol === "https:" && source.origin === googleAnalyticsOrigin && source.pathname === googleAnalyticsPath && googleAnalyticsMeasurementId.test(measurementId) && [...source.searchParams.keys()].length === 1) return source.href;
    if (source.protocol === "https:" && source.origin === metaPixelOrigin && source.pathname === metaPixelPath && !source.search && !source.hash) return source.href;
    if (source.protocol === "https:" && matomoCloudHost.test(source.hostname) && source.pathname === "/matomo.js" && !source.search && !source.hash) return source.href;
    if (source.protocol === "https:" && source.origin === "https://www.clarity.ms" && /^\/tag\/[a-z0-9]{6,32}$/.test(source.pathname) && !source.search && !source.hash) return source.href;
    return null;
  } catch {
    return null;
  }
}
