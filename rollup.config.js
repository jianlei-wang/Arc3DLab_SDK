import resolve from "rollup-plugin-node-resolve"
import commonjs from "rollup-plugin-commonjs"
import typescript from "rollup-plugin-typescript2"
import peerDepsExternal from "rollup-plugin-peer-deps-external"
import copy from "rollup-plugin-copy"

const libraryName = "arc3dlab"

export default {
  input: "src/index.ts", //打包的入口文件
  output: [
    // 输出配置，定义打包后文件的格式和位置
    {
      file: `dist/${libraryName}.cjs.js`, // 输出的文件名
      format: "cjs", // 模块格式，这里是 CommonJS 格式
      sourcemap: true, // 是否生成 source map，用于调试
    },
    {
      file: `dist/${libraryName}.esm.js`,
      format: "esm", // 模块格式，这里是 ES Module 格式
      sourcemap: true,
    },
    {
      file: `dist/${libraryName}.umd.js`,
      format: "umd", // 模块格式，这里是 UMD 格式，适用于浏览器和 Node.js
      name: "Arc3DLab", // 全局变量名称，UMD 格式在浏览器中会将库暴露为这个变量
      sourcemap: true,
    },
  ],
  plugins: [
    // 使用的插件列表
    peerDepsExternal(), // 防止将 peerDependencies 打包进输出文件中
    resolve(), // 解析 node_modules 中的第三方模块，使得 Rollup 能找到它们
    commonjs(), // 将 CommonJS 模块转换为 ES6 模块，以便 Rollup 处理
    typescript({
      // 使用 TypeScript 插件，将 TypeScript 转换为 JavaScript
      tsconfig: "./tsconfig.json", // 指定使用的 tsconfig 文件,
      exclude: [], //不需要编译的文件
    }),
    copy({
      //直接复制的文件，不参与打包
      targets: [{ src: "src/static/*", dest: "dist/static" }],
    }),
  ],
  // 声明哪些模块不应打包到库中，而是作为外部依赖
  external: (id) => {
    const isExternal = /^(cesium)/.test(id)
    if (isExternal) {
      console.log(`External dependency found: ${id}`)
    }
    return isExternal
  },
}
