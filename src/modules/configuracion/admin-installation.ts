import { requestAdminBff } from "../../shared/bff/admin-client";

export const adminInstallationStates = [
  "NOT_INITIALIZED",
  "FRESH_CLAIM_REQUIRED",
  "FRESH_READY",
  "ADOPTION_REQUIRED",
  "REVIEW_REQUIRED",
  "COMPLETED",
] as const;

export type AdminInstallationState = typeof adminInstallationStates[number];

export type AdminInstallationStatus = {
  schema: "admin-installation-public-status.v1";
  state: AdminInstallationState;
  actions: {
    completeFresh: boolean;
    completeAdoption: boolean;
    contactOperator: boolean;
  };
};

export type AdminInstallationFreshCompletion = {
  schema: "admin-installation-public-fresh-completion.v1";
  outcome: "CREATED" | "ALREADY_COMPLETED";
  state: "COMPLETED";
};

export type AdminInstallationAdoptionCompletion = {
  schema: "admin-installation-public-adoption-completion.v1";
  outcome: "ADOPTED" | "ALREADY_COMPLETED";
  state: "COMPLETED";
  security: {
    revokedSessions: number;
    currentSessionRevoked: true;
    requiresLogin: true;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Respuesta de instalación Admin no válida.");
  }

  return value as Record<string, unknown>;
}

function hasExactKeys(record: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(record).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

export function parseAdminInstallationStatus(value: unknown): AdminInstallationStatus {
  const record = asRecord(value);
  const actions = asRecord(record.actions);
  const state = typeof record.state === "string" && adminInstallationStates.includes(record.state as AdminInstallationState)
    ? record.state as AdminInstallationState
    : null;

  if (
    record.schema !== "admin-installation-public-status.v1" ||
    !state ||
    !hasExactKeys(record, ["schema", "state", "actions"]) ||
    !hasExactKeys(actions, ["completeFresh", "completeAdoption", "contactOperator"]) ||
    typeof actions.completeFresh !== "boolean" ||
    typeof actions.completeAdoption !== "boolean" ||
    typeof actions.contactOperator !== "boolean"
  ) {
    throw new Error("Respuesta de instalación Admin no válida.");
  }

  const expected = {
    completeFresh: state === "FRESH_READY",
    completeAdoption: state === "ADOPTION_REQUIRED",
    contactOperator: ["NOT_INITIALIZED", "FRESH_CLAIM_REQUIRED", "REVIEW_REQUIRED"].includes(state),
  };

  if (
    actions.completeFresh !== expected.completeFresh ||
    actions.completeAdoption !== expected.completeAdoption ||
    actions.contactOperator !== expected.contactOperator
  ) {
    throw new Error("Acciones de instalación Admin incoherentes.");
  }

  return {
    schema: "admin-installation-public-status.v1",
    state,
    actions: expected,
  };
}

export function parseAdminInstallationFreshCompletion(value: unknown): AdminInstallationFreshCompletion {
  const record = asRecord(value);
  if (
    !hasExactKeys(record, ["schema", "outcome", "state"]) ||
    record.schema !== "admin-installation-public-fresh-completion.v1" ||
    (record.outcome !== "CREATED" && record.outcome !== "ALREADY_COMPLETED") ||
    record.state !== "COMPLETED"
  ) {
    throw new Error("Respuesta de finalización fresh no válida.");
  }

  return record as AdminInstallationFreshCompletion;
}

export function parseAdminInstallationAdoptionCompletion(value: unknown): AdminInstallationAdoptionCompletion {
  const record = asRecord(value);
  const security = asRecord(record.security);
  if (
    !hasExactKeys(record, ["schema", "outcome", "state", "security"]) ||
    !hasExactKeys(security, ["revokedSessions", "currentSessionRevoked", "requiresLogin"]) ||
    record.schema !== "admin-installation-public-adoption-completion.v1" ||
    (record.outcome !== "ADOPTED" && record.outcome !== "ALREADY_COMPLETED") ||
    record.state !== "COMPLETED" ||
    !Number.isSafeInteger(security.revokedSessions) ||
    Number(security.revokedSessions) < 1 ||
    security.currentSessionRevoked !== true ||
    security.requiresLogin !== true
  ) {
    throw new Error("Respuesta de adopción Admin no válida.");
  }

  return record as AdminInstallationAdoptionCompletion;
}

export async function getAdminInstallationStatus() {
  return requestAdminBff("/admin/installation/status", {
    withAuth: false,
    parse: parseAdminInstallationStatus,
  });
}
