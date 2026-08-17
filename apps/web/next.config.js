/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@emp/config", "@emp/core", "@emp/db"],
  webpack: (config) => {
    // Workspace packages use explicit .js import extensions (Node ESM
    // convention, needed so tsx/vitest can run their TS source directly).
    // webpack's resolver doesn't map those to .ts files on its own.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

module.exports = nextConfig;
