import { getAdminContext } from "../../../../src/shared/config/admin-context";
import { refreshAdminEmployeeSession } from "../../../../src/modules/auth/admin-session-actions";
import { getAfterSalesAdminCapabilities, getAfterSalesAdminData } from "../../../../src/modules/postventa/after-sales-admin";
import { AfterSalesAdminPage } from "../../../../src/modules/postventa/after-sales-admin-page";
import type { AfterSalesAdminFilters } from "../../../../src/modules/postventa/after-sales-admin";

type PostventaPageProps = {
  searchParams?: Promise<AfterSalesAdminFilters>;
};

export default async function PostventaPage({ searchParams }: PostventaPageProps) {
  const [context, session, params] = await Promise.all([
    getAdminContext(),
    refreshAdminEmployeeSession(),
    searchParams,
  ]);
  const filters: AfterSalesAdminFilters = {
    caseId: params?.caseId,
    caseTab: params?.caseTab,
    caseFocus: params?.caseFocus,
    status: params?.status,
    customerId: params?.customerId,
    orderId: params?.orderId,
    assignedEmployeeId: params?.assignedEmployeeId,
    limit: params?.limit,
    offset: params?.offset,
    taskType: params?.taskType,
    taskStatus: params?.taskStatus,
    taskLimit: params?.taskLimit,
    taskOffset: params?.taskOffset,
    notice: params?.notice,
    noticeKind: params?.noticeKind === "error" ? "error" : undefined,
  };
  const capabilities = getAfterSalesAdminCapabilities(session);
  const data = await getAfterSalesAdminData(context, filters, capabilities);

  return <AfterSalesAdminPage capabilities={capabilities} data={data} filters={filters} />;
}
