import { defineConfig, type Plugin } from "vite"
import dts from "vite-plugin-dts"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { packageAliases } from "./scripts/package-aliases.mjs"

const alias = packageAliases(__dirname)

function dtsRollupWatch(): Plugin {
  let watching = false
  return {
    name: "arc3dlab-dts-rollup-watch",
    apply: "build",
    configResolved(config) {
      watching = Boolean(config.build.watch)
    },
    closeBundle() {
      if (!watching) return
      const result = spawnSync("node", ["scripts/rollup-dts.mjs"], {
        cwd: __dirname,
        stdio: "inherit",
      })
      if (result.status !== 0) {
        this.error("declaration rollup failed")
      }
    },
  }
}

export default defineConfig({
  base: "./",
  resolve: { alias },
  worker: { format: "es" },
  plugins: [
    dts({
      entryRoot: ".",
      outDir: "dist",
      include: ["packages", "src/index.ts"],
      insertTypesEntry: true,
    }),
    dtsRollupWatch(),
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
