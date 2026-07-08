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

export type EmailDeliveryRecord = {
  deliveryId: string;
  organizationId: string;
  shopId: string;
  templateKey: string;
  templateId: string | null;
  channel: "EMAIL";
  locale: string;
  recipient: {
    email?: string | null;
    customerId?: string | null;
  };
  idempotencyKey: string;
  sourceEventId: string | null;
  status: EmailDeliveryStatus;
  errorMessage: string | null;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationsAdminData = {
  settings: BffResult<EmailProviderSettings>;
  authTemplates: BffResult<EmailTemplateList>;
};

export type CommunicationsAdminFilters = {
  drawer?: "provider";
  status?: CommunicationsTemplateStatus;
  notice?: string;
};

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
    };
  }

  const [settings, authTemplates] = await Promise.all([
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
  ]);

  return {
    settings,
    authTemplates,
  };
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
