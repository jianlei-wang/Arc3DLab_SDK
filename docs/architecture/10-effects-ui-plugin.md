# Effects / UI / Plugin

Updated: 2026-10-16

## Effects

材质、后处理、水面、扫描、发光、粒子。Buffer/实验 shader 通过 Capability 暴露。

```ts
app.effects.materials.register("flow-line", (options) => factory(options))
app.effects.materials.has("flow-line")
app.effects.materials.create("flow-line", { color: "#00FFFF" })
app.effects.materials.list()
```

内置 `color` 材质。业务通过 Registry 取材质。

内置的动态扩散、线尾迹与雷达材质通过 `registerArc3DMaterials()` / `registerRadarNormalMaterial()` 注册到 Cesium 内部入口 `Material._materialCache`（Cesium 1.146.0 无公开注册 API）。该内部依赖已在 `COMPATIBILITY.md` 登记为升级高风险点，并由 `tests/integration/cesium-material-registration.test.ts` 针对锁定版本守卫。

## 粒子

`app.effects.particles` 创建火焰、爆炸与水枪粒子并返回 `ParticleHandle`：

```ts
const handle = app.effects.particles.fire(position, { image })
handle.setVisible(false)
handle.destroy()
```

`ParticleManager` 托管全部已创建句柄，`app.effects.destroy()` 会统一释放。粒子创建会以引用计数方式覆盖 `viewer.clock.shouldAnimate`：首个粒子保存原值并置为 `true`，全部粒子释放后恢复原值；重复销毁安全。单一释放失败经日志上报，不中断其余释放。

## PostProcess

```ts
app.effects.postprocess.setBloom(enabled, { sigma, delta, stepSize })
app.effects.postprocess.setOutline(enabled)
app.effects.postprocess.setDepthOfField(enabled, { focalDistance })
app.effects.postprocess.setFog(enabled, { density })
app.effects.postprocess.setColorCorrection(enabled, { brightness })
app.effects.postprocess.list()
app.effects.postprocess.clear()
```

Bloom 优先切换 Viewer 内置 bloom stage；内置不可用时由 `createCesiumStageFactory` 构造真实的 Bloom `PostProcessStage`（亮度阈值 + 高斯加权采样），不再用 Blur stage 冒充。Fog 使用 `scene.fog`。`app.destroy()` 回收全部 stage。

## UI

- Popup / Tooltip / Control / DomOverlay
- Tooltip 使用 `textContent` 写入文本
- 坐标相对 Viewer canvas 计算，避免 `clientX/Y` 与页面滚动错位

## Plugin

```ts
app.use(plugin)
```

插件拿到 `Arc3DContext` 与 `PluginScope`。所有命令、工具、能力、材质与资源都登记进该作用域；归属标识由作用域注入，注册者自报的 `plugin` 字段不可信。

- `requiresCapabilities`：安装前校验能力，缺失即失败。
- `dependsOnPlugins`：安装前校验插件依赖；被依赖的插件禁止直接卸载。
- 状态机：`installing / installed / uninstalling / failed / disposed`。
- 卸载使用 `try / finally`，即使撤销或清理抛错也会完成归属清理。

`ToolRegistry` 为活动工具维护 `idle / activating / active / deactivating` 状态，注销活动工具前先执行 `deactivate()`。

## Capability

```ts
capabilities.has("buffer-primitives")
capabilities.has("geojson-primitive")
```

能力声明区分「SDK 提供」与「后端实例」两类，注册时由 `Engine.hasCapability()` 回报真实可用性。实验 Cesium API 必须先注册 Capability，再被 RenderPolicy 使用。
