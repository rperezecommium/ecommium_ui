import { proxyConsentPolicy } from "../../../../../../src/modules/storefront/storefront-consent-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyConsentPolicy(request);
}
