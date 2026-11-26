import { AdminFormValidationError } from "../../shared/validation/admin-form-state";
export type PaymentConfigurationKind =
  | "payment-systems"
  | "affiliations"
  | "rules";
export function paymentConfigurationPayload(
  kind: PaymentConfigurationKind,
  data: FormData,
) {
  const errors: Record<string, string> = {};
  const text = (key: string) => String(data.get(key) ?? "").trim();
  const required = (key: string, label: string) => {
    const value = text(key);
    if (!value) errors[key] = `${label} es obligatorio.`;
    return value;
  };
  const integer = (key: string, minimum: number, requiredField = false) => {
    const value = text(key);
    if (!value) {
      if (requiredField) errors[key] = "Introduce un número entero.";
      return undefined;
    }
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < minimum) {
      errors[key] = `Introduce un entero mayor o igual a ${minimum}.`;
      return undefined;
    }
    return n;
  };
  const active = text("active") === "on" || text("active") === "true",
    name = required("name", "El nombre");
  let payload;
  if (kind === "payment-systems") {
    const supportsInstallments =
      text("supportsInstallments") === "on" ||
      text("supportsInstallments") === "true";
    const maxInstallments = integer("maxInstallments", 1, supportsInstallments);
    payload = {
      paymentSystemId: required("paymentSystemId", "El identificador"),
      name,
      group: required("group", "El grupo"),
      type: required("type", "El tipo"),
      active,
      supportsInstallments,
      ...(supportsInstallments ? { maxInstallments } : {}),
    };
  } else if (kind === "affiliations") {
    payload = {
      affiliationId: required("affiliationId", "El identificador"),
      name,
      providerName: required("providerName", "El proveedor"),
      merchantId: required("merchantId", "La cuenta merchant"),
      active,
    };
  } else {
    const minValueMinor = integer("minValueMinor", 0) ?? 0,
      maxValueMinor = integer("maxValueMinor", 0) ?? null,
      priority = integer("priority", 0, true),
      country = required("country", "El país"),
      currency = required("currency", "La moneda");
    if (!/^[A-Z]{2}$/.test(country))
      errors.country = "Usa el código de país de dos letras mayúsculas.";
    if (!/^[A-Z]{3}$/.test(currency))
      errors.currency = "Usa el código de moneda de tres letras mayúsculas.";
    if (maxValueMinor !== null && maxValueMinor < minValueMinor)
      errors.maxValueMinor = "El máximo debe ser mayor o igual al mínimo.";
    payload = {
      ruleId: required("ruleId", "El identificador"),
      name,
      paymentSystemId: required("paymentSystemId", "El método"),
      affiliationId: required("affiliationId", "El proveedor"),
      priority,
      country,
      currency,
      minValueMinor,
      maxValueMinor,
      active,
      ...(text("salesChannel") ? { salesChannel: text("salesChannel") } : {}),
    };
  }
  if (Object.keys(errors).length) throw new AdminFormValidationError(errors);
  return payload;
}
export function parsePaymentConfiguration(
  kind: PaymentConfigurationKind,
  value: unknown,
  expectedId: string,
) {
  const x = value as Record<string, unknown>;
  const key =
    kind === "payment-systems"
      ? "paymentSystemId"
      : kind === "affiliations"
        ? "affiliationId"
        : "ruleId";
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    x[key] !== expectedId ||
    typeof x.name !== "string" ||
    !x.name ||
    typeof x.active !== "boolean"
  )
    throw Error("Invalid payment configuration response");
  if (
    (kind === "payment-systems" &&
      (typeof x.group !== "string" || typeof x.type !== "string")) ||
    (kind === "affiliations" && typeof x.providerName !== "string") ||
    (kind === "rules" &&
      (typeof x.paymentSystemId !== "string" ||
        typeof x.affiliationId !== "string"))
  )
    throw Error("Invalid payment configuration response");
  return x;
}
