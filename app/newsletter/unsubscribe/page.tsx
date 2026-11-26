import { NewsletterTokenPage } from "../../../src/modules/storefront/newsletter-client";
export const metadata = {
  title: "Baja de newsletter",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <NewsletterTokenPage kind="unsubscriptions" />;
}
