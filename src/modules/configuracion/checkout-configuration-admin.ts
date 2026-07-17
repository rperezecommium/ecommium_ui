import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";

export type CheckoutConfigurationState = "INITIAL" | "PERSISTED";

export type CheckoutResponseMessage = {
  code: string;
  message: string;
  scope: string;
};

export type CheckoutOrderformConfiguration = {
  organizationId: string;
  shopId: string;
  version: number;
  storeContext: {
    defaultLocale: string;
    defaultCurrency: string;
    defaultCountry: string;
  };
  orderFormConfiguration: {
    recaptchaValidation: boolean;
    recaptchaMinScore: number;
    allowManualPrice: boolean;
    savePersonalDataAsOptIn: boolean;
    paymentSystemToCheckFirstInstallment: string[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CheckoutConfigurationResponse = {
  configurationState: CheckoutConfigurationState;
  configuration: CheckoutOrderformConfiguration;
  checkoutResponseMessages: CheckoutResponseMessage[];
};

export type CheckoutConfigurationPatch = {
  storeContext: CheckoutOrderformConfiguration["storeContext"];
  orderFormConfiguration: CheckoutOrderformConfiguration["orderFormConfiguration"];
  isActive: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Respuesta BFF inválida: ${field} es obligatorio.`);
  }

  return value;
}

function requiredBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Respuesta BFF inválida: ${field} debe ser boolean.`);
  }

  return value;
}

function requiredNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Respuesta BFF inválida: ${field} debe ser numérico.`);
  }

  return value;
}

function requiredRecord(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Respuesta BFF inválida: ${field} debe ser un objeto.`);
  }

  return value;
}

function parseStringList(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Respuesta BFF inválida: ${field} debe ser una lista de texto.`);
  }

  return value;
}

function parseCheckoutMessage(value: unknown, index: number): CheckoutResponseMessage {
  const record = requiredRecord(value, `checkoutResponseMessages[${index}]`);

  return {
    code: requiredString(record.code, `checkoutResponseMessages[${index}].code`),
    message: requiredString(record.message, `checkoutResponseMessages[${index}].message`),
    scope: requiredString(record.scope, `checkoutResponseMessages[${index}].scope`),
  };
}

export function parseCheckoutConfigurationResponse(value: unknown): CheckoutConfigurationResponse {
  const response = requiredRecord(value, "respuesta");
  const configurationState = response.configurationState;

  if (configurationState !== "INITIAL" && configurationState !== "PERSISTED") {
    throw new Error("Respuesta BFF inválida: configurationState debe ser INITIAL o PERSISTED.");
  }

  const configuration = requiredRecord(response.configuration, "configuration");
  const storeContext = requiredRecord(configuration.storeContext, "configuration.storeContext");
  const orderFormConfiguration = requiredRecord(
    configuration.orderFormConfiguration,
    "configuration.orderFormConfiguration",
  );

  if (!Array.isArray(response.checkoutResponseMessages)) {
    throw new Error("Respuesta BFF inválida: checkoutResponseMessages debe ser una lista.");
  }

  return {
    configurationState,
    configuration: {
      organizationId: requiredString(configuration.organizationId, "configuration.organizationId"),
      shopId: requiredString(configuration.shopId, "configuration.shopId"),
      version: requiredNumber(configuration.version, "configuration.version"),
      storeContext: {
        defaultLocale: requiredString(storeContext.defaultLocale, "configuration.storeContext.defaultLocale"),
        defaultCurrency: requiredString(storeContext.defaultCurrency, "configuration.storeContext.defaultCurrency"),
        defaultCountry: requiredString(storeContext.defaultCountry, "configuration.storeContext.defaultCountry"),
      },
      orderFormConfiguration: {
        recaptchaValidation: requiredBoolean(
          orderFormConfiguration.recaptchaValidation,
          "configuration.orderFormConfiguration.recaptchaValidation",
        ),
        recaptchaMinScore: requiredNumber(
          orderFormConfiguration.recaptchaMinScore,
          "configuration.orderFormConfiguration.recaptchaMinScore",
        ),
        allowManualPrice: requiredBoolean(
          orderFormConfiguration.allowManualPrice,
          "configuration.orderFormConfiguration.allowManualPrice",
        ),
        savePersonalDataAsOptIn: requiredBoolean(
          orderFormConfiguration.savePersonalDataAsOptIn,
          "configuration.orderFormConfiguration.savePersonalDataAsOptIn",
        ),
        paymentSystemToCheckFirstInstallment: parseStringList(
          orderFormConfiguration.paymentSystemToCheckFirstInstallment,
          "configuration.orderFormConfiguration.paymentSystemToCheckFirstInstallment",
        ),
      },
      isActive: requiredBoolean(configuration.isActive, "configuration.isActive"),
      createdAt: requiredString(configuration.createdAt, "configuration.createdAt"),
      updatedAt: requiredString(configuration.updatedAt, "configuration.updatedAt"),
    },
    checkoutResponseMessages: response.checkoutResponseMessages.map(parseCheckoutMessage),
  };
}

function configurationPath(context: AdminContext) {
  const query = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  return `/admin/checkout/configuration/orderform?${query.toString()}`;
}

export async function getCheckoutConfigurationAdminData(
  context: AdminContext,
): Promise<BffResult<CheckoutConfigurationResponse>> {
  if (!hasRequiredAdminContext(context)) {
    return {
      ok: false,
      status: 428,
      error: "Define una Organization y Shop activas para consultar Checkout.",
      correlationId: "checkout-configuration-context-missing",
    };
  }

  return requestBff(configurationPath(context), {
    context,
    parse: parseCheckoutConfigurationResponse,
  });
}

export async function patchCheckoutConfigurationAdminData(
  context: AdminContext,
  patch: CheckoutConfigurationPatch,
): Promise<BffResult<CheckoutConfigurationResponse>> {
  if (!hasRequiredAdminContext(context)) {
    return {
      ok: false,
      status: 428,
      error: "Define una Organization y Shop activas para configurar Checkout.",
      correlationId: "checkout-configuration-context-missing",
    };
  }

  return requestBff(configurationPath(context), {
    context,
    init: {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    },
    parse: parseCheckoutConfigurationResponse,
  });
}
