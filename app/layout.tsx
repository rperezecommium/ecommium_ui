import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_ECOMMIUM_PUBLIC_BASE_URL ?? "http://localhost:5173",
  ),
  title: "Ecommium UI",
  description: "Operational ecommerce dashboard built with Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
