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
