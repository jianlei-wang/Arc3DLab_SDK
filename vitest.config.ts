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
      },
    },
  },
})
