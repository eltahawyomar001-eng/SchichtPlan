/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**", "src/app/api/**"],
      // Exclude: generated client code, notification templates (HTML strings),
      // service-worker offline layer, client-only hooks, and third-party
      // integration adapters — these are hard to unit-test in isolation.
      exclude: [
        "src/lib/offline/**",
        "src/lib/hooks/**",
        "src/lib/integrations/**",
        "src/lib/notifications/**",
        "src/**/__mocks__/**",
      ],
      thresholds: {
        // Ratchet floor (2026-06-07): set just below the actual measured
        // coverage so it can ONLY go up — any PR that drops coverage fails CI.
        // Actual at set time: stmts 36.74 / branch 30.84 / funcs 31.32 / lines 37.6.
        // Raise toward the 75% enterprise target as tests are added; never lower.
        lines: 37,
        functions: 31,
        branches: 30,
        statements: 36,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
