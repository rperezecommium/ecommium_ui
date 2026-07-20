import type { AdminContext } from "../../shared/config/admin-context";
import type { CheckoutConfigurationPatch } from "./checkout-configuration-admin";

function value(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function requiredContextText(rawValue: string, label: string, maximumLength: number) {
  const normalized = rawValue.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new Error(`${label} es obligatorio y debe tener como máximo ${maximumLength} caracteres.`);
  }

  return normalized;
}

function requiredLocale(context: AdminContext) {
  const locale = requiredContextText(context.locale, "Idioma del contexto activo", 35);
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) {
    throw new Error("El idioma del contexto activo debe usar un locale válido, por ejemplo es-ES.");
  }

  return locale;
}

function requiredCurrency(context: AdminContext) {
  const currency = requiredContextText(context.currency, "Moneda del contexto activo", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("La moneda del contexto activo debe ser un código ISO de tres letras, por ejemplo EUR.");
  }

  return currency;
}

function requiredCountry(context: AdminContext) {
  const country = requiredContextText(context.country, "País del contexto activo", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("El país del contexto activo debe ser un código ISO de dos letras, por ejemplo ES.");
  }

  return country;
}

function booleanValue(formData: FormData, name: string) {
  const raw = formData.get(name);
  return raw === "on" || raw === "true";
}

function recaptchaMinScore(formData: FormData) {
  const raw = value(formData, "recaptchaMinScore");
  const parsed = Number(raw);

  if (!raw || !Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("El score mínimo de ReCAPTCHA debe estar entre 0 y 1.");
  }

  return parsed;
}

function paymentSystems(formData: FormData) {
  const systems = value(formData, "paymentSystemToCheckFirstInstallment")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const normalized = [...new Set(systems)];

  if (normalized.some((item) => item.length > 60)) {
    throw new Error("Cada método de pago puede tener como máximo 60 caracteres.");
  }
  if (normalized.length > 10) {
    throw new Error("Checkout admite como máximo 10 métodos para el control de primera cuota.");
  }

  return normalized;
}

export function checkoutConfigurationPatchFromForm(
  formData: FormData,
  context: AdminContext,
): CheckoutConfigurationPatch {
  return {
    storeContext: {
      defaultLocale: requiredLocale(context),
      defaultCurrency: requiredCurrency(context),
      defaultCountry: requiredCountry(context),
    },
    orderFormConfiguration: {
      recaptchaValidation: booleanValue(formData, "recaptchaValidation"),
      recaptchaMinScore: recaptchaMinScore(formData),
      allowManualPrice: booleanValue(formData, "allowManualPrice"),
      savePersonalDataAsOptIn: booleanValue(formData, "savePersonalDataAsOptIn"),
      paymentSystemToCheckFirstInstallment: paymentSystems(formData),
    },
    isActive: booleanValue(formData, "isActive"),
  };
}
