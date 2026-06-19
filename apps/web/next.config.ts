import type { NextConfig } from "next";

const apiProxyTarget = (
  process.env.SEEKDESK_API_PROXY_URL ??
  process.env.NEXT_PUBLIC_SEEKDESK_API_URL ??
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
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
