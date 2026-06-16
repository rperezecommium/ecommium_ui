import { redirect } from "next/navigation";
import { AdminShell } from "../../../src/app-shell/admin-shell";
import { getAdminContext } from "../../../src/shared/config/admin-context";
import { refreshAdminEmployeeSession } from "../../../src/modules/auth/admin-session-actions";
import { getOrganizationShopDirectory } from "../../../src/modules/configuracion/organization-shop";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await refreshAdminEmployeeSession();

  if (!session) {
    redirect("/auth/login?next=/admin");
  }

  const context = await getAdminContext();
  const directory = await getOrganizationShopDirectory();

  return (
    <AdminShell context={context} directory={directory} session={session}>
      {children}
    </AdminShell>
  );
}
