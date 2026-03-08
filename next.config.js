/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["duckdb", "duckdb-async"],
  },
};

module.exports = nextConfig;
