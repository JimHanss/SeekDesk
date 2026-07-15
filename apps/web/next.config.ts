import type { NextConfig } from "next";

const apiProxyTarget = (
  process.env.SEEKDESK_API_PROXY_URL ??
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ??
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

const allowedDevOrigins = [
  "127.0.0.1",
  "localhost",
  ...(process.env.SEEKDESK_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [...new Set(allowedDevOrigins)],
  transpilePackages: ["@seekdesk/shared", "@seekdesk/agent"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`
      },
      {
        source: "/health",
        destination: `${apiProxyTarget}/health`
      },
      {
        source: "/ws",
        destination: `${apiProxyTarget}/ws`
      }
    ];
  }
};

export default nextConfig;
