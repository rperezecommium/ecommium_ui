import { requestAdminBff } from "../../shared/bff/admin-client";
import type { AdminContext } from "../../shared/config/admin-context";
export type NewsletterPolicy = {
  policyVersionId: string;
  fingerprint: string;
  locale: string;
  text: string;
  privacyPath: string;
};
export function parseNewsletterPolicy(raw: unknown): NewsletterPolicy {
  const p = raw as NewsletterPolicy;
  if (
    !p ||
    typeof p.policyVersionId !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.fingerprint) ||
    typeof p.text !== "string" ||
    p.text.length > 2000 ||
    typeof p.locale !== "string" ||
    !/^[a-z]{2}-[A-Z]{2}$/.test(p.locale) ||
    p.privacyPath.startsWith("//") ||
    !/^\/[a-zA-Z0-9\/_-]+$/.test(p.privacyPath)
  )
    throw new Error("invalid newsletter policy");
  return {
    policyVersionId: p.policyVersionId,
    fingerprint: p.fingerprint,
    locale: p.locale,
    text: p.text,
    privacyPath: p.privacyPath,
  };
}
export function newsletterPolicyQuery(context: AdminContext) {
  return new URLSearchParams({
    organizationId: context.organizationId,
    shopId: context.shopId,
    locale: context.locale,
  });
}
export function readNewsletterPolicy(context: AdminContext) {
  return requestAdminBff(
    "/admin/consent/commercial/policy?" + newsletterPolicyQuery(context),
    { parse: parseNewsletterPolicy },
  );
}
