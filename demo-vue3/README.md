# Arc3DLab Sandcastle

基于 Vue 3 + Vite 的 Arc3DLab SDK 交互式示例浏览器（Sandcastle）。左侧为可编辑的示例代码，右侧为实时三维场景，示例覆盖图形、相机、场景、底图地形、图层数据、交互、分析、特效、标绘、动态图形、模型与导航服务等类别。

## 运行

```bash
# 进入示例目录
cd demo-vue3

# 安装依赖
npm install

# 启动开发服务器（默认 5173）
npm run dev

# 生产构建（vue-tsc 类型检查 + vite build）
npm run build
```

## 与工作区 SDK 的关系

示例始终消费仓库内的 SDK 源码，而非已发布的 npm 包：

- `vite.config.ts` 通过 `resolve.alias` 把 `arc3dlab` 与 `@arc3dlab/*` 指向根入口 `../src/index.ts` 与 `../packages/*/src/index.ts`，改源码后保存即热更新。
- `src/arc3dlab-shim.d.ts` 为 `vue-tsc` 声明示例用到的门面类型，避免类型检查跟随工作区软链进入 `packages/*/src`。
- 示例代码以字符串形式保存于 `src/examples/catalog.ts`，运行时由 `src/runner.ts` 注入 `app`、`gui`、`sdk` 后执行。

因此不需要在 `package.json` 中声明 `arc3dlab` 依赖；请先在仓库根目录确保依赖就绪（`npm install`），再运行本目录的开发服务器。
