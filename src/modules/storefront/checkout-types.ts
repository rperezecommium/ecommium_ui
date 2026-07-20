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

export type StorefrontCheckoutAddress = {
  addressId?: string | null;
  alias?: string | null;
  addressType?: string | null;
  addressRole?: "SHIPPING" | "BILLING" | "BOTH" | string | null;
  receiverName?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  complement?: string | null;
  reference?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type StorefrontCheckoutAddressBook = {
  maxAddresses: number;
  count: number;
  defaultShippingAddressId?: string | null;
  defaultBillingAddressId?: string | null;
  items: StorefrontCheckoutAddress[];
};

export type StorefrontCheckoutShippingSection = StorefrontCheckoutSection & {
  selectedAddress?: StorefrontCheckoutAddress | null;
  addressBook?: StorefrontCheckoutAddressBook | null;
};

export type StorefrontCheckoutSections = {
  contact?: StorefrontCheckoutSection;
  shipping?: StorefrontCheckoutShippingSection;
  billing?: StorefrontCheckoutSection;
  payment?: StorefrontCheckoutSection;
};

export type StorefrontCheckoutWarning = {
  code?: string;
  message: string;
  section?: string;
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
