"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestBff } from "../../shared/bff/client";
import type { StorefrontAuthActionState } from "./auth-types";
import {
  getStorefrontSignupHumanVerificationConfig,
  storefrontSignupHumanVerificationAction,
} from "./storefront-human-verification";
import { saveStorefrontCustomerSession } from "./storefront-customer-session";
import { getStorefrontContext } from "./storefront-context";

type StorefrontLoginResponse = {
  profile: {
    principalId: string;
    principalType: "CUSTOMER";
    email: string;
  };
  session: {
    sessionId: string;
    organizationId?: string;
    shopId?: string;
    principalType: "CUSTOMER";
    scope: "storefront";
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  };
};

type StorefrontSignupResponse = {
  profile: {
    customerId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  session: StorefrontLoginResponse["session"] | null;
  tokens: StorefrontLoginResponse["tokens"] | null;
  activation?: {
    status: "not_required" | "pending";
    delivery: "none" | "email_sent" | "email_failed" | "email_skipped";
    expiresAt: string | null;
  };
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function verificationResetKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeRedirectPath(value: string, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function publicAuthError(status?: number) {
  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos e intentalo de nuevo.";
  }

  if (status === 409) {
    return "Ya existe una cuenta con este email. Inicia sesion o solicita recuperar password.";
  }

  if (status === 401 || status === 403) {
    return "No se pudo iniciar sesion. Revisa tus datos e intentalo de nuevo.";
  }

  if (status === 400) {
    return "No se pudo validar el registro. Revisa los datos e intentalo de nuevo.";
  }

  return "No se pudo completar la operacion. Intentalo de nuevo.";
}

function signupActivationMessage(
  activation: StorefrontSignupResponse["activation"],
  hasReturnTo: boolean,
) {
  if (activation?.status !== "pending") {
    return "Cuenta creada correctamente.";
  }

  if (activation.delivery === "email_failed") {
    return "Cuenta creada, pero no pudimos enviar el email de activacion. Solicita reenvio o contacta soporte.";
  }

  if (activation.delivery === "email_skipped") {
    return "Cuenta creada pendiente de activacion. Solicita el email de activacion para continuar.";
  }

  return hasReturnTo
    ? "Cuenta creada. Revisa tu email para activarla; después inicia sesión y verás tus pedidos automáticamente."
    : "Cuenta creada. Revisa tu email para activarla antes de iniciar sesion.";
}

async function deviceHeaders() {
  const requestHeaders = await headers();

  return {
    "user-agent": requestHeaders.get("user-agent") ?? "",
    "x-forwarded-for": requestHeaders.get("x-forwarded-for") ?? "",
    "cf-connecting-ip": requestHeaders.get("cf-connecting-ip") ?? "",
    "x-real-ip": requestHeaders.get("x-real-ip") ?? "",
  };
}

async function saveCustomerSession(response: StorefrontLoginResponse) {
  await saveStorefrontCustomerSession({
    accessToken: response.tokens.accessToken,
    refreshToken: response.tokens.refreshToken,
    expiresInSeconds: response.tokens.expiresInSeconds,
    sessionId: response.session.sessionId,
    customerId: response.profile.principalId,
    email: response.profile.email,
    organizationId: response.session.organizationId,
    shopId: response.session.shopId,
    scope: response.session.scope,
  });
}

export async function loginStorefrontCustomer(
  previousState: StorefrontAuthActionState,
  formData: FormData,
): Promise<StorefrontAuthActionState> {
  void previousState;
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const redirectTo = safeRedirectPath(formString(formData, "redirectTo"), "/account");
  const context = getStorefrontContext();

  if (!email || !password) {
    return {
      status: "error",
      message: "Email y password son obligatorios.",
      email,
    };
  }

  const result = await requestBff<StorefrontLoginResponse>("/auth/login", {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await deviceHeaders()),
      },
      body: JSON.stringify({
        email,
        password,
        organizationId: context.organizationId,
        shopId: context.shopId,
        scope: "storefront",
      }),
    },
  });

  if (!result.ok) {
    return {
      status: "error",
      message: publicAuthError(result.status),
      email,
    };
  }

  await saveCustomerSession(result.data);
  if (redirectTo !== "/account") {
    redirect(redirectTo);
  }
  redirect("/account");
}

export async function signupStorefrontCustomer(
  previousState: StorefrontAuthActionState,
  formData: FormData,
): Promise<StorefrontAuthActionState> {
  void previousState;
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const firstName = formString(formData, "firstName");
  const lastName = formString(formData, "lastName");
  const honeypot = formString(formData, "company");
  const startedAt = formString(formData, "startedAt");
  const turnstileToken = formString(formData, "turnstileToken");
  const redirectTo = formString(formData, "redirectTo");
  const context = getStorefrontContext();
  const humanVerification = getStorefrontSignupHumanVerificationConfig();

  if (!email || !password || !firstName || !lastName) {
    return {
      status: "error",
      message: "Completa nombre, apellido, email y password.",
      email,
      verificationResetKey: verificationResetKey(),
    };
  }

  if (humanVerification.mode === "turnstile" && !turnstileToken) {
    return {
      status: "error",
      message: "Completa la verificacion humana para crear tu cuenta.",
      email,
      verificationResetKey: verificationResetKey(),
    };
  }

  const result = await requestBff<StorefrontSignupResponse>("/auth/signup", {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await deviceHeaders()),
      },
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale: context.locale,
        activationMode: "email",
        humanVerification: {
          ...(turnstileToken
            ? {
                provider: "turnstile",
                token: turnstileToken,
              }
            : {}),
          startedAt,
          honeypot,
          action: storefrontSignupHumanVerificationAction,
        },
      }),
    },
  });

  if (!result.ok) {
    return {
      status: "error",
      message: publicAuthError(result.status),
      email,
      verificationResetKey: verificationResetKey(),
    };
  }

  if (result.data.tokens && result.data.session) {
    await saveCustomerSession({
      profile: {
        principalId: result.data.profile.customerId,
        principalType: "CUSTOMER",
        email: result.data.profile.email,
      },
      session: result.data.session,
      tokens: result.data.tokens,
    });
    if (redirectTo) {
      redirect(safeRedirectPath(redirectTo, "/account"));
    }
  }

  return {
    status: result.data.activation?.status === "pending" ? "activation_pending" : "success",
    message: signupActivationMessage(result.data.activation, Boolean(redirectTo)),
    email,
  };
}

export async function requestStorefrontPasswordReset(
  previousState: StorefrontAuthActionState,
  formData: FormData,
): Promise<StorefrontAuthActionState> {
  void previousState;
  const email = formString(formData, "email");
  const context = getStorefrontContext();

  if (!email) {
    return {
      status: "error",
      message: "Email es obligatorio.",
      email,
    };
  }

  const result = await requestBff<{ status: "accepted" }>("/auth/password-reset/request", {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await deviceHeaders()),
      },
      body: JSON.stringify({
        email,
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale: context.locale,
      }),
    },
  });

  if (!result.ok) {
    return {
      status: "error",
      message: publicAuthError(result.status),
      email,
    };
  }

  return {
    status: "success",
    message: "Si la cuenta existe, recibiras un email para crear una nueva password.",
    email,
  };
}

export async function confirmStorefrontPasswordReset(
  previousState: StorefrontAuthActionState,
  formData: FormData,
): Promise<StorefrontAuthActionState> {
  void previousState;
  const token = formString(formData, "token");
  const password = formString(formData, "password");
  const context = getStorefrontContext();

  if (!token || !password) {
    return {
      status: "error",
      message: "Token y nueva password son obligatorios.",
    };
  }

  const result = await requestBff<{ status: "password_reset" }>("/auth/password-reset/confirm", {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token,
        password,
        locale: context.locale,
      }),
    },
  });

  if (!result.ok) {
    return {
      status: "error",
      message: "El enlace es invalido o expiro. Solicita uno nuevo.",
    };
  }

  return {
    status: "success",
    message: "Password actualizada. Ya puedes iniciar sesion.",
  };
}

export async function resendStorefrontActivation(
  previousState: StorefrontAuthActionState,
  formData: FormData,
): Promise<StorefrontAuthActionState> {
  void previousState;
  const email = formString(formData, "email");
  const context = getStorefrontContext();

  if (!email) {
    return {
      status: "error",
      message: "Email es obligatorio.",
      email,
    };
  }

  const result = await requestBff<{ status: "accepted" }>("/auth/activation/resend", {
    withAuth: false,
    context: { locale: context.locale },
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await deviceHeaders()),
      },
      body: JSON.stringify({
        email,
        organizationId: context.organizationId,
        shopId: context.shopId,
        locale: context.locale,
      }),
    },
  });

  if (!result.ok) {
    return {
      status: "error",
      message: publicAuthError(result.status),
      email,
    };
  }

  return {
    status: "success",
    message: "Si la cuenta sigue pendiente, recibiras un nuevo enlace de activacion.",
    email,
  };
}

export async function activateStorefrontCustomer(token: string): Promise<StorefrontAuthActionState> {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return {
      status: "error",
      message: "Token de activacion ausente.",
    };
  }

  const result = await requestBff<{ status: "activated" | "already_active" }>("/auth/activate", {
    withAuth: false,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: normalizedToken }),
    },
  });

  if (!result.ok) {
    if (!result.status || result.status >= 500) {
      return {
        status: "error",
        message: "No pudimos contactar el servicio de activación. Tu enlace no se ha consumido; inténtalo de nuevo en unos minutos.",
      };
    }

    return {
      status: "error",
      message: "El enlace de activación es inválido, ya fue utilizado o expiró.",
    };
  }

  return {
    status: "success",
    message: result.data.status === "already_active" ? "Tu cuenta ya estaba activa." : "Cuenta activada. Ya puedes iniciar sesion.",
  };
}

export async function activateStorefrontCustomerAction(
  previousState: StorefrontAuthActionState,
  formData: FormData,
): Promise<StorefrontAuthActionState> {
  void previousState;
  return activateStorefrontCustomer(formString(formData, "token"));
}
