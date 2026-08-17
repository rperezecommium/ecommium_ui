import { requestAdminBff } from "../../shared/bff/admin-client";

type AdminPasswordRecoveryAvailability = {
  available: boolean;
};

/**
 * La UI solo interpreta una capacidad booleana y falla cerrada. No consulta ni
 * infiere si existe una cuenta, una plantilla o un correo entregado.
 */
export async function getAdminPasswordRecoveryAvailability(): Promise<boolean> {
  const result = await requestAdminBff<AdminPasswordRecoveryAvailability>(
    "/admin/auth/password-recovery/availability",
    {
      withAuth: false,
      init: { cache: "no-store" },
    },
  );

  return result.ok && result.data.available === true;
}
