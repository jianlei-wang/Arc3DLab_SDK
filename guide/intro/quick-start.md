# 快速开始

本页用一个最小示例，带你从安装到在浏览器中看到一个可交互的三维地球。

## 1. 安装

Arc3DLab 以 `cesium` 作为 peer 依赖，两者一起安装：

```bash
npm install arc3dlab cesium
```

## 2. 准备容器

在页面中放一个用于承载地球的元素：

```html
<div id="map" style="width: 100%; height: 600px"></div>
```

## 3. 创建应用

```ts
import { Arc3D } from "arc3dlab"

const app = await Arc3D.create({
  container: "map",
  tokens: { cesiumIon: "<your-ion-token>" },
})
```

`Arc3D.create()` 解析完成，表示运行时门面就绪。异步资源（底图、地形、数据）随后陆续加载。

## 4. 等待首屏就绪

```ts
await app.scene.whenSceneReady({ timeoutMs: 10000 })
```

`whenSceneReady()` 会等待首屏瓦片加载完成，是进行初始定位与截图前的合适时机。

## 5. 添加内容并定位

```ts
app.graphics.addPoint({
  positions: { longitude: 116.391, latitude: 39.907, height: 0 },
  style: { color: "#ff3b30", pixelSize: 12, clampToGround: true },
})

await app.camera.flyTo([116.391, 39.907, 1200], 2)
```

## 6. 销毁

页面卸载或切换场景时释放资源：

```ts
await app.destroy()
```

## 完整示例

```ts
import { Arc3D } from "arc3dlab"

async function main() {
  const app = await Arc3D.create({
    container: "map",
    tokens: { cesiumIon: "<your-ion-token>" },
    scene: { mode: "3d", fpsShow: false },
  })

  await app.scene.whenSceneReady({ timeoutMs: 10000 })

  app.graphics.addPoint({
    positions: { longitude: 116.391, latitude: 39.907, height: 0 },
    style: { color: "#ff3b30", pixelSize: 12, clampToGround: true },
  })

  await app.camera.flyTo([116.391, 39.907, 1200], 2)
}

main().catch((error) => console.error(error))
```

接下来阅读：

- [环境与安装](/intro/environment)：构建工具、类型与 Ion Token 的更多细节。
- [创建应用](/runtime/create-app)：`Arc3DConfig` 的全部配置项。
- [就绪语义](/runtime/readiness)：区分"运行时就绪"与"首屏就绪"。
