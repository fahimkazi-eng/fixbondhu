import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The domain packages ship raw TypeScript, so Next compiles them as part of
  // the app rather than requiring a build step for each.
  transpilePackages: ["@fixbondhu/core", "@fixbondhu/db"],

  // Prisma 7 generates a TypeScript client plus the Neon HTTP driver. Bundler
  // tracing cannot see the dynamic requires inside them, so the paths are
  // declared explicitly. Without this, serverless builds omit the driver and
  // the failure only appears at runtime in production.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@prisma/adapter-neon/**",
      "./node_modules/@neondatabase/serverless/**",
      "./packages/db/src/generated/**",
    ],
  },

  poweredByHeader: false,
  reactStrictMode: true,

  // Bangladesh mobile networks are frequently lossy. Compression is not
  // optional here.
  compress: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
