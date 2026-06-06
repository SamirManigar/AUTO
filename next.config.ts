import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
};

export default nextConfig;
