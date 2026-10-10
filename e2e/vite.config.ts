import { defineConfig } from "vite"
import cesium from "vite-plugin-cesium"
import { resolve } from "node:path"

const root = resolve(__dirname, "..")

export default defineConfig({
  root: __dirname,
  plugins: [cesium()],
  resolve: {
    alias: {
      arc3dlab: resolve(root, "src/index.ts"),
      "@arc3dlab/core": resolve(root, "packages/core/src/index.ts"),
      "@arc3dlab/engine-cesium": resolve(
        root,
        "packages/engine-cesium/src/index.ts",
      ),
      "@arc3dlab/scene": resolve(root, "packages/scene/src/index.ts"),
      "@arc3dlab/layers": resolve(root, "packages/layers/src/index.ts"),
      "@arc3dlab/graphics": resolve(root, "packages/graphics/src/index.ts"),
      "@arc3dlab/data": resolve(root, "packages/data/src/index.ts"),
      "@arc3dlab/interaction": resolve(
        root,
        "packages/interaction/src/index.ts",
      ),
      "@arc3dlab/analysis": resolve(root, "packages/analysis/src/index.ts"),
      "@arc3dlab/effects": resolve(root, "packages/effects/src/index.ts"),
      "@arc3dlab/ui": resolve(root, "packages/ui/src/index.ts"),
      "@arc3dlab/sdk": resolve(root, "packages/sdk/src/index.ts"),
      "@arc3dlab/legacy": resolve(root, "packages/legacy/src/index.ts"),
    },
  },
  server: {
    port: 4310,
    strictPort: true,
  },
  define: {
    global: "globalThis",
  },
})
