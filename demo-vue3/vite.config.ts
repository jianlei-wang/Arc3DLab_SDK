import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import cesium from "vite-plugin-cesium"
import { resolve } from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), cesium()],
  resolve: {
    alias: {
      // 将 arc3dlab 指向本地构建的ESM文件，便于开发测试
      'arc3dlab': resolve(__dirname, '../dist/arc3dlab.esm.js'),
    },
  },
  define: {
    global: 'globalThis',
  },
})
