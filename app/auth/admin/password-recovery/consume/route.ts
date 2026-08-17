import { type NextRequest, NextResponse } from "next/server";
import {
  adminCredentialRecoveryCookieName,
  adminCredentialRecoveryCookieOptions,
  sealAdminCredentialRecoveryToken,
} from "../../../../../src/shared/auth/admin-credential-recovery-cookie";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const destination = new URL("/auth/admin/password-recovery/complete", request.url);
  const token = request.nextUrl.searchParams.get("token");
  let cookie: string | null = null;

  try {
    cookie = token ? sealAdminCredentialRecoveryToken(token) : null;
  } catch {
    destination.searchParams.set("error", "El enlace ya no está disponible. Solicita uno nuevo.");
  }

  if (!cookie) {
    destination.searchParams.set("error", "El enlace ya no está disponible. Solicita uno nuevo.");
  }

  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");

  if (cookie) {
    response.cookies.set(
      adminCredentialRecoveryCookieName,
      cookie,
      adminCredentialRecoveryCookieOptions,
    );
  }

  return response;
}
