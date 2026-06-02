import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@seekdesk/shared", "@seekdesk/agent"]
};

export default nextConfig;
