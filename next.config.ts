import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
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
};

export default nextConfig;
