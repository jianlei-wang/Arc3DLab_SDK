# 环境与安装

## 运行时要求

- 现代浏览器（支持 WebGL 与 ES2020）。
- Node.js 18+（用于构建工具链）。

## 依赖

Arc3DLab 把 `cesium` 声明为 peer 依赖，需要由应用显式安装，以便控制 Cesium 版本与静态资源：

```bash
npm install arc3dlab cesium
```

若使用 TypeScript，类型声明随包提供（`dist/index.d.ts`），无需额外安装。

## 打包器

推荐使用 Vite。Cesium 需要其静态资源（Worker、Assets、Widgets）可被访问；使用 `vite-plugin-cesium` 或手动复制 `cesium/Build/Cesium` 均可。示例（Vite）：

```ts
import { defineConfig } from "vite"
import cesium from "vite-plugin-cesium"

export default defineConfig({
  plugins: [cesium()],
})
```

## Ion Token

需要 Cesium Ion 底图或 Ion 资源时，在创建应用时提供 token：

```ts
const app = await Arc3D.create({
  container: "map",
  tokens: { cesiumIon: "<your-ion-token>" },
})
```

也可以在引擎选项中直接提供，两者等价：

```ts
const app = await Arc3D.create({
  container: "map",
  engine: { cesium: { ionToken: "<your-ion-token>" } },
})
```

## 天地图 Token

使用天地图底图或影像时，提供 `tokens.tdt`：

```ts
const app = await Arc3D.create({
  container: "map",
  tokens: { tdt: "<your-tianditu-token>" },
})
```

随后设置天地图底图（详见[底图设置](/imagery-terrain/basemap)）：

```ts
await app.basemap.set({ type: "tdt", mode: "img" })
```

## 子路径导出

除了主入口，SDK 还导出引擎子路径，用于高级场景：

```ts
import {} from "arc3dlab/engine-cesium"
```

内部包（`packages/*/src`）不属于公共合同，请勿深路径导入。
