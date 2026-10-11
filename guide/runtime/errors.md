# 错误处理

Arc3DLab 的同步与异步失败统一为 `Arc3DError`。

```ts
import { Arc3DError } from "arc3dlab"

try {
  await app.basemap.set({ type: "tdt" })
} catch (error) {
  if (error instanceof Arc3DError) {
    console.error(error.code, error.message)
  }
}
```

## 错误码

| 错误码 | 含义 |
| --- | --- |
| `INVALID_CONTAINER` | 容器无法找到或不合法。 |
| `INVALID_ARGUMENT` | 参数不合法。 |
| `INVALID_FORMAT` | 数据格式不受支持或解析失败。 |
| `RESOURCE_NOT_FOUND` | 引用的资源不存在。 |
| `DUPLICATE_RESOURCE` | 资源 ID 重复。 |
| `UNSUPPORTED_CAPABILITY` | 需要的能力未注册。 |
| `AUTH_FAILED` | 令牌缺失或鉴权失败。 |
| `NETWORK_FAILURE` | 网络请求失败。 |
| `ENGINE_FAILURE` | 引擎层失败。 |
| `CANCELLED` | 操作被取消。 |
| `APP_DESTROYED` | 应用已销毁。 |

## 加载错误分类

影像、地形、数据源的加载错误会经过分类，便于按阶段处理：

```ts
import { classifyLoadError } from "arc3dlab/engine-cesium"
```

分类结果包含 `code`、`stage` 与 `message`，`stage` 取值：

- `token`：令牌缺失或无效。
- `network`：网络失败。
- `format`：数据格式问题。
- `engine`：引擎内部失败。

## 全局错误事件

运行时错误也会通过 `error` 事件广播：

```ts
app.on("error", ({ message, code }) => {
  console.warn("runtime error:", code ?? "-", message)
})
```

建议在应用入口订阅一次，作为兜底日志。

## 常见问题

- **创建时抛 `INVALID_CONTAINER`**：确认容器 ID 存在且已完成挂载。
- **底图报 `AUTH_FAILED`**：确认对应 token 已传入 `tokens`。
- **销毁后抛 `APP_DESTROYED`**：避免在异步回调中继续访问已销毁实例，或先取消订阅。

相关：[生命周期与销毁](/runtime/lifecycle)。
