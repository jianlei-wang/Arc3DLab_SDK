import { defineConfig } from "vitest/config"
import { packageAliases } from "./scripts/package-aliases.mjs"

export default defineConfig({
  resolve: {
    alias: packageAliases(__dirname),
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/index.ts", "**/types.ts", "**/assets/**", "**/*.d.ts"],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 58,
        branches: 75,
        "packages/core/src/**": {
          lines: 91,
          statements: 91,
          functions: 90,
          branches: 88,
        },
        "packages/analysis/src/**": {
          lines: 82,
          statements: 82,
          functions: 83,
          branches: 78,
        },
        "packages/ui/src/**": {
          lines: 87,
          statements: 87,
          functions: 82,
          branches: 84,
        },
        "packages/scene/src/**": {
          lines: 64,
          statements: 64,
          functions: 39,
          branches: 90,
        },
        "packages/data/src/**": {
          lines: 72,
          statements: 72,
          functions: 90,
          branches: 35,
        },
        "packages/interaction/src/**": {
          lines: 67,
          statements: 67,
          functions: 52,
          branches: 82,
        },
        "packages/effects/src/**": {
          lines: 60,
          statements: 60,
          functions: 47,
          branches: 87,
        },
        "packages/sdk/src/**": {
          lines: 66,
          statements: 66,
          functions: 56,
          branches: 73,
        },
      },
    },
  },
})
