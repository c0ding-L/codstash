import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Dev only: lets the app run through a Cloudflare quick tunnel (Bictorys sandbox
// tests need a public https URL). Never applied to production builds.
const tunnelHosts = process.env.NODE_ENV === "development" ? ["*.trycloudflare.com"] : [];

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
  allowedDevOrigins: tunnelHosts,
  experimental: {
    serverActions: {
      allowedOrigins: tunnelHosts,
    },
  },
};

// Picks up `src/i18n/request.ts`, the per-request locale and messages.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
