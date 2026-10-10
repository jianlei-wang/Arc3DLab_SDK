# Runtime Core

Updated: 2026-10-09

## Arc3DContext

```ts
interface Arc3DContext {
  config: Arc3DConfig
  engine: EngineContext
  engineAdapter?: Engine
  registry: ResourceRegistry
  events: EventBus
  lifecycle: LifecycleManager
  logger: Logger
  capabilities: CapabilityRegistry
  commands: CommandBus
  tools: ToolRegistry
  scopes: PluginScopeManager
  disposers: DisposerStack
  tracker: ResourceTracker
}
```

`engineAdapter` 持有可注入的 `Engine` 实例，`destroy()` 统一走 `engineAdapter.destroy()`；缺失时回退到 `engine.viewer.destroy()`。`PluginScopeManager` 为每个插件提供隔离作用域，并注入不可伪造的归属标识。

## 生命周期

```text
created -> initializing -> ready -> destroying -> destroyed
```

`destroyed` 之后调用公共 API 会抛出 `Arc3DError`，错误码为 `APP_DESTROYED`。

`ready` 表示 Runtime facade 与各 Manager 就绪，底图、地形、数据等异步资源有各自独立的加载状态（见 `11-api.md`）。

首屏资源就绪使用 `app.scene.whenSceneReady(options?)`，返回 `SceneReadyResult`：

```ts
const result = await app.scene.whenSceneReady({ timeoutMs: 20000 })
result.ready            // 未超时且未销毁
result.remainingTiles   // 仍在加载的 Globe 瓦片数
result.timedOut         // 是否超时返回
result.destroyed        // 等待期间是否被销毁
result.defaultBaseLayer // disabled | loading | ready | failed
```

`whenSceneReady` 等待初始渲染帧与 Globe 瓦片加载完成，默认底图状态独立回报；成功、失败、关闭三条路径都能确定结果。就绪后会派发 `sceneReady` 事件。

## EventBus

```ts
on<K extends keyof Arc3DEvents>(
  event: K,
  handler: (payload: Arc3DEvents[K]) => void
): Unsubscribe
```

`on` 返回取消订阅函数。销毁应用时 EventBus 自动清空。

稳定事件：

- `ready` / `sceneReady` / `destroy`
- `cameraChanged`
- `layerAdded` / `layerRemoved`
- `graphicAdded` / `graphicRemoved`
- `pick` / `error`

## Resource 模型

```ts
interface ResourceHandle<TNative = unknown> {
  id: string
  type: string
  native: TNative
  visible: boolean
  owned: boolean
  destroy(): void
}
```

- `owned=true`：SDK 负责销毁
- `owned=false`：借用外部对象，`destroy()` 只取消注册

复合资源（Polygon fill + outline）对外是一个 Graphic，内部由 ResourceTracker 统一回收。

## ID

使用 `crypto.randomUUID()`；在不支持的环境回退到单调递增 `arc3d-{timestamp}-{n}`。

## Diagnostics

`getRuntimeDiagnostics(context)` 返回只读快照，`Arc3DApp.getDiagnostics()` 在其基础上追加 `postprocess` 与 `plugins`：

```ts
interface RuntimeDiagnostics {
  lifecycle: LifecycleState
  resources: Record<string, number>
  disposerCount: number
  listenerCount: number
  trackedParents: number
  capabilities: number
  commands: number
  tools: number
  activeTool: string | null
  pluginScopes: string[]
}
```

销毁、取消、卸载后可用该快照断言无残留；快照复制计数，不暴露可变内部结构。
