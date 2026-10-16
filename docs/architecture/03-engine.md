# Engine Adapter

Updated: 2026-10-12

## 架构承诺：Cesium-first

Arc3DLab 是 **Cesium-first SDK**。`Engine` 抽象承担运行时生命周期、能力声明与错误映射的**内部接缝**，不承诺业务模块可无改动切换到其他渲染后端。

- 允许直接依赖 `cesium` 的包：`engine-cesium`、`data`、`scene`、`layers`、`graphics`、`interaction`、`analysis`、`effects`、`plotting`。该边界由 `scripts/release-gate.mjs` 的 `CESIUM_PACKAGES` 门禁固化。
- `core` 不依赖 Cesium，也不依赖任何具体渲染后端。
- **多渲染后端（可替换引擎）是长期路线图，不是当前 API 合同。** 若将来落地，需先把图形创建/更新/销毁、影像与 Tileset、拾取、相机/场景、材质/后处理抽象为端口，并把 `PerformanceManager` 等直接 `native` 访问移入 adapter，再用 Fake Engine 端到端测试约束边界。

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

`compact` 与 `default` 都保留版权信息本身，只区别布局：`compact` 在归属信息保持可见的前提下压缩占位，不隐藏版权区域。切换模式时容器会先移回原始父节点并清除压缩样式，因此 `default` / `compact` / `custom` 可反复切换且位置可逆。

## 多引擎路线图（非当前 API 合同）

以下内容是可替换渲染后端的**长期路线图**，不构成当前 API 承诺，任何一项都不得据此编写业务代码。

前置条件（全部满足才评估落地）：

1. 为图形创建/更新/销毁、影像与 Tileset、拾取、相机/场景、材质/后处理定义显式端口接口，端口只暴露 `core` 可表达的类型。
2. 清除业务模块对 `engineAdapter.native` / `app.native.viewer` 的直接访问，改经端口；`PerformanceManager` 等运行时统计同样经端口获取。
3. 用 Fake Engine 端到端测试约束边界，证明一组端口足以驱动现有功能。
4. 只有在此之后，才讨论第二个真实后端，并把 `CESIUM_PACKAGES` 门禁拆分为按能力声明的依赖边界。

当前状态：`Engine` 仅作为内部接缝，尚无第二个后端实现，也无落地时间表。

## 静态资源

SDK 核心包不携带完整 Cesium Assets / Workers。示例项目通过 `vite-plugin-cesium` 或官方静态资源方案提供。
