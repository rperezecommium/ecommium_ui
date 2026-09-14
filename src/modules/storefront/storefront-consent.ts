export type StorefrontConsentSelection = {
  purposeKey: string;
  status: "GRANTED" | "DENIED";
};

export type StorefrontConsentPolicy = {
  configurationVersionId: string;
  configurationVersion: number;
  snapshotFingerprint: string;
  effectiveLocale: string;
  localeFallback: boolean;
  firstLayerRejectAction: boolean;
  purposes: Array<{
    purposeKey: string;
    necessary: boolean;
    title: string;
    description: string;
  }>;
  services: StorefrontConsentService[];
};

export type StorefrontConsentDecision = {
  action: "ACCEPT_ALL" | "REJECT_ALL" | "SAVE_PREFERENCES" | "WITHDRAW_ALL";
  selections: StorefrontConsentSelection[];
};

export type StorefrontConsentIntegrationBinding = {
  providerKey: string;
  contractVersion: number;
  enabled: boolean;
  publicConfig: Record<string, string>;
};

export type StorefrontConsentService = {
  serviceKey: string;
  purposeKeys: string[];
  integration?: StorefrontConsentIntegrationBinding;
};

import { parsePublishedConsentIntegration } from "./storefront-consent-integration-policy";

export type StorefrontConsentPolicyResponse = {
  status: "AVAILABLE" | "NOT_CONFIGURED";
  policy: StorefrontConsentPolicy | null;
  decision: StorefrontConsentDecision | null;
  renewalRequired: boolean;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const localizedContent = (value: unknown, locale: string): Record<string, unknown> => {
  const content = record(value);
  if (text(content.title) || text(content.description)) return content;
  return record(content[locale]);
};

export function parseStorefrontConsentPolicyResponse(
  value: unknown,
): StorefrontConsentPolicyResponse | null {
  const root = record(value);
  if (root.status === "NOT_CONFIGURED") {
    return {
      status: "NOT_CONFIGURED",
      policy: null,
      decision: null,
      renewalRequired: false,
    };
  }
  if (root.status !== "AVAILABLE" || !text(root.snapshotFingerprint)) return null;

  const snapshot = record(root.snapshot);
  const policy = record(snapshot.policy);
  const effectiveLocale = text(root.effectiveLocale) || text(snapshot.effectiveLocale);
  const purposes = Array.isArray(policy.purposes)
    ? policy.purposes
        .map((item) => {
          const purpose = record(item);
          const content = localizedContent(purpose.content, effectiveLocale);
          return {
            purposeKey: text(purpose.purposeKey),
            necessary: purpose.necessary === true,
            title: text(content.title),
            description: text(content.description),
          };
        })
        .filter((purpose) => purpose.purposeKey && purpose.title && purpose.description)
    : [];
  const services = Array.isArray(policy.services)
    ? policy.services
        .map((item) => {
          const service = record(item);
          return {
            serviceKey: text(service.serviceKey),
            purposeKeys: Array.isArray(service.purposeKeys)
              ? service.purposeKeys.map(text).filter(Boolean)
              : [],
            ...(service.integration === undefined ? {} : { integration: parsePublishedConsentIntegration(service.integration) }),
          };
        })
        .filter((service) => service.serviceKey && service.purposeKeys.length > 0)
    : [];
  const configurationVersionId = text(snapshot.configurationVersionId);
  const configurationVersion =
    typeof snapshot.version === "number" && Number.isInteger(snapshot.version)
      ? snapshot.version
      : 0;

  if (!configurationVersionId || configurationVersion < 1 || !effectiveLocale || purposes.length === 0) {
    return null;
  }

  return {
    status: "AVAILABLE",
    policy: {
      configurationVersionId,
      configurationVersion,
      snapshotFingerprint: text(root.snapshotFingerprint),
      effectiveLocale,
      localeFallback: root.localeFallback === true,
      firstLayerRejectAction: policy.firstLayerRejectAction === true,
      purposes,
      services,
    },
    decision: parseStorefrontConsentDecision(root.decision),
    renewalRequired: root.renewalRequired === true,
  };
}

export function parseStorefrontConsentDecision(
  value: unknown,
): StorefrontConsentDecision | null {
  const decision = record(value);
  if (
    !["ACCEPT_ALL", "REJECT_ALL", "SAVE_PREFERENCES", "WITHDRAW_ALL"].includes(
      text(decision.action),
    )
  ) {
    return null;
  }
  const selections = Array.isArray(decision.selections)
    ? decision.selections
        .map((item) => {
          const selection = record(item);
          return {
            purposeKey: text(selection.purposeKey),
            status: selection.status === "GRANTED" ? ("GRANTED" as const) : ("DENIED" as const),
          };
        })
        .filter((selection) => selection.purposeKey)
    : [];
  return {
    action: decision.action as StorefrontConsentDecision["action"],
    selections,
  };
}

export function consentAllowedServiceKeys(
  policy: StorefrontConsentPolicy,
  decision: StorefrontConsentDecision | null,
): Set<string> {
  const granted = new Set(
    decision?.selections
      .filter((item) => item.status === "GRANTED")
      .map((item) => item.purposeKey) ?? [],
  );
  const allowedPurposes = new Set(
    policy.purposes
      .filter((purpose) => purpose.necessary || granted.has(purpose.purposeKey))
      .map((purpose) => purpose.purposeKey),
  );
  return new Set(
    policy.services
      .filter((service) =>
        service.purposeKeys.every((purposeKey) => allowedPurposes.has(purposeKey)),
      )
      .map((service) => service.serviceKey),
  );
}
