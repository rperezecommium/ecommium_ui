import { defaultAdminContext } from "../../shared/config/env";

export type StorefrontContext = {
  organizationId: string;
  shopId: string;
  shopAlias: string;
  locale: string;
  currency: string;
  country: string;
  channel: string;
};

const localStorefrontDefaults: StorefrontContext = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  shopId: "22222222-2222-4222-8222-222222222222",
  shopAlias: "tienda-barcelona",
  locale: "es-ES",
  currency: "EUR",
  country: "ES",
  channel: "web",
};

export function getStorefrontContext(): StorefrontContext {
  return {
    organizationId:
      process.env.ECOMMIUM_STOREFRONT_ORGANIZATION_ID ||
      defaultAdminContext.organizationId ||
      localStorefrontDefaults.organizationId,
    shopId:
      process.env.ECOMMIUM_STOREFRONT_SHOP_ID ||
      defaultAdminContext.shopId ||
      localStorefrontDefaults.shopId,
    shopAlias:
      process.env.ECOMMIUM_STOREFRONT_SHOP_ALIAS ||
      defaultAdminContext.shopAlias ||
      localStorefrontDefaults.shopAlias,
    locale:
      process.env.ECOMMIUM_STOREFRONT_LOCALE ||
      defaultAdminContext.locale ||
      localStorefrontDefaults.locale,
    currency:
      process.env.ECOMMIUM_STOREFRONT_CURRENCY ||
      defaultAdminContext.currency ||
      localStorefrontDefaults.currency,
    country:
      process.env.ECOMMIUM_STOREFRONT_COUNTRY ||
      defaultAdminContext.country ||
      localStorefrontDefaults.country,
    channel:
      process.env.ECOMMIUM_STOREFRONT_CHANNEL ||
      localStorefrontDefaults.channel,
  };
}
