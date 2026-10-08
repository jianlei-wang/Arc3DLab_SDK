# Engine Adapter

Updated: 2026-10-08

## 接口

```ts
interface Engine {
  readonly type: string
  createViewer(options: EngineViewerOptions): EngineViewer
  destroy(): void
}
```

Cesium 实现：

```ts
class CesiumEngine implements Engine {
  readonly type = "cesium"
}
```

`EngineViewer.native` 暴露底层 Viewer，供高级用户通过 `app.native.viewer` 访问。

## 实例配置

Ion Token、默认相机矩形、分辨率、深度检测、Mapbox 控件映射都在 `createViewer` 时写入实例，模块 import 保持纯净。

## Credits

`CreditManager` 管理 Cesium、底图、地形和第三方服务归属。

```ts
app.credits.setMode("default" | "compact" | "custom")
app.credits.setContainer(element)
```

`default` 显示 Cesium 版权容器。应用如需自定义展示，使用 `custom` 并提供容器。

## 静态资源

SDK 核心包不携带完整 Cesium Assets / Workers。示例项目通过 `vite-plugin-cesium` 或官方静态资源方案提供。
