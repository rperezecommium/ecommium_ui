export type ImportPhase = "idle" | "uploading" | "preparing" | "staged" | "applying" | "polling" | "completed" | "failed" | "paused";
export type OwnerJob = { owner: string; response: Record<string, unknown> };
export type ImportOutcomes = {
  unidentifiedRows: number;
  counts: { received: number; persisted: number; rejected: number; draft: number; published: number; pending: number };
  items: Array<{ externalId: string; productId: string | null; state: "PENDING" | "REJECTED" | "DRAFT" | "PUBLISHED"; reasons: string[] }>;
  nextCursor: string | null;
};
export type ImportResponse = {
  importJobId?: string;
  state?: string;
  managed?: boolean;
  authorizationRefreshPending?: boolean;
  phase?: string;
  jobs?: OwnerJob[];
  errors?: Array<{ owner: string; message: string }>;
  outcomes?: ImportOutcomes;
};

export function shouldPollImport(body: ImportResponse): boolean {
  return ["preparing", "polling"].includes(importPhase(body)) ||
    (body.state === "AWAITING_AUTHORIZATION" && body.authorizationRefreshPending === true);
}

export function importPhase(body: ImportResponse): ImportPhase {
  if (["PAUSED", "AWAITING_AUTHORIZATION"].includes(body.state ?? "")) return "paused";
  if (body.state === "FAILED" || body.state === "PARTIALLY_APPLIED" || body.errors?.length) return "failed";
  if (["COMPLETED", "COMPLETED_WITH_WARNINGS"].includes(body.state ?? "")) return body.managed ? "completed" : "polling";
  if (body.managed) return "polling";
  if (["STAGED", "VALIDATED", "READY"].includes(body.state ?? "")) return "staged";
  return "preparing";
}

export function statusProgress(payload: ImportResponse | null): number {
  if (!payload) return 0;
  if (importPhase(payload) === "completed") return 100;
  if (payload.phase === "projection") return 95;
  if (payload.phase === "publication") return 90;
  const jobs = payload.jobs ?? [];
  if (!jobs.length) return payload.state === "STAGED" ? 25 : 10;
  const completed = jobs.filter(job => String(job.response.state).startsWith("COMPLETED")).length;
  return Math.min(85, 35 + Math.round(completed / jobs.length * 50));
}
