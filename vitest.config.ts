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
        // Current baseline (2026-06): enforced as a floor so we never regress.
        // Raise these numbers as new tests are added.
        lines: 20,
        functions: 15,
        branches: 17,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
