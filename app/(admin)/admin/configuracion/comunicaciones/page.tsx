import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { CommunicationsAdminPage } from "../../../../../src/modules/configuracion/communications-admin-page";
import {
  getCommunicationsAdminData,
  type CommunicationsAdminFilters,
  type EmailDeliveryStatus,
  type CommunicationsTemplateStatus,
} from "../../../../../src/modules/configuracion/communications-admin";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ComunicacionesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const context = await getAdminContext();
  const filters: CommunicationsAdminFilters = {
    drawer: normalizeDrawer(first(query?.drawer)),
    notice: first(query?.notice),
    status: normalizeStatus(first(query?.status)),
    templateId: normalizeFilterValue(first(query?.templateId)),
    templatesLimit: normalizeLimit(first(query?.templatesLimit)),
    templatesOffset: normalizeOffset(first(query?.templatesOffset)),
    deliveryId: normalizeFilterValue(first(query?.deliveryId)),
    deliveryStatus: normalizeDeliveryStatus(first(query?.deliveryStatus)),
    deliveryTemplateKey: normalizeFilterValue(first(query?.deliveryTemplateKey)),
    deliverySourceEventId: normalizeFilterValue(first(query?.deliverySourceEventId)),
    deliveryCustomerId: normalizeFilterValue(first(query?.deliveryCustomerId)),
    deliveriesLimit: normalizeLimit(first(query?.deliveriesLimit)),
    deliveriesOffset: normalizeOffset(first(query?.deliveriesOffset)),
  };
  const data = await getCommunicationsAdminData(context, filters);

  return <CommunicationsAdminPage context={context} data={data} filters={filters} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): CommunicationsTemplateStatus | undefined {
  return value === "DRAFT" || value === "ACTIVE" || value === "ARCHIVED"
    ? value
    : undefined;
}

function normalizeDrawer(value: string | undefined): CommunicationsAdminFilters["drawer"] {
  return value === "provider" || value === "delivery" || value === "template" ? value : undefined;
}

function normalizeDeliveryStatus(value: string | undefined): EmailDeliveryStatus | undefined {
  return value === "PENDING" || value === "SENT" || value === "FAILED" || value === "SKIPPED" || value === "RETRYING"
    ? value
    : undefined;
}

function normalizeFilterValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length <= 200 ? normalized : undefined;
}

function normalizeLimit(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 100 ? String(parsed) : undefined;
}

function normalizeOffset(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : undefined;
}
