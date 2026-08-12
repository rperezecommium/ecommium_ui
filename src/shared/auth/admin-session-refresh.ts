import { adminBffBaseUrl } from "../config/env";

type RefreshTokensResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    }
  | { ok: false; status: number };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asToken(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function refreshUrl() {
  const base = adminBffBaseUrl.replace(/\/$/, "");
  return `${base}/auth/refresh`;
}

export async function refreshAdminTokens(refreshToken: string): Promise<RefreshTokensResult> {
  try {
    const response = await fetch(refreshUrl(), {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-correlation-id": `ui-admin-refresh-${Date.now()}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return { ok: false, status: response.status };

    const payload = asRecord(await response.json());
    const tokens = asRecord(payload.tokens);
    const accessToken = asToken(tokens.accessToken);
    const nextRefreshToken = asToken(tokens.refreshToken);
    const expiresInSeconds = tokens.expiresInSeconds;
    if (
      !accessToken ||
      !nextRefreshToken ||
      typeof expiresInSeconds !== "number" ||
      !Number.isFinite(expiresInSeconds) ||
      expiresInSeconds <= 0
    ) {
      return { ok: false, status: 502 };
    }

    return {
      ok: true,
      accessToken,
      refreshToken: nextRefreshToken,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    };
  } catch {
    return { ok: false, status: 503 };
  }
}
