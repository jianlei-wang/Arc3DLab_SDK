# 生命周期与销毁

## 状态机

运行时生命周期为有限状态机：

```text
created -> initializing -> ready -> destroying -> destroyed
```

`Arc3D.create()` 内部会完成 `initializing -> ready` 的迁移。对外可观察到的稳定状态是 `ready` 与 `destroyed`。

## 销毁

不再需要时应调用 `destroy()`，释放原生资源（实体、图元、事件监听、DOM）：

```ts
await app.destroy()
```

- **幂等**：重复调用返回同一个销毁 Promise。
- 销毁后再调用 API 会抛出 `Arc3DError`，错误码为 `APP_DESTROYED`。

销毁也会广播 `destroy` 事件：

```ts
app.on("destroy", () => {
  console.log("app destroyed")
})
```

在单页应用中，通常在组件卸载时销毁：

```ts
onBeforeUnmount(() => {
  void app.destroy()
})
```

`destroy()` 同时释放图层、图形、数据源、插件作用域、分析 Worker 与事件监听。释放后再次调用句柄的 `destroy()` 是允许的；继续调用其他方法或访问原生对象属于未定义行为。

## 资源所有权

| 对象                 | 谁来释放                                        | 重试与重复语义                                            |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| `app`                | 创建方                                          | `destroy()` 幂等；销毁后 API 抛 `APP_DESTROYED`           |
| `Layer` / 数据源句柄 | 调用方或 `app.destroy()`                        | `handle.destroy()` 幂等                                   |
| 事件订阅             | 取消函数                                        | 取消幂等                                                  |
| 插件                 | `app.plugins.uninstall()` 或 `app.destroy()`    | 安装失败可修复后重新安装；重复卸载抛 `RESOURCE_NOT_FOUND` |
| 分析任务             | `app.analysis.tasks.clear()` 或 `app.destroy()` | 取消后任务保持终态，重试请发起新调用                      |
| 数据源失败记录       | 同 ID 重试或 `app.destroy()`                    | 失败记录保留用于诊断，同 ID 重试会先重置                  |

句柄的 `destroy()` 只负责自身资源。通过插件作用域创建的订阅与资源交给作用域托管，卸载时按登记顺序的逆序执行，业务代码无需重复释放。

## 取消与重试

`AbortSignal` 由调用方持有，取消是终态：一次被取消的调用不会恢复，重试使用新的调用与新的 `AbortController`。分析任务的取消只终止该作业；并发作业、已完成任务和任务记录不受影响。

数据加载失败时，`failed` 图层与资产会保留用于诊断。使用相同 `id` 再次加载会先重置失败记录，再按新资产重试；已成功或仍在加载的同 ID 记录按重复资源拒绝。

插件的 `install()` 失败会自动回滚，状态标记为 `failed`，不会登记为已安装。修复原因后可以再次 `app.use()` 同名插件，作用域会重新打开；卸载后也可以重新安装。

场景资源（底图、地形、首屏瓦片）的就绪与生命周期释放相互独立，等待方式见[就绪语义](/runtime/readiness)。

## 诊断快照

`getDiagnostics()` 返回运行时状态，便于排查：

```ts
const diag = app.getDiagnostics()
console.log(diag.plugins) // 已安装插件名
console.log(diag.postprocess) // 激活的后处理阶段数量
```

## 订阅与取消订阅

`app.on()` 返回取消订阅函数：

```ts
const off = app.on("error", (payload) => console.warn(payload.message))
// ...
off()
```

相关：[错误处理](/runtime/errors)。
