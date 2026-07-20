import type { Metadata } from "next";
import { StorefrontPublicNotFound } from "../../../src/modules/storefront/public-page-view";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StorefrontNotFoundBoundaryPage() {
  return <StorefrontPublicNotFound />;
}
