export const bffBaseUrl =
  process.env.ECOMMIUM_BFF_BASE_URL ?? "http://localhost:3010/api/v1";

export const defaultAdminContext = {
  organizationId: process.env.ECOMMIUM_DEFAULT_ORGANIZATION_ID ?? "",
  shopId: process.env.ECOMMIUM_DEFAULT_SHOP_ID ?? "",
  locale: process.env.ECOMMIUM_DEFAULT_LOCALE ?? "es-ES",
  currency: process.env.ECOMMIUM_DEFAULT_CURRENCY ?? "EUR",
  country: process.env.ECOMMIUM_DEFAULT_COUNTRY ?? "ES",
  channel: process.env.ECOMMIUM_DEFAULT_CHANNEL ?? "admin",
};
