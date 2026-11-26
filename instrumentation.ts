import { adminOnlyOrigin } from "./src/shared/config/deployment-routing";
import { getStorefrontBffBaseUrl } from "./src/shared/config/storefront-env";

/** Valida la configuración antes de aceptar tráfico en un servidor de producción. */
export function register() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (adminOnlyOrigin()) return;
  getStorefrontBffBaseUrl();
}
