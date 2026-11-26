import {assessHealth,type ConfirmedHealthStatus} from "./health-assessment";
import type { AdminContext } from "../../shared/config/admin-context";
import { hasRequiredAdminContext } from "../../shared/config/admin-context";
import { requestAdminBff } from "../../shared/bff/admin-client";

export type ServiceHealthStatus = ConfirmedHealthStatus | "skipped";

export type ServiceHealth = {
  key: string;
  label: string;
  endpoint: string;
  status: ServiceHealthStatus;
  message: string;
  correlationId?: string;
};

export type AdminHealth = {
  generatedAt: string;
  services: ServiceHealth[];
};

const globalHealthEndpoints = [
  { key: "analytics", label: "Analytics", endpoint: "/admin/analytics/health" },
  { key: "automation", label: "Automation", endpoint: "/admin/automation/health" },
  { key: "communications", label: "Communications", endpoint: "/admin/communications/health" },
  { key: "after-sales", label: "After Sales", endpoint: "/admin/after-sales/health" },
];

const scopedHealthEndpoints = [
  { key: "search", label: "Search", endpoint: "/admin/search/health" },
];

function withContextQuery(endpoint: string, context: AdminContext) {
  const params = new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: context.locale,
  });

  return `${endpoint}?${params.toString()}`;
}

async function checkHealth(
  endpoint: { key: string; label: string; endpoint: string },
  context: AdminContext,
): Promise<ServiceHealth> {
  const path = endpoint.key === "search" ? withContextQuery(endpoint.endpoint, context) : endpoint.endpoint;
  const result = await requestAdminBff(path, {
    context,
    parse: assessHealth,
  });

  if (!result.ok) {
    return {
      ...endpoint,
      status: result.status===401||result.status===403||result.status===429 ? "unknown" : "unavailable",
      message: result.status===401||result.status===403 ? "Sin permiso para verificar la salud del servicio." : result.status===429 ? "Consulta limitada; estado del servicio sin confirmar." : result.error,
      correlationId: result.correlationId,
    };
  }

  return {
    ...endpoint,
    status: result.data.status,
    message: result.data.message,
    correlationId: result.correlationId,
  };
}

export async function getAdminHealth(context: AdminContext): Promise<AdminHealth> {
  const scopedChecks = hasRequiredAdminContext(context)
    ? scopedHealthEndpoints.map((endpoint) => checkHealth(endpoint, context))
    : scopedHealthEndpoints.map<Promise<ServiceHealth>>(async (endpoint) => ({
        ...endpoint,
        status: "skipped",
        message: "Define organizationId y shopId para consultar este health",
      }));

  const services = await Promise.all([
    ...globalHealthEndpoints.map((endpoint) => checkHealth(endpoint, context)),
    ...scopedChecks,
  ]);

  return {
    generatedAt: new Date().toISOString(),
    services,
  };
}
