/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@brutality/core"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
