"use client";

import { useEffect } from "react";
import type { StorefrontConsentPolicy } from "./storefront-consent";
import {
  StorefrontConsentScriptGate,
  type StorefrontConsentIntegration,
} from "./storefront-consent-gates";
import { storefrontMetaPixelIntegration } from "./storefront-meta-pixel-adapter";
import { storefrontMatomoCloudIntegration } from "./storefront-matomo-cloud-adapter";
import { storefrontMicrosoftClarityIntegration } from "./storefront-microsoft-clarity-adapter";
import { useStorefrontConsentRuntime } from "./storefront-consent-runtime";

const googleAnalyticsProviderKey = "google-analytics";
const googleAnalyticsContractVersion = 1;
const googleAnalyticsMeasurementId = /^G-[A-Z0-9]{6,32}$/;
const googleAnalyticsScriptOrigin = "https://www.googletagmanager.com";
const configuredMeasurementIds = new Set<string>();

type GoogleAnalyticsWindow = Window & typeof globalThis & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

function googleAnalyticsConfiguration(policy: StorefrontConsentPolicy | null, serviceKey: string): string | null {
  const integration = policy?.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const measurementId = integration?.publicConfig.measurementId?.trim() ?? "";
  if (integration?.providerKey !== googleAnalyticsProviderKey || integration.contractVersion !== googleAnalyticsContractVersion || integration.enabled !== true || !googleAnalyticsMeasurementId.test(measurementId)) return null;
  return measurementId;
}

function googleAnalyticsServiceKey(policy: StorefrontConsentPolicy): string | null {
  return policy.services.find((service) => googleAnalyticsConfiguration(policy, service.serviceKey))?.serviceKey ?? null;
}

function configureGoogleAnalytics(measurementId: string) {
  const analyticsWindow = window as GoogleAnalyticsWindow;
  analyticsWindow[`ga-disable-${measurementId}`] = false;
  analyticsWindow.dataLayer ??= [];
  analyticsWindow.gtag ??= (...args: unknown[]) => { analyticsWindow.dataLayer?.push(args); };
  if (configuredMeasurementIds.has(measurementId)) return;
  analyticsWindow.gtag("js", new Date());
  // Alcance aprobado: page_view estándar; sin User-ID, ecommerce ni eventos
  // personalizados. No se usa Google Consent Mode ni se emiten pings previos.
  analyticsWindow.gtag("config", measurementId);
  configuredMeasurementIds.add(measurementId);
}

function StorefrontGoogleAnalyticsCommands({ measurementId }: { measurementId: string }) {
  useEffect(() => {
    configureGoogleAnalytics(measurementId);
    return () => {
      // El gate retira el script al revocar Consent; esto además impide nuevos
      // hits si Google conserva su objeto global en memoria.
      (window as GoogleAnalyticsWindow)[`ga-disable-${measurementId}`] = true;
    };
  }, [measurementId]);
  return null;
}

export function StorefrontGoogleAnalyticsAdapter({ serviceKey }: { serviceKey: string }) {
  const { policy } = useStorefrontConsentRuntime();
  const measurementId = googleAnalyticsConfiguration(policy, serviceKey);
  if (!measurementId) return null;
  const scriptUrl = `${googleAnalyticsScriptOrigin}/gtag/js?id=${encodeURIComponent(measurementId)}`;
  return <StorefrontConsentScriptGate serviceKey={serviceKey} src={scriptUrl}>
    <StorefrontGoogleAnalyticsCommands measurementId={measurementId} />
  </StorefrontConsentScriptGate>;
}

export const storefrontConsentIntegrations: readonly StorefrontConsentIntegration[] = [
  {
    integrationKey: googleAnalyticsProviderKey,
    resolveServiceKey: googleAnalyticsServiceKey,
    Component: StorefrontGoogleAnalyticsAdapter,
  },
  storefrontMetaPixelIntegration,
  storefrontMatomoCloudIntegration,
  storefrontMicrosoftClarityIntegration,
];
