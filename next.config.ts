import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
  "https://challenges.cloudflare.com",
].join(" ");

const nextConfig: NextConfig = {
  // La UI se sirve localmente por `localhost`, pero las sesiones compartidas
  // de desarrollo pueden cargarla por `127.0.0.1`. Sin esta allowlist Next
  // bloquea HMR y puede impedir la hidratación de controles client-side.
  allowedDevOrigins: isDevelopment ? ["127.0.0.1"] : undefined,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; media-src 'self' blob:; worker-src 'self' blob:` },
          { key: "Permissions-Policy", value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // 10 MiB de fichero + una envoltura multipart acotada; BFF conserva el
      // límite definitivo de 10 MiB para el binario.
      bodySizeLimit: 10 * 1024 * 1024 + 64 * 1024,
    },
  },
};

export default nextConfig;
