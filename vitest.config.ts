import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/mcp/server.ts"],
      // Baseline thresholds reflect 2026-05-08 measurement: statements/lines/functions
      // are near 100% on tested modules; branches lag because raw/* builders include
      // optional fallback branches (live-fetch path) that are exercised only in
      // production. Raise as new tests are added; failing thresholds blocks `npm run test:coverage`.
      thresholds: {
        statements: 90,
        branches: 60,
        functions: 95,
        lines: 90,
      },
    },
  },
});
