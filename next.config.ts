import type { NextConfig } from "next";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  ...(!isVercelBuild ? {
    output: "standalone" as const,
    outputFileTracingExcludes: {
      "/*": [
        "./.env",
        "./.env.*",
        "./storage/uploads/**/*",
        "./src/**/*",
        "./scripts/**/*",
        "./docker-compose*.yml",
        "./package-lock.json",
      ],
    },
  } : {}),
  async redirects() {
    return [
      {
        source: "/",
        destination: "/sign-in",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
