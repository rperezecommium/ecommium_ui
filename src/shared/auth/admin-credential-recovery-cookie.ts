import { sealAdminSessionCookie, unsealAdminSessionCookie } from "./admin-session-cookie";

export const adminCredentialRecoveryCookieName = "ecommium_admin_credential_recovery";

const maxAgeSeconds = 15 * 60;

type AdminCredentialRecoveryPayload = {
  expiresAt: number;
  token: string;
};

function isRecoveryToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length >= 32 &&
    value.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function sealAdminCredentialRecoveryToken(token: string) {
  if (!isRecoveryToken(token)) {
    throw new Error("Invalid Admin credential recovery token");
  }

  return sealAdminSessionCookie(JSON.stringify({
    token,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  } satisfies AdminCredentialRecoveryPayload));
}

export function unsealAdminCredentialRecoveryToken(value: string | undefined) {
  const payload = unsealAdminSessionCookie(value);
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<AdminCredentialRecoveryPayload>;
    if (
      !isRecoveryToken(parsed.token) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }

    return parsed.token;
  } catch {
    return null;
  }
}

export const adminCredentialRecoveryCookieOptions = {
  httpOnly: true,
  maxAge: maxAgeSeconds,
  path: "/auth/admin/password-recovery",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
