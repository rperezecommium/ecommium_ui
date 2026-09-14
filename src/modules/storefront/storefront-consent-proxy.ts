import { getStorefrontBffBaseUrl } from "../../shared/config/storefront-env";
import { getStorefrontContext } from "./storefront-context";
import { readJsonObject, validateSameOriginMutation } from "../../shared/security/request-security";

const cacheControl = "private, no-store, max-age=0";
const subjectCookieName = "ec_consent_subject";
const maximumDecisionBytes = 16 * 1024;
const decisionKeys = new Set([
  "configurationVersionId",
  "configurationVersion",
  "snapshotFingerprint",
  "effectiveLocale",
  "action",
  "selections",
  "origin",
  "idempotencyKey",
]);
const actions = new Set(["ACCEPT_ALL", "REJECT_ALL", "SAVE_PREFERENCES", "WITHDRAW_ALL"]);
const origins = new Set(["BANNER", "PREFERENCE_CENTER"]);

type ConsentProxyContext = {
  organizationId: string;
  shopId: string;
  locale: string;
  publicHost: string;
};

function errorResponse(message: string, status: number) {
  return Response.json({ message }, {
    status,
    headers: { "Cache-Control": cacheControl },
  });
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum
    ? value.trim()
    : undefined;
}

function publicHost(request: Request): string | undefined {
  const requestUrl = new URL(request.url);
  if (process.env.NODE_ENV !== "production") return requestUrl.host.toLowerCase();

  const configured = process.env.NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL?.trim();
  if (!configured) return undefined;
  try {
    const publicUrl = new URL(configured);
    if (
      publicUrl.protocol !== "https:" ||
      publicUrl.username ||
      publicUrl.password ||
      publicUrl.pathname !== "/" ||
      publicUrl.search ||
      publicUrl.hash ||
      requestUrl.host.toLowerCase() !== publicUrl.host.toLowerCase()
    ) return undefined;
    return publicUrl.host.toLowerCase();
  } catch {
    return undefined;
  }
}

async function contextFor(request: Request, includeLocale: boolean): Promise<ConsentProxyContext | Response> {
  const requestUrl = new URL(request.url);
  const allowedKeys = includeLocale
    ? new Set(["organizationId", "shopId", "locale"])
    : new Set(["organizationId", "shopId"]);
  if (
    Array.from(requestUrl.searchParams.keys()).some((key) => !allowedKeys.has(key)) ||
    Array.from(allowedKeys).some((key) => requestUrl.searchParams.getAll(key).length !== 1)
  ) {
    return errorResponse("La solicitud de consentimiento no tiene parámetros válidos.", 400);
  }

  let context: Awaited<ReturnType<typeof getStorefrontContext>>;
  try {
    context = await getStorefrontContext();
  } catch {
    return errorResponse("No se pudo resolver el contexto de la tienda para Consent.", 503);
  }
  if (
    requestUrl.searchParams.get("organizationId") !== context.organizationId ||
    requestUrl.searchParams.get("shopId") !== context.shopId ||
    (includeLocale && requestUrl.searchParams.get("locale") !== context.locale)
  ) {
    return errorResponse("El contexto de consentimiento no coincide con la tienda activa.", 400);
  }

  const host = publicHost(request);
  if (!host) {
    return errorResponse("La URL pública de la tienda no está configurada correctamente.", 503);
  }
  return { organizationId: context.organizationId, shopId: context.shopId, locale: context.locale, publicHost: host };
}

function isResponse(value: ConsentProxyContext | Response): value is Response {
  return value instanceof Response;
}

function consentSubjectCookie(cookieHeader: string | null): string | undefined {
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${subjectCookieName}=`))
    ?.slice(subjectCookieName.length + 1);
  return value && /^[A-Za-z0-9_-]{32,}$/.test(value)
    ? `${subjectCookieName}=${value}`
    : undefined;
}

function getSetCookies(headers: Headers): string[] {
  const extendedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const values = extendedHeaders.getSetCookie?.();
  if (values?.length) return values;
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function isSafeConsentSubjectCookie(value: string) {
  const parts = value.split(";").map((part) => part.trim());
  const [nameValue, ...attributes] = parts;
  if (!new RegExp(`^${subjectCookieName}=[A-Za-z0-9_-]{32,}$`).test(nameValue)) return false;
  const normalized = attributes.map((attribute) => attribute.toLowerCase());
  if (normalized.some((attribute) => attribute.startsWith("domain="))) return false;
  if (!normalized.includes("path=/") || !normalized.includes("httponly") || !normalized.includes("samesite=lax")) return false;
  return process.env.NODE_ENV !== "production" || normalized.includes("secure");
}

async function relayConsentResponse(upstream: Response): Promise<Response> {
  if (!upstream.ok) {
    return errorResponse("No se pudieron recuperar las preferencias de privacidad.", upstream.status >= 400 && upstream.status < 500 ? upstream.status : 503);
  }
  if (!upstream.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("La respuesta de consentimiento no tiene un formato válido.", 503);
  }

  const cookies = getSetCookies(upstream.headers);
  if (cookies.some((cookie) => !isSafeConsentSubjectCookie(cookie))) {
    return errorResponse("La cookie de consentimiento no cumple la política de seguridad.", 503);
  }

  const headers = new Headers({
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Cookie",
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(await upstream.text(), { status: upstream.status, headers });
}

async function requestBff(
  request: Request,
  path: "policy" | "decisions",
  context: ConsentProxyContext,
  body?: Record<string, unknown>,
): Promise<Response> {
  const parameters = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    ...(path === "policy" ? { locale: context.locale } : {}),
  });
  const headers = new Headers({
    Accept: "application/json",
    Host: context.publicHost,
    "x-correlation-id": `ui-consent-${crypto.randomUUID()}`,
  });
  const subjectCookie = consentSubjectCookie(request.headers.get("cookie"));
  if (subjectCookie) headers.set("Cookie", subjectCookie);
  if (body) headers.set("Content-Type", "application/json");

  try {
    const upstream = await fetch(
      `${getStorefrontBffBaseUrl()}/storefront/consent/${path}?${parameters}`,
      {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
      },
    );
    return relayConsentResponse(upstream);
  } catch {
    return errorResponse("El servicio de preferencias no está disponible temporalmente.", 503);
  }
}

function validDecision(value: Record<string, unknown>) {
  if (Object.keys(value).some((key) => !decisionKeys.has(key))) return false;
  if (
    !boundedText(value.configurationVersionId, 128) ||
    !Number.isInteger(value.configurationVersion) || Number(value.configurationVersion) < 1 ||
    !boundedText(value.snapshotFingerprint, 256) ||
    !boundedText(value.effectiveLocale, 40) ||
    !actions.has(String(value.action)) ||
    !origins.has(String(value.origin)) ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value.idempotencyKey)) ||
    !Array.isArray(value.selections) || value.selections.length > 64
  ) return false;
  return value.selections.every((selection) => {
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) return false;
    const entry = selection as Record<string, unknown>;
    return (
      Object.keys(entry).length === 2 &&
      !!boundedText(entry.purposeKey, 100) &&
      (entry.status === "GRANTED" || entry.status === "DENIED")
    );
  });
}

export async function proxyConsentPolicy(request: Request) {
  const context = await contextFor(request, true);
  return isResponse(context) ? context : requestBff(request, "policy", context);
}

export async function proxyConsentDecision(request: Request) {
  const sameOriginError = validateSameOriginMutation(request);
  if (sameOriginError && !sameOriginError.ok) return errorResponse(sameOriginError.message, sameOriginError.status);
  const body = await readJsonObject(request, maximumDecisionBytes);
  if (!body.ok || !validDecision(body.value)) {
    return errorResponse(body.ok ? "La decisión de consentimiento no tiene un formato válido." : body.message, body.ok ? 400 : body.status);
  }
  const context = await contextFor(request, false);
  return isResponse(context) ? context : requestBff(request, "decisions", context, body.value);
}
