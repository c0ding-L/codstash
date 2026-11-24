import type { NextConfig } from "next";

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

export default nextConfig;
