"use client";

import {
  useEffect,
  type ComponentType,
  type ReactNode,
} from "react";
import type { StorefrontConsentPolicy } from "./storefront-consent";
import { safeConsentScriptSource } from "./storefront-consent-gate-policy";
import { useStorefrontConsentRuntime, useStorefrontConsentService } from "./storefront-consent-runtime";

type ScriptAttributes = {
  async?: boolean;
  crossOrigin?: "anonymous" | "use-credentials";
  defer?: boolean;
  integrity?: string;
  referrerPolicy?: ReferrerPolicy;
};

type ManagedScript = {
  element: HTMLScriptElement;
  users: number;
};

const managedScripts = new Map<string, ManagedScript>();

export type StorefrontConsentGateProps = {
  serviceKey: string;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Bloquea componentes React hasta que el snapshot publicado autorice el
 * servicio. Sin Provider, política o decisión vigente, el resultado es deny.
 */
export function StorefrontConsentGate({
  children,
  fallback = null,
  serviceKey,
}: StorefrontConsentGateProps) {
  const allowed = useStorefrontConsentService(serviceKey);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

/**
 * Variante explícita para contenido remoto (iframe, mapa, vídeo o chat).
 * El proveedor se entrega como React ya auditado; nunca como HTML recibido de
 * Consent ni como un URL ejecutable configurado desde Admin.
 */
export function StorefrontConsentEmbedGate(props: StorefrontConsentGateProps) {
  return <StorefrontConsentGate {...props} />;
}

export type StorefrontConsentScriptGateProps = StorefrontConsentGateProps & {
  src: string;
  id?: string;
  attributes?: ScriptAttributes;
  onError?: () => void;
  onLoad?: () => void;
};

/**
 * Inserta un script solo después de autorización y lo retira al perderla.
 * `src` es una decisión de código revisada, no una propiedad administrable.
 * La CSP sigue siendo la allowlist definitiva de orígenes permitidos.
 */
export function StorefrontConsentScriptGate({
  attributes,
  children,
  fallback = null,
  id,
  onError,
  onLoad,
  serviceKey,
  src,
}: StorefrontConsentScriptGateProps) {
  const allowed = useStorefrontConsentService(serviceKey);

  useEffect(() => {
    if (!allowed) return undefined;

    const normalizedServiceKey = serviceKey.trim();
    const safeSource = safeConsentScriptSource(src, window.location.origin);
    if (!normalizedServiceKey || !safeSource) {
      onError?.();
      return undefined;
    }

    const registryKey = `${normalizedServiceKey}\u0000${safeSource}`;
    let managed = managedScripts.get(registryKey);
    let created = false;
    if (!managed) {
      const element = document.createElement("script");
      element.async = attributes?.async ?? true;
      element.dataset.ecommiumConsentService = normalizedServiceKey;
      if (id) element.id = id;
      if (attributes?.crossOrigin) element.crossOrigin = attributes.crossOrigin;
      if (attributes?.defer) element.defer = true;
      if (attributes?.integrity) element.integrity = attributes.integrity;
      if (attributes?.referrerPolicy) element.referrerPolicy = attributes.referrerPolicy;
      element.src = safeSource;
      managed = { element, users: 0 };
      managedScripts.set(registryKey, managed);
      document.head.append(element);
      created = true;
    }
    managed.users += 1;

    const handleLoad = () => onLoad?.();
    const handleError = () => onError?.();
    if (managed.element.dataset.ecommiumConsentLoaded === "true") {
      handleLoad();
    } else {
      managed.element.addEventListener("load", handleLoad, { once: true });
      managed.element.addEventListener("error", handleError, { once: true });
      if (created) {
        managed.element.addEventListener("load", () => {
          if (managed) {
            managed.element.dataset.ecommiumConsentLoaded = "true";
          }
        }, { once: true });
      }
    }

    return () => {
      managed?.element.removeEventListener("load", handleLoad);
      managed?.element.removeEventListener("error", handleError);
      if (!managed) return;
      managed.users -= 1;
      if (managed.users <= 0) {
        managed.element.remove();
        managedScripts.delete(registryKey);
      }
    };
  }, [allowed, attributes?.async, attributes?.crossOrigin, attributes?.defer, attributes?.integrity, attributes?.referrerPolicy, id, onError, onLoad, serviceKey, src]);

  return allowed ? <>{children}</> : <>{fallback}</>;
}

export type StorefrontConsentIntegration = {
  integrationKey: string;
  resolveServiceKey: (policy: StorefrontConsentPolicy) => string | null;
  Component: ComponentType<{ serviceKey: string }>;
};

/**
 * Registry para integraciones de carga global. Cada adapter se implementa y
 * revisa en código; el dominio Consent únicamente autoriza su `serviceKey`.
 */
export function StorefrontConsentIntegrationRegistry({
  integrations,
}: {
  integrations: readonly StorefrontConsentIntegration[];
}) {
  const { policy } = useStorefrontConsentRuntime();
  return (
    <>
      {policy ? integrations.map(({ Component, integrationKey, resolveServiceKey }) => {
        const serviceKey = resolveServiceKey(policy);
        if (!serviceKey) return null;
        return <StorefrontConsentGate key={integrationKey} serviceKey={serviceKey}>
          <Component serviceKey={serviceKey} />
        </StorefrontConsentGate>;
      }) : null}
    </>
  );
}
