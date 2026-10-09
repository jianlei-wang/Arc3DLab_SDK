import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@arc3dlab/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@arc3dlab/engine-cesium": resolve(__dirname, "packages/engine-cesium/src/index.ts"),
      "@arc3dlab/data": resolve(__dirname, "packages/data/src/index.ts"),
      "@arc3dlab/analysis": resolve(__dirname, "packages/analysis/src/index.ts"),
      "@arc3dlab/effects": resolve(__dirname, "packages/effects/src/index.ts"),
      "@arc3dlab/interaction": resolve(__dirname, "packages/interaction/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
})
