import { redirect } from "next/navigation";
import { AdminShell } from "../../../src/app-shell/admin-shell";
import { AdminSessionRefresher } from "../../../src/app-shell/admin-session-refresher";
import { AdminSessionGuardian } from "../../../src/app-shell/admin-session-guardian";
import { runWithAdminRequestSession } from "../../../src/shared/auth/admin-request-session";
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

  if (session.credentialState === "MUST_CHANGE_PASSWORD") {
    redirect("/admin/password");
  }

  return runWithAdminRequestSession(session, async () => {
    const context = await getAdminContext();
    const directory = await getOrganizationShopDirectory();

    return (
      <>
        <AdminSessionRefresher
          expiresAt={session.expiresAt}
          sessionId={session.sessionId}
        />
        {session.sessionId ? (
          <AdminSessionGuardian
            employeeId={session.employeeId}
            sessionId={session.sessionId}
          />
        ) : null}
        <AdminShell context={context} directory={directory} session={session}>
          {children}
        </AdminShell>
      </>
    );
  });
}
