/** @type {import('next').NextConfig} */
const nextConfig = {
  output: undefined,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["mariadb", "@prisma/adapter-mariadb", "bcryptjs"],
    serverActions: { bodySizeLimit: "4mb" },
  },
};
export default nextConfig;
