import { proxyConsentDecision } from "../../../../../../src/modules/storefront/storefront-consent-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyConsentDecision(request);
}
