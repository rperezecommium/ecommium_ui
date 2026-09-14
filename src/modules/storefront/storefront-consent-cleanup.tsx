"use client";

import { useEffect } from "react";
import { consentAllowedServiceKeys, type StorefrontConsentPolicy } from "./storefront-consent";
import { useStorefrontConsentRuntime } from "./storefront-consent-runtime";

const googleAnalyticsProviderKey = "google-analytics";
const googleAnalyticsContractVersion = 1;
const googleAnalyticsMeasurementIdFormat = /^G-[A-Z0-9]{6,32}$/;
const metaPixelProviderKey = "meta-pixel";
const metaPixelContractVersion = 1;
const metaPixelIdFormat = /^[0-9]{15}$/;
const matomoCloudHostFormat = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.matomo\.cloud$/;
const matomoSiteIdFormat = /^[1-9][0-9]{0,8}$/;
const clarityProjectIdFormat = /^[a-z0-9]{6,32}$/;

type GoogleAnalyticsWindow = Window & typeof globalThis & {
  [key: `ga-disable-${string}`]: boolean | undefined;
};
type MetaPixelWindow = Window & typeof globalThis & { fbq?: (...args: unknown[]) => void };
type MatomoWindow = Window & typeof globalThis & { _paq?: unknown[][] };

export function googleAnalyticsCookieNames(measurementId: string): string[] {
  if (!googleAnalyticsMeasurementIdFormat.test(measurementId)) return [];
  return ["_ga", `_ga_${measurementId.slice(2).replaceAll("-", "_")}`];
}

function cookieDomains(hostname: string): string[] {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (!labels.length) return [];
  const domains = new Set([labels.join(".")]);
  for (let index = 1; index < labels.length - 1; index += 1) domains.add(labels.slice(index).join("."));
  return [...domains];
}

/**
 * Elimina únicamente cookies que Google Analytics crea con el Measurement ID
 * aprobado. No recorre storage, no recibe nombres de Admin y no intenta borrar
 * datos fuera del host actual y sus dominios padre explícitos.
 */
export function clearGoogleAnalyticsBrowserData(measurementId: string, documentValue: Document, hostname: string, windowValue: Window) {
  const cookieNames = googleAnalyticsCookieNames(measurementId);
  if (!cookieNames.length) return;
  (windowValue as GoogleAnalyticsWindow)[`ga-disable-${measurementId}`] = true;
  const expires = "Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax";
  for (const name of cookieNames) {
    documentValue.cookie = `${name}=; ${expires}`;
    for (const domain of cookieDomains(hostname)) {
      documentValue.cookie = `${name}=; ${expires}; Domain=${domain}`;
    }
  }
}

/** El navegador solo puede retirar las cookies propias de Meta Pixel. */
export function clearMetaPixelBrowserData(pixelId: string, documentValue: Document, hostname: string) {
  if (!metaPixelIdFormat.test(pixelId)) return;
  const expires = "Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax";
  for (const name of ["_fbp", "_fbc"]) {
    documentValue.cookie = `${name}=; ${expires}`;
    for (const domain of cookieDomains(hostname)) {
      documentValue.cookie = `${name}=; ${expires}; Domain=${domain}`;
    }
  }
}

/** Comunica la retirada a un Pixel ya cargado antes de retirar su script. */
export function revokeMetaPixelTracking(windowValue: Window) {
  (windowValue as MetaPixelWindow).fbq?.("consent", "revoke");
}

/** Matomo nombra sus cookies con el ID de sitio; solo retiramos ese prefijo. */
export function clearMatomoCloudBrowserData(siteId: string, documentValue: Document, hostname: string) {
  if (!matomoSiteIdFormat.test(siteId)) return;
  const prefixes = [`_pk_id.${siteId}.`, `_pk_ses.${siteId}.`];
  const cookieNames = documentValue.cookie.split(";").map((entry) => entry.trim().split("=", 1)[0]).filter((name) => prefixes.some((prefix) => name.startsWith(prefix)));
  const expires = "Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax";
  for (const name of cookieNames) {
    documentValue.cookie = `${name}=; ${expires}`;
    for (const domain of cookieDomains(hostname)) documentValue.cookie = `${name}=; ${expires}; Domain=${domain}`;
  }
}

/** Detiene el tracker Matomo residente antes de borrar sus datos propios. */
export function revokeMatomoCloudTracking(windowValue: Window) {
  const queue = (windowValue as MatomoWindow)._paq;
  queue?.push(["forgetConsentGiven"]);
  queue?.push(["deleteCookies"]);
}

/** Clarity solo permite retirar las dos cookies propias que crea en el host. */
export function clearMicrosoftClarityBrowserData(projectId: string, documentValue: Document, hostname: string) {
  if (!clarityProjectIdFormat.test(projectId)) return;
  const expires = "Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax";
  for (const name of ["_clck", "_clsk"]) {
    documentValue.cookie = `${name}=; ${expires}`;
    for (const domain of cookieDomains(hostname)) documentValue.cookie = `${name}=; ${expires}; Domain=${domain}`;
  }
}

function googleAnalyticsMeasurementId(policy: StorefrontConsentPolicy, serviceKey: string): string | null {
  const integration = policy.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const measurementId = integration?.publicConfig.measurementId?.trim() ?? "";
  if (integration?.providerKey !== googleAnalyticsProviderKey || integration.contractVersion !== googleAnalyticsContractVersion || !googleAnalyticsMeasurementIdFormat.test(measurementId)) return null;
  return measurementId;
}

function metaPixelId(policy: StorefrontConsentPolicy, serviceKey: string): string | null {
  const integration = policy.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const pixelId = integration?.publicConfig.pixelId?.trim() ?? "";
  if (integration?.providerKey !== metaPixelProviderKey || integration.contractVersion !== metaPixelContractVersion || !metaPixelIdFormat.test(pixelId)) return null;
  return pixelId;
}

function matomoCloudSiteId(policy: StorefrontConsentPolicy, serviceKey: string): string | null {
  const integration = policy.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const host = integration?.publicConfig.cloudHost?.trim().toLowerCase() ?? "";
  const siteId = integration?.publicConfig.siteId?.trim() ?? "";
  if (integration?.providerKey !== "matomo-cloud" || integration.contractVersion !== 1 || !matomoCloudHostFormat.test(host) || !matomoSiteIdFormat.test(siteId)) return null;
  return siteId;
}

function clarityProjectId(policy: StorefrontConsentPolicy, serviceKey: string): string | null {
  const integration = policy.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const projectId = integration?.publicConfig.projectId?.trim().toLowerCase() ?? "";
  if (integration?.providerKey !== "microsoft-clarity" || integration.contractVersion !== 1 || !clarityProjectIdFormat.test(projectId)) return null;
  return projectId;
}

/**
 * Reacciona a una retirada (o a un estado inicial sin autorización) mediante
 * una lista cerrada de limpiadores. El gate sigue siendo quien impide cualquier
 * nueva carga de scripts; este componente elimina únicamente datos de browser.
 */
export function StorefrontConsentDataCleanupRegistry() {
  const { decision, policy, status } = useStorefrontConsentRuntime();

  useEffect(() => {
    if (status !== "available" || !policy) return;
    const allowed = consentAllowedServiceKeys(policy, decision);
    for (const service of policy.services) {
      const measurementId = googleAnalyticsMeasurementId(policy, service.serviceKey);
      if (measurementId && !allowed.has(service.serviceKey)) {
        clearGoogleAnalyticsBrowserData(measurementId, document, window.location.hostname, window);
      }
      const pixelId = metaPixelId(policy, service.serviceKey);
      if (pixelId && !allowed.has(service.serviceKey)) {
        revokeMetaPixelTracking(window);
        clearMetaPixelBrowserData(pixelId, document, window.location.hostname);
      }
      const matomoSiteId = matomoCloudSiteId(policy, service.serviceKey);
      if (matomoSiteId && !allowed.has(service.serviceKey)) {
        revokeMatomoCloudTracking(window);
        clearMatomoCloudBrowserData(matomoSiteId, document, window.location.hostname);
      }
      const projectId = clarityProjectId(policy, service.serviceKey);
      if (projectId && !allowed.has(service.serviceKey)) {
        clearMicrosoftClarityBrowserData(projectId, document, window.location.hostname);
      }
    }
  }, [decision, policy, status]);

  return null;
}
