# 插件系统

插件用于把一组扩展逻辑打包成可安装、可卸载的单元。通过 `app.use()` 安装。

## 定义插件

```ts
import type { Arc3DApp, Arc3DPlugin } from "arc3dlab"

const locatePlugin: Arc3DPlugin<Arc3DApp> = {
  name: "locate",
  version: "1.0.0",

  install(app, context, scope) {
    const off = app.interaction.on("click", (event) => {
      if (event.lngLat) console.log("clicked at", event.lngLat)
    })
    // 注册的清理回调会在卸载时自动执行
    scope.track(off)

    scope.track(() => {
      console.log("locate plugin disposed")
    })
  },

  uninstall(app) {
    console.log("locate plugin uninstalled")
  },
}
```

`Arc3DPlugin` 字段：

| 字段                           | 说明                                             |
| ------------------------------ | ------------------------------------------------ |
| `name`                         | 插件名，需全局唯一；不能为 `core` / `arc3dlab`。 |
| `version`                      | 可选版本。                                       |
| `requiresCapabilities`         | 声明所需能力，安装前校验。                       |
| `dependsOnPlugins`             | 声明依赖的其他插件名。                           |
| `install(app, context, scope)` | 安装逻辑。                                       |
| `uninstall?(app, context)`     | 卸载逻辑。                                       |

## 安装与卸载

```ts
await app.use(locatePlugin)

await app.plugins.uninstall("locate")
```

安装失败会自动回滚：执行已注册的释放回调并清理该插件注册的扩展。

### 生命周期合同

- `app.use()` 串行执行；同名插件已安装时抛 `DUPLICATE_RESOURCE`。
- `install()` 抛错后插件状态为 `failed`，不会登记为已安装。修复原因后可以再次安装同名插件，作用域会重新打开。
- 安装期间若应用进入销毁流程，安装会回滚并以 `CANCELLED` 结束。
- `uninstall()` 成功后将状态置为 `disposed`，同名插件可以重新安装；重复卸载已移除的插件抛 `RESOURCE_NOT_FOUND`，卸载不是幂等操作。
- 安装阶段拿到的 `scope` 在关闭后拒绝新的 `track` / `manage` / `register*` 调用，抛 `INVALID_ARGUMENT`。长生命周期逻辑应把清理登记到作用域，避免持有已关闭的作用域。

## 作用域与自动清理

`install` 收到的 `scope` 用于登记释放回调：

```ts
const off = app.on("sceneReady", handler)
scope.track(off) // 卸载时自动取消订阅
```

通过 `app.effects.materials.register()` 注册的材质会绑定当前插件作用域，随插件卸载自动注销。

除 `track()` 外，作用域还提供资源托管与扩展注册，把所有权显式绑定到当前插件：

- `manage(resource)` / `unmanage(resource)`：把可销毁资源纳入托管，卸载时自动 `destroy()`；需要提前交还所有权时用 `unmanage()`。
- `registerCommand(spec)` / `registerTool(spec)` / `registerCapability(record)`：以本插件为所有者注册命令、工具与能力，无需在定义中填写 `plugin` 字段。

用作用域注册优于直接操作 `context` 上的注册表：它不受跨 `await` 的全局活动所有者影响，避免安装期间的异步等待被外部注册误归属。

## 查询状态

```ts
app.plugins.list() // 已安装插件名
app.plugins.state("locate") // 单个插件状态
app.plugins.states() // 全部状态
```

插件状态：`installing` / `installed` / `uninstalling` / `failed` / `disposed`。

相关：[错误处理](/runtime/errors)。
