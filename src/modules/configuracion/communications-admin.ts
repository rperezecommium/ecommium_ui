import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { requestBff } from "../../shared/bff/client";
import type { BffResult } from "../../shared/bff/types";

export type CommunicationsProvider = "stub" | "smtp" | "sendgrid" | "resend";
export type CommunicationsTemplateStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type EmailProviderSettings = {
  organizationId: string;
  shopId: string;
  provider: CommunicationsProvider;
  active: boolean;
  fromEmail: string | null;
  replyToEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  secretConfigured: boolean;
  secretUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailTemplateRecord = {
  templateId: string;
  templateKey: string;
  locale: string;
  subjectTemplate: string | null;
  status: CommunicationsTemplateStatus;
  requiredVariables: string[];
  version: number;
  updatedAt: string;
  activatedAt: string | null;
};

export type EmailTemplateList = {
  items: EmailTemplateRecord[];
  total: number;
  limit: number;
  offset: number;
};

export type EmailDeliveryStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED" | "RETRYING";

export type EmailDeliveryRecipient = {
  email?: string | null;
  phone?: string | null;
  customerId?: string | null;
  externalUserId?: string | null;
};

export type EmailDeliveryAttachment = {
  type: "url";
  name: string;
  url: string;
};

export type EmailDeliveryAttempt = {
  attemptId: string;
  provider: string;
  status: "SENT" | "FAILED";
  providerMessageId?: string | null;
  errorMessage?: string | null;
  occurredAt: string;
};

export type EmailRenderedSnapshot = {
  subject?: string | null;
  html?: string | null;
  text?: string | null;
};

export type EmailDeliveryRecord = {
  deliveryId: string;
  organizationId: string;
  shopId: string;
  templateKey: string;
  templateId: string | null;
  channel: "EMAIL";
  locale: string;
  recipient: EmailDeliveryRecipient;
  data: Record<string, unknown>;
  attachments: EmailDeliveryAttachment[];
  idempotencyKey: string;
  sourceEventId: string | null;
  renderedSnapshot: EmailRenderedSnapshot | null;
  status: EmailDeliveryStatus;
  attempts: EmailDeliveryAttempt[];
  errorMessage: string | null;
  sentAt: string | null;
  failedAt: string | null;
  skippedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailDeliveryList = {
  items: EmailDeliveryRecord[];
  total: number;
  limit: number;
  offset: number;
};

export type CommunicationsAdminData = {
  settings: BffResult<EmailProviderSettings>;
  authTemplates: BffResult<EmailTemplateList>;
  deliveries: BffResult<EmailDeliveryList>;
  selectedDelivery?: BffResult<EmailDeliveryRecord>;
};

export type CommunicationsAdminFilters = {
  drawer?: "provider" | "delivery";
  status?: CommunicationsTemplateStatus;
  deliveryId?: string;
  deliveryStatus?: EmailDeliveryStatus;
  deliveryTemplateKey?: string;
  deliverySourceEventId?: string;
  deliveryCustomerId?: string;
  deliveriesLimit?: string;
  deliveriesOffset?: string;
  notice?: string;
};

export type EmailDeliveryAuditFilters = Pick<
  CommunicationsAdminFilters,
  "deliveryStatus" | "deliveryTemplateKey" | "deliverySourceEventId" | "deliveryCustomerId" | "deliveriesLimit" | "deliveriesOffset"
>;

function scopedPath(path: string, context: AdminContext, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
  });

  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return `${path}?${params.toString()}`;
}

export async function getCommunicationsAdminData(
  context: AdminContext,
  filters: CommunicationsAdminFilters = {},
): Promise<CommunicationsAdminData> {
  if (!hasRequiredAdminContext(context)) {
    const skipped = {
      ok: false as const,
      status: 428,
      error: "Define organizationId y shopId para configurar comunicaciones.",
      correlationId: "communications-context-missing",
    };

    return {
      settings: skipped,
      authTemplates: skipped,
      deliveries: skipped,
      selectedDelivery: filters.drawer === "delivery" ? skipped : undefined,
    };
  }

  const selectedDelivery = filters.drawer === "delivery" && filters.deliveryId
    ? getEmailDelivery(context, filters.deliveryId)
    : Promise.resolve(undefined);
  const [settings, authTemplates, deliveries, selectedDeliveryResult] = await Promise.all([
    requestBff<EmailProviderSettings>(
      scopedPath("/admin/communications/settings/email-provider", context),
      { context },
    ),
    requestBff<EmailTemplateList>(
      scopedPath("/admin/communications/templates/email", context, {
        locale: context.locale,
        limit: "20",
        offset: "0",
        status: filters.status,
      }),
      { context },
    ),
    listEmailDeliveries(context, filters),
    selectedDelivery,
  ]);

  return {
    settings,
    authTemplates,
    deliveries,
    selectedDelivery: selectedDeliveryResult,
  };
}

export async function listEmailDeliveries(
  context: AdminContext,
  filters: EmailDeliveryAuditFilters = {},
) {
  return requestBff<EmailDeliveryList>(
    scopedPath("/admin/communications/deliveries", context, {
      status: filters.deliveryStatus,
      templateKey: filters.deliveryTemplateKey,
      sourceEventId: filters.deliverySourceEventId,
      customerId: filters.deliveryCustomerId,
      limit: filters.deliveriesLimit ?? "20",
      offset: filters.deliveriesOffset ?? "0",
    }),
    { context },
  );
}

export async function getEmailDelivery(context: AdminContext, deliveryId: string) {
  return requestBff<EmailDeliveryRecord>(
    scopedPath(`/admin/communications/deliveries/${encodeURIComponent(deliveryId)}`, context),
    { context },
  );
}

export async function retryEmailDelivery(context: AdminContext, deliveryId: string) {
  return requestBff<EmailDeliveryRecord>(
    scopedPath(`/admin/communications/deliveries/${encodeURIComponent(deliveryId)}/retry`, context),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    },
  );
}

export async function patchEmailProviderSettings(
  context: AdminContext,
  payload: Record<string, unknown>,
) {
  return requestBff<EmailProviderSettings>(
    scopedPath("/admin/communications/settings/email-provider", context),
    {
      context,
      init: {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );
}

export async function bootstrapAuthEmailTemplates(
  context: AdminContext,
  payload: { locale: string; overwrite: boolean },
) {
  return requestBff<{ locale: string; created: number; updated: number; existing: number }>(
    scopedPath("/admin/communications/templates/email/auth-defaults", context),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );
}

export async function sendCommunicationsTestEmail(
  context: AdminContext,
  payload: {
    templateKey: string;
    locale: string;
    recipient: { email: string };
    data: Record<string, unknown>;
    idempotencyKey: string;
    sourceEventId: string;
  },
) {
  return requestBff<EmailDeliveryRecord>(
    scopedPath("/admin/communications/email/send", context),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    },
  );
}
