import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/sign-in",
        permanent: false,
      },
    ];
  },
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
