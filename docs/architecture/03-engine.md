# Engine Adapter

Updated: 2026-10-09

## 接口

```ts
interface Engine {
  readonly type: string
  createViewer(options: EngineViewerOptions): EngineViewer
  hasCapability(name: string): boolean
  mapError(error: unknown): { message: string; code?: string }
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

## 运行时边界

`createCesiumEngineContext()` 返回的 `EngineContext` 携带 `engine` 实例；`Arc3DContext.engineAdapter` 保存同一实例，`destroy()` 统一经它释放。引擎能力由 `hasCapability()` 在注册时回报，`CapabilityRegistry` 不再无条件宣称全部能力为可用。

## 实例配置

Ion Token、默认相机矩形、分辨率、深度检测、Mapbox 控件映射都在 `createViewer` 时写入实例，模块 import 保持纯净。

需要临时改写 `Cesium.Ion.defaultAccessToken` 的临界区统一走串行化 Token 作用域（`SerialIonTokenScope`）：任务排队进入，退出即恢复原始值，并发任务不会互相覆盖凭据。Viewer 构造不再永久改写共享 Token。

## Credits

`CreditManager` 管理 Cesium、底图、地形和第三方服务归属。

```ts
app.credits.setMode("default" | "compact" | "custom")
app.credits.setContainer(element)
```

`default` 显示 Cesium 版权容器。应用如需自定义展示，使用 `custom` 并提供容器。

## 静态资源

SDK 核心包不携带完整 Cesium Assets / Workers。示例项目通过 `vite-plugin-cesium` 或官方静态资源方案提供。
