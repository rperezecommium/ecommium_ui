"use client";

import { useEffect } from "react";
import type { StorefrontConsentPolicy } from "./storefront-consent";
import {
  StorefrontConsentScriptGate,
  type StorefrontConsentIntegration,
} from "./storefront-consent-gates";
import { useStorefrontConsentRuntime } from "./storefront-consent-runtime";

const metaPixelProviderKey = "meta-pixel";
const metaPixelContractVersion = 1;
const metaPixelId = /^[0-9]{15}$/;
const metaPixelScriptSource = "https://connect.facebook.net/en_US/fbevents.js";

type MetaPixelCommand = ((...args: unknown[]) => void) & {
  queue?: unknown[][];
  push?: MetaPixelCommand;
  loaded?: boolean;
  version?: string;
};
type MetaPixelWindow = Window & typeof globalThis & { fbq?: MetaPixelCommand; _fbq?: MetaPixelCommand };

function metaPixelConfiguration(policy: StorefrontConsentPolicy | null, serviceKey: string): string | null {
  const integration = policy?.services.find((service) => service.serviceKey === serviceKey)?.integration;
  const pixelId = integration?.publicConfig.pixelId?.trim() ?? "";
  if (integration?.providerKey !== metaPixelProviderKey || integration.contractVersion !== metaPixelContractVersion || integration.enabled !== true || !metaPixelId.test(pixelId)) return null;
  return pixelId;
}

function metaPixelServiceKey(policy: StorefrontConsentPolicy): string | null {
  return policy.services.find((service) => metaPixelConfiguration(policy, service.serviceKey))?.serviceKey ?? null;
}

function metaPixelCommand(): MetaPixelCommand {
  const pixelWindow = window as MetaPixelWindow;
  if (pixelWindow.fbq) return pixelWindow.fbq;
  const queued = ((...args: unknown[]) => {
    queued.queue ??= [];
    queued.queue.push(args);
  }) as MetaPixelCommand;
  queued.queue = [];
  queued.push = queued;
  queued.loaded = true;
  queued.version = "2.0";
  pixelWindow.fbq = queued;
  pixelWindow._fbq = queued;
  return queued;
}

function StorefrontMetaPixelCommands({ pixelId }: { pixelId: string }) {
  useEffect(() => {
    const fbq = metaPixelCommand();
    // Alcance aprobado: solo la visita de página. No se incluyen compras,
    // datos de cliente, advanced matching ni eventos personalizados.
    fbq("consent", "grant");
    fbq("init", pixelId);
    fbq("track", "PageView");
    return () => {
      // La retirada se comunica incluso si React desmonta el adapter antes de
      // que el registro general de limpieza procese el nuevo consentimiento.
      fbq("consent", "revoke");
    };
  }, [pixelId]);
  return null;
}

export function StorefrontMetaPixelAdapter({ serviceKey }: { serviceKey: string }) {
  const { policy } = useStorefrontConsentRuntime();
  const pixelId = metaPixelConfiguration(policy, serviceKey);
  if (!pixelId) return null;
  return <StorefrontConsentScriptGate serviceKey={serviceKey} src={metaPixelScriptSource}>
    <StorefrontMetaPixelCommands pixelId={pixelId} />
  </StorefrontConsentScriptGate>;
}

export const storefrontMetaPixelIntegration: StorefrontConsentIntegration = {
  integrationKey: metaPixelProviderKey,
  resolveServiceKey: metaPixelServiceKey,
  Component: StorefrontMetaPixelAdapter,
};
