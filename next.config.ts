import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Шаблон Excel нужен в serverless-бандле для /api/admin/export-excel
  outputFileTracingIncludes: {
    "/api/admin/export-excel": ["./templates/Smeta_23.xlsx"],
  },
};

export default nextConfig;
