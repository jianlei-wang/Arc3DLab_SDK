# Arc3DLab SDK 开发说明

本文是 SDK 日常迭代手册，覆盖仓库结构、即时测试、预览、API 文档和发布。架构原则与模块边界以 `docs/architecture/` 为准。

## 文档地图

| 文档 | 用途 |
|---|---|
| `docs/guides/sdk-development.md` | 本文件：开发、测试、预览、发布 |
| `docs/architecture/` | 可迭代设计：模块边界、API 契约、路线图 |
| `docs/architecture/11-api.md` | 稳定公共 API |
| `docs/guides/migration.md` | 从 `Viewer` 迁到 `Arc3D.create()` |
| `README.md` | 安装与最小用法 |
| `CONTRIBUTING.md` | 贡献原则 |
| TypeDoc `api-docs/` | 由源码生成的 API 参考 |

## SDK 概览

Arc3DLab 是面向三维 WebGIS 的模块化场景运行时。CesiumJS 是首个渲染引擎。

当前策略：内部用 `packages/*` 分模块，对外仍发布单一 npm 包 `arc3dlab`。

当前版本：`1.0.0-alpha.1`。Cesium peer 固定为 `1.146.0`。兼容矩阵见 `COMPATIBILITY.md`。

### 仓库结构

```text
packages/
  core/            Runtime：Context / EventBus / Lifecycle / Registry
  engine-cesium/   Cesium 适配器，唯一允许直接依赖 cesium 的包
  scene/           相机、渲染、视口、时钟、环境
  layers/          底图、地形、图层、3D Tiles
  graphics/        点线面等 Graphic
  data/            数据描述与 Provider
  interaction/     拾取、选择、指针
  analysis/        测量与空间分析
  effects/         特效
  ui/              Tooltip 等 UI
  sdk/             Arc3D.create / Arc3DApp
  legacy/          Viewer 兼容适配器
src/index.ts       对外再导出
tests/unit/        Vitest 单元测试
demo-vue3/         即时预览（alias 指向源码）
docs/architecture/ 设计文档
docs/guides/       开发与迁移指南
```

`packages/*` 均为 `private: true` 的内部包。npm 发布物只有根包 `arc3dlab`，产物在 `dist/`。

依赖方向：

```text
core
  ^
engine-cesium
  ^
scene / layers / data / graphics
  ^
interaction / analysis / effects / ui
  ^
sdk -> legacy
```

`core` 只依赖 TypeScript 标准库。Cesium 只出现在 `engine-cesium` 及其渲染后端。

### 入口

稳定入口：

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  tokens: {
    cesiumIon: import.meta.env.VITE_CESIUM_ION_TOKEN,
  },
})
```

兼容入口：

```ts
import { Viewer } from "arc3dlab"
const viewer = new Viewer("map")
```

根入口稳定导出：`Arc3D`、`Arc3DApp`、`Graphic`、`Layer`、`LngLat`、`LngLatHeight`、`CameraPose`、`PickResult`、`Arc3DPlugin`、`Arc3DError`、`Viewer`。

高级入口：

```ts
import { CesiumEngine } from "arc3dlab/engine-cesium"
```

Cesium 类型从 `cesium` 导入。

## 开发指南

### 环境

- Node.js：仓库 `package.json` 记录目标为 `v22.20.0`
- 包管理：根目录 `npm install`
- 许可证：`GPL-2.0-only`，与 `LICENSE` 一致

### 安装

```bash
# 安装 SDK 与 Cesium peer
npm install
```

消费方安装：

```bash
npm i arc3dlab cesium
```

### 迭代顺序

1. 先改 `docs/architecture/` 对应设计文件。
2. 在 `docs/architecture/CHANGELOG.md` 追加：日期、变更点、影响模块。
3. 公共 API 变更同步 `docs/architecture/11-api.md` 与 `docs/guides/migration.md`。
4. 原则变更同步 `docs/architecture/01-principles.md` 与 `CONTRIBUTING.md`。
5. 再改 `packages/*` 与测试。
6. 运行 `npm test` 与 `npm run build`。
7. 用 `demo-vue3` 做场景预览。

源码改动放在 `packages/*`。根目录 `src/index.ts` 只做对外再导出。

### 日常命令

```bash
# 安装依赖
npm install

# 单次单元测试
npm test

# 监听测试
npm run test:watch

# 构建 ESM 与类型声明
npm run build

# 监听构建
npm run build:watch

# 生成 API 文档
npm run docs

# 监听 API 文档
npm run docs:watch

# 格式化
npm run format
```

构建产物：

- `dist/arc3dlab.esm.js`：主 ESM
- `dist/index.d.ts`：主类型
- `dist/engine-cesium.js` 与 `dist/engine-cesium.d.ts`：引擎子路径

Cesium 作为 external，不会打进 SDK bundle。

## 即时测试

改完代码后按这条链路验证：单元测试 -> 源码预览 -> 构建产物。

### 1. 单元测试

测试跑在 Node 环境，当前覆盖 `packages/core` 的 ID、Lifecycle、EventBus、ResourceRegistry。

```bash
# 仓库根目录
npm test
```

新增稳定公共 API 时，把用例加到 `tests/unit/`。文件名使用 `*.test.ts`。

监听模式适合改 core 时连续跑：

```bash
npm run test:watch
```

### 2. 源码即时预览

`demo-vue3` 通过 Vite alias 直接引用仓库源码，改 `packages/*` 后保存即可热更新。

```bash
cd demo-vue3
npm install
npm run dev
```

默认开发服务器端口为 `5173`。本环境预览域名需要 `server.allowedHosts` 包含 `.monkeycode-ai.online`，`demo-vue3/vite.config.ts` 已配置。

Cesium 静态资源由 `vite-plugin-cesium` 提供。应用入口示例：

```ts
import { Arc3D, type Arc3DApp } from "arc3dlab"

const app = await Arc3D.create({ container: "cus-map" })
```

浏览器控制台可直接使用 `window.app` 试 API。

需要 Ion / 天地图时，在运行时传入 token：

```ts
const app = await Arc3D.create({
  container: "cus-map",
  tokens: {
    cesiumIon: import.meta.env.VITE_CESIUM_ION_TOKEN,
  },
})
```

源码默认配置只允许占位符，token 由调用方注入。

### 3. 构建产物验证

发布前确认打包结果可被消费：

```bash
# 仓库根目录
npm run build
```

检查 `dist/` 是否包含 ESM 与 `.d.ts`。随后可把 demo 临时改为引用 `../dist/arc3dlab.esm.js`，或在另一项目执行 `npm i ../Arc3DLab_SDK` 做本地包验证。

## 预览

### 开发预览

首选 `demo-vue3`：

```bash
cd demo-vue3
npm run dev
```

访问本机 `http://localhost:5173`。在线预览环境会把该端口映射为 `*.monkeycode-ai.online`。

### API 文档预览

```bash
# 生成 TypeDoc HTML
npm run docs:build

# 在 5174 提供静态站点
npm run docs:preview
```

本机访问 `http://localhost:5174`。在线预览环境会把该端口映射为独立的 `5174-*.monkeycode-ai.online` 地址，与 Sandcastle `5173` 并存。

### 生产构建预览

```bash
cd demo-vue3
npm run build
npm run preview
```

这条路径验证的是 demo 自己的生产构建。验证 SDK 发布物时，先在仓库根目录执行 `npm run build`。

### 静态资源

若 Cesium Workers / Assets 404，确认 Vite 已启用 `vite-plugin-cesium`：

```ts
import cesium from "vite-plugin-cesium"

export default defineConfig({
  plugins: [cesium()],
})
```

## API 文档

API 文档分两层：

1. 设计契约：`docs/architecture/11-api.md`，描述稳定入口与兼容策略。
2. 源码参考：TypeDoc 从 `src/index.ts` 生成，输出到 `api-docs/api/`。

```bash
# 生成 TypeDoc HTML，并写 api-docs/index.html 跳转页
npm run docs

# 只跑 typedoc
npm run docs:build

# 改注释时持续生成
npm run docs:watch
```

`api-docs/` 已在 `.gitignore` 中，生成结果用于本地查阅或站点发布。
本地或在线预览使用 `npm run docs:preview`，端口 `5174`。

公共 API 注释写在导出符号上。`typedoc.json` 已排除 private / protected。

应用侧迁移对照见 `docs/guides/migration.md`。

## 发布

对外发布的是根包 `arc3dlab`。`files` 字段只包含：

- `dist/*`
- `README.md`
- `CHANGES.md`
- `LOG.md`
- `NOTICE.md`
- `LICENSE`

### 发布前检查

1. `docs/architecture/` 与代码一致。
2. `npm test` 通过。
3. `npm run build` 产出 ESM 与类型。
4. `package.json` 的 `version`、`license`、`peerDependencies` 正确。
5. `CHANGES.md` 写好本版本变更；`COMPATIBILITY.md` 覆盖 Cesium 范围。
6. 用 `demo-vue3` 或本地 `npm pack` 做一次消费验证。

### 版本与日志

当前版本在根 `package.json`：`1.0.0-alpha.1`。

- 面向用户的版本说明：`CHANGES.md`
- 开发过程日志模板：`LOG.md`

alpha / beta 使用 SemVer 预发布号，例如 `1.0.0-alpha.2`。

### 发布命令

```bash
# 确认登录 npm
npm whoami

# 仓库根目录构建
npm run build

# 检查即将发布的文件列表
npm pack --dry-run

# 发布到 npmjs（registry 见 publishConfig）
npm publish --access public
```

预发布标签示例：

```bash
npm publish --tag alpha --access public
```

`publishConfig.registry` 为 `https://registry.npmjs.org/`。GPL-2.0 要求随包分发 `LICENSE` 与 `NOTICE.md`。

### 发布后

1. 给 Git 打与 `package.json` 相同的 tag，例如 `v1.0.0-alpha.1`。
2. 推送分支与 tag。
3. 在消费项目中安装新版本，核对 Cesium 静态资源与主入口 `Arc3D.create()`。

## 贡献约束（摘要）

完整原则见 `CONTRIBUTING.md` 与 `docs/architecture/01-principles.md`。

1. `core` 独立于 Cesium、Vue、React。
2. 公共 API 使用明确类型。
3. 模块加载无副作用。
4. Token 运行时注入。
5. SDK 创建的资源可回收。
6. 异步 API 声明 `Promise<T>`。
7. Layer 与 Graphic 分离。
8. 稳定公共 API 配备自动化测试。
