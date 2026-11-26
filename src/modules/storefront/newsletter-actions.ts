"use server";
import { headers } from "next/headers";
import { requestStorefrontBff } from "../../shared/bff/storefront-client";
import { resolveStorefrontContext } from "./storefront-context";
export type NewsletterPolicy = {
  policyVersionId: string;
  fingerprint: string;
  locale: string;
  text: string;
  privacyPath: string;
};
export type NewsletterResult = {
  ok: boolean;
  message: string;
  policy?: NewsletterPolicy;
};
function parsePolicy(raw: unknown): NewsletterPolicy {
  const p = raw as NewsletterPolicy;
  if (
    !p ||
    typeof p.policyVersionId !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.fingerprint) ||
    typeof p.locale !== "string" ||
    typeof p.text !== "string" ||
    p.text.length > 2000 ||
    p.privacyPath.startsWith("//") ||
    !/^\/[a-zA-Z0-9\/_-]+$/.test(p.privacyPath)
  )
    throw new Error("invalid policy");
  return {
    policyVersionId: p.policyVersionId,
    fingerprint: p.fingerprint,
    locale: p.locale,
    text: p.text,
    privacyPath: p.privacyPath,
  };
}
async function scopeAndOrigin(mutation: boolean) {
  const h = await headers();
  const configured =
    process.env.ECOMMIUM_UI_STOREFRONT_ORIGIN || process.env.NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:5173" : "");
  if (!configured) throw new Error("newsletter origin unavailable");
  const origin = new URL(configured).origin;
  if (
    mutation &&
    (h.get("origin") !== origin || h.get("sec-fetch-site") === "cross-site")
  )
    throw new Error("invalid origin");
  const context = await resolveStorefrontContext({
    host: new URL(origin).host,
  });
  return {
    origin,
    query: new URLSearchParams({
      organizationId: context.organizationId,
      shopId: context.shopId,
      locale: context.locale,
    }),
  };
}
export async function loadNewsletterPolicy(): Promise<NewsletterResult> {
  try {
    const { query } = await scopeAndOrigin(false);
    const r = await requestStorefrontBff(
      "/storefront/communications/newsletter/policy?" + query,
      { parse: parsePolicy },
    );
    if (!r.ok)
      return {
        ok: false,
        message: "La suscripción no está disponible temporalmente.",
      };
    return { ok: true, message: "", policy: r.data };
  } catch {
    return {
      ok: false,
      message: "La suscripción no está disponible temporalmente.",
    };
  }
}
export async function submitNewsletter(
  input: unknown,
): Promise<NewsletterResult> {
  try {
    const p = input as Record<string, unknown>,
      c = p?.consent as Record<string, unknown>;
    if (
      !p ||
      Object.keys(p).some((k) => !["email", "consent", "locale"].includes(k)) ||
      typeof p.email !== "string" ||
      p.email.length > 254 ||
      !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(p.email) ||
      !c ||
      c.accepted !== true ||
      Object.keys(c).some(
        (k) => !["accepted", "policyVersionId", "fingerprint"].includes(k),
      ) ||
      typeof c.policyVersionId !== "string" ||
      c.policyVersionId.length > 80 ||
      typeof c.fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(c.fingerprint) ||
      typeof p.locale !== "string" ||
      !/^[a-z]{2}-[A-Z]{2}$/.test(p.locale)
    )
      return {
        ok: false,
        message: "Revisa el email y acepta recibir el newsletter.",
      };
    const { origin, query } = await scopeAndOrigin(true);
    const r = await requestStorefrontBff(
      "/storefront/communications/newsletter/subscriptions?" + query,
      {
        init: {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify(p),
        },
        parse: (raw) => {
          if ((raw as { status?: string })?.status !== "ACCEPTED")
            throw new Error("invalid response");
          return true;
        },
      },
    );
    return {
      ok: r.ok,
      message: r.ok
        ? "Solicitud recibida. Si corresponde, recibirás un correo para confirmar tu suscripción."
        : r.status === 429
          ? "Demasiados intentos. Vuelve a intentarlo más tarde."
          : r.status === 409
            ? "La información de consentimiento ha cambiado. Recarga la página."
            : "No se pudo completar la solicitud. Inténtalo más tarde.",
    };
  } catch {
    return {
      ok: false,
      message: "No se pudo completar la solicitud. Inténtalo más tarde.",
    };
  }
}
export async function completeNewsletter(
  kind: unknown,
  token: unknown,
): Promise<NewsletterResult> {
  try {
    if (
      !["confirmations", "unsubscriptions"].includes(String(kind)) ||
      typeof token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(token)
    )
      return { ok: false, message: "El enlace no es válido o ha caducado." };
    const { origin, query } = await scopeAndOrigin(true);
    const expected = kind === "confirmations" ? "SUBSCRIBED" : "UNSUBSCRIBED";
    const r = await requestStorefrontBff(
      "/storefront/communications/newsletter/" + kind + "?" + query,
      {
        init: {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ token }),
        },
        parse: (raw) => {
          if ((raw as { status?: string })?.status !== expected)
            throw new Error("invalid response");
          return true;
        },
      },
    );
    return {
      ok: r.ok,
      message: r.ok
        ? kind === "confirmations"
          ? "Tu suscripción está confirmada."
          : "Tu suscripción se ha dado de baja."
        : "El enlace no es válido, ha caducado o no puede procesarse todavía.",
    };
  } catch {
    return {
      ok: false,
      message: "No se pudo completar la operación. Inténtalo más tarde.",
    };
  }
}
