import type { AdminContext } from "../../shared/config/admin-context";

export type CustomersAdminDrawer = "create" | "detail";
export type CustomersAdminAddressMode = "create" | "edit";

export type CustomersAdminFilters = {
  q?: string;
  email?: string;
  limit?: string;
  offset?: string;
  drawer?: CustomersAdminDrawer;
  customerId?: string;
  addressMode?: CustomersAdminAddressMode;
  addressId?: string;
  purchasesLimit?: string;
  purchasesOffset?: string;
  activitySource?: string;
  customerMessage?: string;
};

export type CustomersAdminResult<T> = {
  source: "bff" | "unavailable";
  data: T;
  message?: string;
  failedEndpoint?: string;
  status?: number;
  permission?: CustomersAdminPermission;
};

export type CustomersAdminPermission =
  | "customers.read"
  | "customers.export"
  | "customers.account.write"
  | "customers.addresses.write"
  | "customers.purchases.read"
  | "customers.notes.write"
  | "customers.tags.write"
  | "customers.tasks.write"
  | "customers.privacy.write"
  | "customers.consents.write"
  | "customers.sessions.write"
  | "customers.communications.write";

export type CustomersAdminCapabilities = {
  canReadCustomers: boolean;
  canWriteCustomers: boolean;
  canReadPurchases: boolean;
  canExportCustomers: boolean;
  canManageAccount: boolean;
  canWriteNotes: boolean;
  canWriteTags: boolean;
  canWriteTasks: boolean;
  canWritePrivacy: boolean;
  canWriteConsents: boolean;
  canWriteSessions: boolean;
  canWriteCommunications: boolean;
};

export type CustomerAddress = {
  addressId: string;
  addressType?: string;
  addressName?: string;
  receiverName?: string;
  addressRole?: "SHIPPING" | "BILLING" | "BOTH" | string;
  street?: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string | null;
  reference?: string | null;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerProfile = {
  customerId: string;
  customerReference?: string;
  organizationId: string;
  shopId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarId?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  buyerType?: string;
  clientPreferencesData?: {
    locale?: string;
    optinNewsLetter?: boolean;
  };
  defaultShippingAddress?: CustomerAddress | null;
  defaultBillingAddress?: CustomerAddress | null;
  isGuest?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerPurchaseItem = {
  lineId?: string;
  productId?: string;
  variantId?: string;
  productSlug?: string;
  productUrlPath?: string;
  name?: string;
  imageUrl?: string | null;
  quantity?: number;
  unitPriceMinor?: number;
  lineTotalMinor?: number;
};

export type CustomerPurchase = {
  purchaseId: string;
  orderId?: string;
  customerId: string;
  status?: string;
  isPaid?: boolean;
  currency?: string;
  totalAmountMinor?: number;
  itemsCount?: number;
  items?: CustomerPurchaseItem[];
  placedAt?: string;
  recordedAt?: string;
};

export type CustomersListData = {
  items: CustomerProfile[];
  total: number;
  limit: number;
  offset: number;
};

export type CustomerAddressesData = {
  customerId: string;
  defaultShippingAddressId?: string | null;
  defaultBillingAddressId?: string | null;
  items: CustomerAddress[];
};

export type CustomerPurchasesData = {
  customerId: string;
  total: number;
  limit: number;
  offset: number;
  items: CustomerPurchase[];
};

export type CustomerAccountSummary = {
  principalId: string;
  principalType?: string;
  email: string;
  active?: boolean;
  status?:
    | "ACTIVE"
    | "PENDING_ACTIVATION"
    | "EMAIL_DELIVERY_FAILED"
    | "ACTIVATION_EXPIRED"
    | "BLOCKED";
  activation?: {
    tokenStatus?: "PENDING" | "USED" | "EXPIRED" | string;
    createdAt?: string;
    expiresAt?: string;
    usedAt?: string | null;
    isExpired?: boolean;
    emailDeliveryStatus?: "PENDING" | "SENT" | "FAILED" | string | null;
    lastEmailDeliveryId?: string | null;
    lastEmailError?: string | null;
    lastEmailAttemptAt?: string | null;
    reminderCount?: number;
    deletionWarningSentAt?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerDuplicateCandidate = {
  customer: CustomerProfile;
  matchFields: string[];
};

export type CustomerDuplicateCandidatesData = {
  customerId: string;
  total: number;
  limit: number;
  items: CustomerDuplicateCandidate[];
};

export type CustomerOverviewList<T> = {
  customerId?: string;
  total: number;
  limit?: number;
  offset?: number;
  items: T[];
};

export type CustomerAdminNote = {
  noteId: string;
  authorEmail?: string;
  body?: string;
  visibility?: string;
  createdAt?: string;
};

export type CustomerAdminTag = {
  tagKey: string;
  label?: string;
  color?: string;
};

export type CustomerAdminTask = {
  taskId: string;
  title?: string;
  status?: string;
  assignedEmployeeId?: string | null;
  dueAt?: string | null;
  createdAt?: string;
};

export type CustomerPrivacyRequest = {
  requestId: string;
  requestType?: string;
  status?: string;
  requesterEmail?: string | null;
  reason?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
};

export type CustomerConsentSnapshot = {
  current?: {
    marketingEmail?: {
      granted?: boolean;
      source?: string;
      recordedAt?: string;
    };
  };
  events?: CustomerOverviewList<{
    eventId: string;
    consentType?: string;
    granted?: boolean;
    source?: string;
    actorEmail?: string | null;
    recordedAt?: string;
  }>;
};

export type CustomerSessionItem = {
  sessionId: string;
  createdAt?: string;
  lastSeenAt?: string;
  device?: {
    deviceName?: string;
    ipAddress?: string;
  };
};

export type CustomerInvoiceItem = {
  invoiceId: string;
  invoiceNumber?: string;
  status?: string;
  currency?: string;
  totalAmountMinor?: number;
  issuedAt?: string;
};

export type CustomerAfterSalesItem = {
  caseId: string;
  orderId?: string;
  caseType?: string;
  status?: string;
  assignedEmployeeId?: string | null;
  createdAt?: string;
};

export type CustomerCommunicationItem = {
  deliveryId: string;
  templateKey?: string;
  status?: string;
  channel?: string;
  createdAt?: string;
};

export type CustomerTimelineItem = {
  type: string;
  status?: string;
  referenceId?: string;
  occurredAt?: string;
  source?: string;
};

export type CustomerAdminTimelineEvent = {
  eventId: string;
  eventType: string;
  label: string;
  status?: string;
  actor?: string | null;
  referenceId?: string;
  occurredAt?: string | null;
  source:
    | "customer"
    | "account"
    | "purchase"
    | "invoice"
    | "after-sales"
    | "communication"
    | "note"
    | "task"
    | "privacy"
    | "consent"
    | "session"
    | "overview"
    | "composition";
  detail?: string;
};

export type CustomerOverviewWarning = {
  section: string;
  message?: string;
};

export type CustomerOverviewData = {
  customer: CustomerProfile | null;
  account: CustomerAccountSummary | null;
  addresses: CustomerAddressesData | null;
  purchases: CustomerPurchasesData | null;
  duplicateCandidates: CustomerDuplicateCandidatesData;
  notes: CustomerOverviewList<CustomerAdminNote>;
  tags: CustomerOverviewList<CustomerAdminTag>;
  tasks: CustomerOverviewList<CustomerAdminTask>;
  privacyRequests: CustomerOverviewList<CustomerPrivacyRequest>;
  consents: CustomerConsentSnapshot | null;
  sessions: CustomerOverviewList<CustomerSessionItem> | null;
  invoices: CustomerOverviewList<CustomerInvoiceItem>;
  afterSales: CustomerOverviewList<CustomerAfterSalesItem>;
  communications: CustomerOverviewList<CustomerCommunicationItem>;
  timeline: CustomerOverviewList<CustomerTimelineItem>;
  warnings: CustomerOverviewWarning[];
  generatedAt?: string;
};

export type CustomersAdminData = {
  context: AdminContext;
  list: CustomersAdminResult<CustomersListData>;
  selectedCustomer: CustomersAdminResult<CustomerProfile | null>;
  addresses: CustomersAdminResult<CustomerAddressesData | null>;
  purchases: CustomersAdminResult<CustomerPurchasesData | null>;
  overview: CustomersAdminResult<CustomerOverviewData | null>;
};
