"use client";

import { useEffect } from "react";
import type { StorefrontConsentPolicy } from "./storefront-consent";
import { StorefrontConsentScriptGate, type StorefrontConsentIntegration } from "./storefront-consent-gates";
import { useStorefrontConsentRuntime } from "./storefront-consent-runtime";

const providerKey = "microsoft-clarity";
const contractVersion = 1;
const projectIdFormat = /^[a-z0-9]{6,32}$/;

type ClarityWindow = Window & typeof globalThis & { clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] } };

function projectIdFor(policy: StorefrontConsentPolicy | null, serviceKey: string): string | null {
  const integration = policy?.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const projectId = integration?.publicConfig.projectId?.trim().toLowerCase() ?? "";
  if (integration?.providerKey !== providerKey || integration.contractVersion !== contractVersion || integration.enabled !== true || !projectIdFormat.test(projectId)) return null;
  return projectId;
}

function serviceKeyFor(policy: StorefrontConsentPolicy): string | null {
  return policy.services.find((service) => projectIdFor(policy, service.serviceKey))?.serviceKey ?? null;
}

function StorefrontMicrosoftClarityQueue() {
  useEffect(() => {
    const clarityWindow = window as ClarityWindow;
    clarityWindow.clarity ??= (...args: unknown[]) => {
      const queue = clarityWindow.clarity!;
      queue.q ??= [];
      queue.q.push(args);
    };
    // Consent V2 es la señal actual de Clarity para EEE/UK/CH. No se habilita
    // publicidad: esta integración está catalogada exclusivamente como analítica.
    clarityWindow.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    return () => {
      clarityWindow.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "denied" });
    };
  }, []);
  return null;
}

export function StorefrontMicrosoftClarityAdapter({ serviceKey }: { serviceKey: string }) {
  const { policy } = useStorefrontConsentRuntime();
  const projectId = projectIdFor(policy, serviceKey);
  if (!projectId) return null;
  return <StorefrontConsentScriptGate serviceKey={serviceKey} src={`https://www.clarity.ms/tag/${projectId}`}>
    <StorefrontMicrosoftClarityQueue />
  </StorefrontConsentScriptGate>;
}

export const storefrontMicrosoftClarityIntegration: StorefrontConsentIntegration = {
  integrationKey: providerKey,
  resolveServiceKey: serviceKeyFor,
  Component: StorefrontMicrosoftClarityAdapter,
};
