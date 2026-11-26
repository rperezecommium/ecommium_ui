import { connection } from "next/server";
import type { Metadata } from "next";
import "./globals.css";

import { PublicRuntimeProvider } from "../src/shared/config/public-runtime";
import { getStorefrontSignupHumanVerificationConfig } from "../src/modules/storefront/storefront-human-verification";
export async function generateMetadata(): Promise<Metadata> { await connection(); return {
  metadataBase: new URL(
    process.env.ECOMMIUM_UI_STOREFRONT_ORIGIN ?? process.env.NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL ?? "http://localhost:5173",
  ),
  title: "Ecommium UI",
  description: "Operational ecommerce dashboard built with Next.js.",
}; }

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const { mode, turnstileSiteKey } = getStorefrontSignupHumanVerificationConfig();
  return (
    <html lang="es">
      <body><PublicRuntimeProvider value={{ mode, turnstileSiteKey }}>{children}</PublicRuntimeProvider></body>
    </html>
  );
}
