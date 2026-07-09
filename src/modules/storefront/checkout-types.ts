import type { StorefrontOrderform } from "./cart";

export type StorefrontCheckoutIdentityState = "GUEST" | "AUTHENTICATED";

export type StorefrontCheckoutAllowedAction =
  | "client-profile-data"
  | "profile"
  | "anonymize"
  | string;

export type StorefrontCheckoutIdentity = {
  state: StorefrontCheckoutIdentityState;
  customerId?: string | null;
  email?: string | null;
};

export type StorefrontCheckoutContact = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  documentType?: string | null;
  document?: string | null;
};

export type StorefrontCheckoutSection = {
  status?: "COMPLETE" | "INCOMPLETE" | string;
  mutationScope?: StorefrontCheckoutAllowedAction | null;
};

export type StorefrontCheckoutSections = {
  contact?: StorefrontCheckoutSection;
  shipping?: StorefrontCheckoutSection;
  billing?: StorefrontCheckoutSection;
  payment?: StorefrontCheckoutSection;
};

export type StorefrontCheckoutWarning = {
  code?: string;
  message: string;
};

export type StorefrontCheckoutContextResponse = {
  identity: StorefrontCheckoutIdentity;
  orderform: StorefrontOrderform;
  contact?: StorefrontCheckoutContact | null;
  sections?: StorefrontCheckoutSections;
  allowedActions?: StorefrontCheckoutAllowedAction[];
  warnings?: StorefrontCheckoutWarning[];
  storefrontContext?: {
    currency?: string;
    locale?: string;
  };
};
