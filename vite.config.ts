import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import { resolve } from "node:path"
import { packageAliases } from "./scripts/package-aliases.mjs"

const alias = packageAliases(__dirname)

export default defineConfig({
  base: "./",
  resolve: { alias },
  plugins: [
    dts({
      entryRoot: ".",
      outDir: "dist",
      include: ["packages", "src/index.ts"],
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "engine-cesium": resolve(
          __dirname,
          "packages/engine-cesium/src/index.ts",
        ),
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
    assetsInlineLimit: 0,
  },
})
