# Runtime Core

Updated: 2026-10-08

## Arc3DContext

```ts
interface Arc3DContext {
  config: Arc3DConfig
  engine: EngineContext
  registry: ResourceRegistry
  events: EventBus
  lifecycle: LifecycleManager
  logger: Logger
  capabilities: CapabilityRegistry
}
```

## 生命周期

```text
created -> initializing -> ready -> destroying -> destroyed
```

`destroyed` 之后调用公共 API 会抛出 `Arc3DError`，错误码为 `APP_DESTROYED`。

## EventBus

```ts
on<K extends keyof Arc3DEvents>(
  event: K,
  handler: (payload: Arc3DEvents[K]) => void
): Unsubscribe
```

`on` 返回取消订阅函数。销毁应用时 EventBus 自动清空。

稳定事件：

- `ready` / `destroy`
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
