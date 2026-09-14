"use client";

import { useEffect } from "react";
import type { StorefrontConsentPolicy } from "./storefront-consent";
import { StorefrontConsentScriptGate, type StorefrontConsentIntegration } from "./storefront-consent-gates";
import { useStorefrontConsentRuntime } from "./storefront-consent-runtime";

const providerKey = "matomo-cloud";
const contractVersion = 1;
const cloudHostFormat = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.matomo\.cloud$/;
const siteIdFormat = /^[1-9][0-9]{0,8}$/;

type MatomoConfiguration = { cloudHost: string; siteId: string };

function configuration(policy: StorefrontConsentPolicy | null, serviceKey: string): MatomoConfiguration | null {
  const integration = policy?.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const cloudHost = integration?.publicConfig.cloudHost?.trim().toLowerCase() ?? "";
  const siteId = integration?.publicConfig.siteId?.trim() ?? "";
  if (integration?.providerKey !== providerKey || integration.contractVersion !== contractVersion || integration.enabled !== true || !cloudHostFormat.test(cloudHost) || !siteIdFormat.test(siteId)) return null;
  return { cloudHost, siteId };
}

function serviceKeyFor(policy: StorefrontConsentPolicy): string | null {
  return policy.services.find((service) => configuration(policy, service.serviceKey))?.serviceKey ?? null;
}

function StorefrontMatomoCloudCommands({ cloudHost, siteId }: MatomoConfiguration) {
  useEffect(() => {
    const queue = ((window as Window & { _paq?: unknown[][] })._paq ??= []);
    const origin = `https://${cloudHost}`;
    // Alcance aprobado: visita y enlace estándar; sin User-ID, ecommerce ni eventos propios.
    // Matomo exige una señal explícita incluso si el loader se monta después
    // del banner: así una retirada posterior corta el tracker ya cargado.
    queue.push(["requireConsent"]);
    queue.push(["setTrackerUrl", `${origin}/matomo.php`]);
    queue.push(["setSiteId", siteId]);
    queue.push(["setConsentGiven"]);
    queue.push(["trackPageView"]);
    queue.push(["enableLinkTracking"]);
    return () => {
      queue.push(["forgetConsentGiven"]);
      queue.push(["deleteCookies"]);
    };
  }, [cloudHost, siteId]);
  return null;
}

export function StorefrontMatomoCloudAdapter({ serviceKey }: { serviceKey: string }) {
  const { policy } = useStorefrontConsentRuntime();
  const value = configuration(policy, serviceKey);
  if (!value) return null;
  return <StorefrontConsentScriptGate serviceKey={serviceKey} src={`https://${value.cloudHost}/matomo.js`}>
    <StorefrontMatomoCloudCommands {...value} />
  </StorefrontConsentScriptGate>;
}

export const storefrontMatomoCloudIntegration: StorefrontConsentIntegration = {
  integrationKey: providerKey,
  resolveServiceKey: serviceKeyFor,
  Component: StorefrontMatomoCloudAdapter,
};
