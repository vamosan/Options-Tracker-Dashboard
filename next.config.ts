import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sqlite3'],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      // Prevent HMR (Fast Refresh) infinite loops caused by writing to the local data/ JSON files
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/data/**'],
      };
    }
    return config;
  },
};

export default nextConfig;
