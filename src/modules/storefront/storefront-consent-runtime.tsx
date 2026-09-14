"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  consentAllowedServiceKeys,
  parseStorefrontConsentPolicyResponse,
  type StorefrontConsentDecision,
  type StorefrontConsentPolicy,
  type StorefrontConsentSelection,
} from "./storefront-consent";

type ConsentRuntimeStatus = "loading" | "available" | "not-configured" | "unavailable";
type ConsentOrigin = "BANNER" | "PREFERENCE_CENTER";
type ConsentOperationResult =
  | { ok: true }
  | { ok: false; reason: "POLICY_UNAVAILABLE" | "DECISION_UNAVAILABLE" };

type StorefrontConsentRuntime = {
  locale: string;
  status: ConsentRuntimeStatus;
  policy: StorefrontConsentPolicy | null;
  decision: StorefrontConsentDecision | null;
  renewalRequired: boolean;
  isSaving: boolean;
  reload: () => Promise<void>;
  recordDecision: (
    action: StorefrontConsentDecision["action"],
    selections: StorefrontConsentSelection[],
    origin: ConsentOrigin,
  ) => Promise<ConsentOperationResult>;
};

const unavailableRuntime: StorefrontConsentRuntime = {
  locale: "en",
  status: "unavailable",
  policy: null,
  decision: null,
  renewalRequired: false,
  isSaving: false,
  reload: async () => undefined,
  recordDecision: async () => ({ ok: false, reason: "POLICY_UNAVAILABLE" }),
};

const StorefrontConsentContext = createContext<StorefrontConsentRuntime>(unavailableRuntime);

export function StorefrontConsentProvider({
  children,
  locale,
  organizationId,
  shopId,
}: {
  children: ReactNode;
  locale: string;
  organizationId: string;
  shopId: string;
}) {
  const [status, setStatus] = useState<ConsentRuntimeStatus>("loading");
  const [policy, setPolicy] = useState<StorefrontConsentPolicy | null>(null);
  const [decision, setDecision] = useState<StorefrontConsentDecision | null>(null);
  const [renewalRequired, setRenewalRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    const parameters = new URLSearchParams({ organizationId, shopId, locale });
    try {
      const response = await fetch(`/api/v1/storefront/consent/policy?${parameters}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("CONSENT_POLICY_UNAVAILABLE");
      const parsed = parseStorefrontConsentPolicyResponse(await response.json());
      if (!parsed) throw new Error("CONSENT_POLICY_INVALID");

      setPolicy(parsed.policy);
      setDecision(parsed.decision);
      setRenewalRequired(parsed.renewalRequired);
      setStatus(parsed.status === "AVAILABLE" ? "available" : "not-configured");
    } catch {
      setPolicy(null);
      setDecision(null);
      setRenewalRequired(false);
      setStatus("unavailable");
    }
  }, [locale, organizationId, shopId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const recordDecision = useCallback(
    async (
      action: StorefrontConsentDecision["action"],
      selections: StorefrontConsentSelection[],
      origin: ConsentOrigin,
    ): Promise<ConsentOperationResult> => {
      if (!policy || status !== "available" || savingRef.current) {
        return { ok: false, reason: "POLICY_UNAVAILABLE" };
      }

      savingRef.current = true;
      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/v1/storefront/consent/decisions?${new URLSearchParams({ organizationId, shopId })}`,
          {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              configurationVersionId: policy.configurationVersionId,
              configurationVersion: policy.configurationVersion,
              snapshotFingerprint: policy.snapshotFingerprint,
              effectiveLocale: policy.effectiveLocale,
              action,
              selections,
              origin,
              idempotencyKey: crypto.randomUUID(),
            }),
          },
        );
        if (!response.ok) throw new Error("CONSENT_DECISION_NOT_RECORDED");

        await load();
        return { ok: true };
      } catch {
        return { ok: false, reason: "DECISION_UNAVAILABLE" };
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [load, organizationId, policy, shopId, status],
  );

  const value = useMemo<StorefrontConsentRuntime>(
    () => ({ locale, status, policy, decision, renewalRequired, isSaving, reload: load, recordDecision }),
    [decision, isSaving, load, locale, policy, recordDecision, renewalRequired, status],
  );

  return (
    <StorefrontConsentContext.Provider value={value}>
      {children}
    </StorefrontConsentContext.Provider>
  );
}

export function useStorefrontConsentRuntime(): StorefrontConsentRuntime {
  return useContext(StorefrontConsentContext);
}

export function useStorefrontConsentService(serviceKey: string): boolean {
  const { decision, policy, status } = useStorefrontConsentRuntime();
  return useMemo(() => {
    if (status !== "available" || !policy) return false;
    return consentAllowedServiceKeys(policy, decision).has(serviceKey);
  }, [decision, policy, serviceKey, status]);
}
