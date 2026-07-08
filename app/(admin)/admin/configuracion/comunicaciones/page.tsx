import { getAdminContext } from "../../../../../src/shared/config/admin-context";
import { CommunicationsAdminPage } from "../../../../../src/modules/configuracion/communications-admin-page";
import {
  getCommunicationsAdminData,
  type CommunicationsAdminFilters,
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
  };
  const data = await getCommunicationsAdminData(context, filters);

  return <CommunicationsAdminPage context={context} data={data} filters={filters} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): CommunicationsTemplateStatus | undefined {
  return value === "DRAFT" || value === "ACTIVE" || value === "INACTIVE" || value === "ARCHIVED"
    ? value
    : undefined;
}

function normalizeDrawer(value: string | undefined): CommunicationsAdminFilters["drawer"] {
  return value === "provider" ? value : undefined;
}
