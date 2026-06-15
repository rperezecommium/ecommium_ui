import { getAdminContext } from "../../../src/shared/config/admin-context";
import { getAdminHealth } from "../../../src/modules/configuracion/health";
import { HealthDashboard } from "../../../src/modules/configuracion/health-dashboard";

export default async function AdminHome() {
  const context = await getAdminContext();
  const health = await getAdminHealth(context);

  return <HealthDashboard context={context} health={health} />;
}
