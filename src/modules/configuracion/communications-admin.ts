import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";
import type { BffResult } from "../../shared/bff/types";

export type CommunicationsProvider = "stub" | "smtp" | "sendgrid" | "resend";
export type CommunicationsTemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

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

export type CommunicationsHealth = {
  status: "ok";
  service: "communications";
  channels: {
    email: {
      status: "enabled" | "disabled";
      provider: string;
      fromConfigured: boolean;
      apiKeyConfigured: boolean;
    };
  };
};

export type EmailTemplateRecord = {
  templateId: string;
  templateKey: string;
  channel: "EMAIL";
  locale: string;
  subjectTemplate: string | null;
  htmlTemplate: string | null;
  textTemplate: string | null;
  status: CommunicationsTemplateStatus;
  requiredVariables: string[];
  previewData: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  archivedAt: string | null;
};

export type EmailTemplateWritePayload = {
  templateKey?: string;
  locale?: string;
  subjectTemplate?: string | null;
  htmlTemplate?: string | null;
  textTemplate?: string | null;
  requiredVariables?: string[];
  previewData?: Record<string, unknown>;
};

export type EmailTemplatePreview = {
  templateId: string;
  templateKey: string;
  locale: string;
  status: CommunicationsTemplateStatus;
  rendered: {
    subject: string;
    html: string;
    text: string;
  };
  usedVariables: string[];
  readiness: {
    scope: "ACCOUNT" | "TRANSACTIONAL" | "GENERIC";
    activationEligible: boolean;
    previewStatus: "READY" | "DEGRADED" | "BLOCKED";
    variables: Array<{
      name: string;
      status: "RESOLVED" | "MISSING" | "INVALID";
      declared: boolean;
      used: boolean;
      critical: boolean;
    }>;
    issues: Array<{
      code: string;
      message: string;
      variable?: string;
    }>;
  };
};

export type EmailTemplateImageUpload = {
  mediaCollectionId: string;
  mediaAssetId: string;
  url: string;
  alt: string;
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
  health: BffResult<CommunicationsHealth>;
  settings: BffResult<EmailProviderSettings>;
  authTemplates: BffResult<EmailTemplateList>;
  deliveries: BffResult<EmailDeliveryList>;
  selectedDelivery?: BffResult<EmailDeliveryRecord>;
};

export type CommunicationsAdminFilters = {
  drawer?: "provider" | "delivery" | "template";
  status?: CommunicationsTemplateStatus;
  templateId?: string;
  templatesLimit?: string;
  templatesOffset?: string;
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

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function collectionIdFrom(value: unknown) {
  const root = recordOf(value);
  const collection = recordOf(root.collection ?? root.data ?? value);
  return nonEmptyString(collection.mediaCollectionId) ?? nonEmptyString(collection.collectionId);
}

function collectionItems(value: unknown) {
  const root = recordOf(value);
  const collection = recordOf(root.collection ?? root.data ?? value);
  return Array.isArray(collection.items) ? collection.items : [];
}

function imageFromMediaItem(
  value: unknown,
  mediaCollectionId: string,
  fallbackAlt: string,
): EmailTemplateImageUpload | null {
  const record = recordOf(value);
  const mediaAssetId = nonEmptyString(record.idImage) ?? nonEmptyString(record.mediaAssetId) ?? nonEmptyString(record.assetId);
  const url = nonEmptyString(record.public) ?? nonEmptyString(record.publicUrl);
  if (!mediaAssetId || !url || !/^https?:\/\//i.test(url)) {
    return null;
  }

  return {
    mediaCollectionId,
    mediaAssetId,
    url,
    alt: nonEmptyString(record.originalFileName) ?? nonEmptyString(record.fileName) ?? fallbackAlt,
  };
}

function imagesFromCollection(value: unknown, fallbackAlt: string) {
  const mediaCollectionId = collectionIdFrom(value);
  if (!mediaCollectionId) {
    return [];
  }

  return collectionItems(value)
    .map((item) => imageFromMediaItem(item, mediaCollectionId, fallbackAlt))
    .filter((item): item is EmailTemplateImageUpload => Boolean(item));
}

function collectionList(value: unknown) {
  const root = recordOf(value);
  return Array.isArray(root.items) ? root.items : [];
}

export async function uploadEmailTemplateImage(
  context: AdminContext,
  input: {
    templateId: string;
    templateKey: string;
    locale: string;
    file: File;
  },
): Promise<BffResult<EmailTemplateImageUpload>> {
  const list = await requestAdminBff<unknown>(
    scopedPath("/admin/media/collections", context, {
      productId: input.templateId,
      limit: "1",
    }),
    { context },
  );
  if (!list.ok) {
    return list;
  }

  const existingCollectionId = collectionIdFrom(collectionList(list.data)[0]);
  const formData = new FormData();
  formData.append("files", input.file);
  formData.set("organizationId", context.organizationId);
  formData.set("shopId", context.shopId);
  formData.set("defaultLocale", input.locale);
  formData.set("metadata", JSON.stringify([{ alt: { [input.locale]: input.file.name } }]));

  const response = existingCollectionId
    ? await requestAdminBff<unknown>(
      scopedPath(`/admin/media/collections/${encodeURIComponent(existingCollectionId)}/items`, context),
      { context, init: { method: "POST", body: formData } },
    )
    : await requestAdminBff<unknown>(
      scopedPath("/admin/media/collections", context),
      {
        context,
        init: {
          method: "POST",
          body: (() => {
            formData.set("productId", input.templateId);
            formData.set("title", `Email template ${input.templateKey}`);
            return formData;
          })(),
        },
      },
    );

  if (!response.ok) {
    return response;
  }

  const uploaded = imagesFromCollection(response.data, input.file.name).at(-1);
  if (!uploaded) {
    return {
      ok: false,
      status: 502,
      correlationId: response.correlationId,
      error: "Media no devolvió una URL pública HTTP para la imagen.",
    };
  }

  return {
    ok: true,
    status: response.status,
    correlationId: response.correlationId,
    data: uploaded,
  };
}

export async function listEmailTemplateImages(
  context: AdminContext,
  templateId: string,
): Promise<BffResult<EmailTemplateImageUpload[]>> {
  const result = await requestAdminBff<unknown>(
    scopedPath("/admin/media/collections", context, {
      productId: templateId,
      limit: "1",
    }),
    { context },
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    status: result.status,
    correlationId: result.correlationId,
    data: imagesFromCollection(collectionList(result.data)[0], "Imagen de plantilla"),
  };
}

export async function hardDeleteEmailTemplateImage(
  context: AdminContext,
  input: Pick<EmailTemplateImageUpload, "mediaCollectionId" | "mediaAssetId">,
): Promise<BffResult<{ deleted?: boolean }>> {
  return requestAdminBff(
    scopedPath(
      `/admin/media/collections/${encodeURIComponent(input.mediaCollectionId)}/items/${encodeURIComponent(input.mediaAssetId)}`,
      context,
      { mode: "hard" },
    ),
    {
      context,
      init: { method: "DELETE" },
      parse: (value) => recordOf(value) as { deleted?: boolean },
    },
  );
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
      health: skipped,
      settings: skipped,
      authTemplates: skipped,
      deliveries: skipped,
      selectedDelivery: filters.drawer === "delivery" ? skipped : undefined,
    };
  }

  const selectedDelivery = filters.drawer === "delivery" && filters.deliveryId
    ? getEmailDelivery(context, filters.deliveryId)
    : Promise.resolve(undefined);
  const [health, settings, authTemplates, deliveries, selectedDeliveryResult] = await Promise.all([
    requestAdminBff<CommunicationsHealth>("/admin/communications/health", { context }),
    requestAdminBff<EmailProviderSettings>(
      scopedPath("/admin/communications/settings/email-provider", context),
      { context },
    ),
    requestAdminBff<EmailTemplateList>(
      scopedPath("/admin/communications/templates/email", context, {
        locale: context.locale,
        limit: filters.templatesLimit ?? "50",
        offset: filters.templatesOffset ?? "0",
        status: filters.status,
      }),
      { context },
    ),
    listEmailDeliveries(context, filters),
    selectedDelivery,
  ]);

  return {
    health,
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
  return requestAdminBff<EmailDeliveryList>(
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
  return requestAdminBff<EmailDeliveryRecord>(
    scopedPath(`/admin/communications/deliveries/${encodeURIComponent(deliveryId)}`, context),
    { context },
  );
}

export async function retryEmailDelivery(context: AdminContext, deliveryId: string) {
  return requestAdminBff<EmailDeliveryRecord>(
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

export async function createEmailTemplate(
  context: AdminContext,
  payload: Required<Pick<EmailTemplateWritePayload, "templateKey" | "locale">> & EmailTemplateWritePayload,
) {
  return requestAdminBff<EmailTemplateRecord>(
    scopedPath("/admin/communications/templates/email", context),
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

export async function patchEmailTemplate(
  context: AdminContext,
  templateId: string,
  payload: EmailTemplateWritePayload,
) {
  return requestAdminBff<EmailTemplateRecord>(
    scopedPath(`/admin/communications/templates/email/${encodeURIComponent(templateId)}`, context),
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

export async function previewEmailTemplate(
  context: AdminContext,
  templateId: string,
  data?: Record<string, unknown>,
) {
  return requestAdminBff<EmailTemplatePreview>(
    scopedPath(`/admin/communications/templates/email/${encodeURIComponent(templateId)}/preview`, context),
    {
      context,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data ? { data } : {}),
      },
    },
  );
}

export async function testSendEmailTemplate(
  context: AdminContext,
  templateId: string,
  payload: {
    recipientEmail: string;
    data?: Record<string, unknown>;
  },
) {
  return requestAdminBff<EmailDeliveryRecord>(
    scopedPath(`/admin/communications/templates/email/${encodeURIComponent(templateId)}/test-send`, context),
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

export async function transitionEmailTemplate(
  context: AdminContext,
  templateId: string,
  transition: "activate" | "deactivate" | "archive",
) {
  return requestAdminBff<EmailTemplateRecord>(
    scopedPath(`/admin/communications/templates/email/${encodeURIComponent(templateId)}/${transition}`, context),
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
  return requestAdminBff<EmailProviderSettings>(
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
  return requestAdminBff<{ locale: string; created: number; updated: number; existing: number }>(
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
  return requestAdminBff<EmailDeliveryRecord>(
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
