/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@emp/config", "@emp/core", "@emp/db"],
  webpack: (config, { webpack }) => {
    // Workspace packages use explicit .js import extensions (Node ESM
    // convention, needed so tsx/vitest can run their TS source directly).
    // webpack's resolver doesn't map those to .ts files on its own.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    // RainbowKit's default wallet list pulls in wagmi's Coinbase
    // `baseAccount` connector, which imports @coinbase/cdp-sdk's x402
    // payment-protocol support — optional subpaths (@x402/evm, @x402/core,
    // ...) that aren't installed and aren't used by anything EMP does
    // (wallet connect + SIWE signing only). Ignoring them is an upstream
    // packaging gap in that dependency chain, not something in this repo.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};

module.exports = nextConfig;
