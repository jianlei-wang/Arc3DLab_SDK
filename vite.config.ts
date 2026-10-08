import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import { resolve } from "node:path"

const alias = {
  "@arc3dlab/core": resolve(__dirname, "packages/core/src/index.ts"),
  "@arc3dlab/engine-cesium": resolve(__dirname, "packages/engine-cesium/src/index.ts"),
  "@arc3dlab/scene": resolve(__dirname, "packages/scene/src/index.ts"),
  "@arc3dlab/layers": resolve(__dirname, "packages/layers/src/index.ts"),
  "@arc3dlab/graphics": resolve(__dirname, "packages/graphics/src/index.ts"),
  "@arc3dlab/data": resolve(__dirname, "packages/data/src/index.ts"),
  "@arc3dlab/interaction": resolve(__dirname, "packages/interaction/src/index.ts"),
  "@arc3dlab/analysis": resolve(__dirname, "packages/analysis/src/index.ts"),
  "@arc3dlab/effects": resolve(__dirname, "packages/effects/src/index.ts"),
  "@arc3dlab/ui": resolve(__dirname, "packages/ui/src/index.ts"),
  "@arc3dlab/sdk": resolve(__dirname, "packages/sdk/src/index.ts"),
  "@arc3dlab/legacy": resolve(__dirname, "packages/legacy/src/index.ts"),
}

export default defineConfig({
  resolve: { alias },
  plugins: [
    dts({
      entryRoot: ".",
      outDir: "dist",
      include: ["packages", "src/index.ts"],
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "engine-cesium": resolve(__dirname, "packages/engine-cesium/src/index.ts"),
      },
      name: "Arc3DLab",
      formats: ["es"],
      fileName: (format, entryName) =>
        entryName === "index" ? `arc3dlab.esm.js` : `${entryName}.js`,
    },
    rollupOptions: {
      external: ["cesium"],
      output: {
        globals: {
          cesium: "Cesium",
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  server: {
    allowedHosts: [".monkeycode-ai.online"],
  },
})
