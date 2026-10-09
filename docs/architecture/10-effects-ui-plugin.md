# Effects / UI / Plugin

Updated: 2026-10-08

## Effects

材质、后处理、水面、扫描、发光、粒子。Buffer/实验 shader 通过 Capability 暴露。

```ts
app.effects.materials.register("flow-line", (options) => factory(options))
app.effects.materials.has("flow-line")
app.effects.materials.create("flow-line", { color: "#00FFFF" })
app.effects.materials.list()
```

内置 `color` 材质。业务通过 Registry 取材质。

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

Bloom 使用 Gaussian blur stage。Fog 使用 `scene.fog`。`app.destroy()` 回收全部 stage。

## UI

- Popup / Tooltip / Control / DomOverlay
- Tooltip 使用 `textContent` 写入文本
- 坐标相对 Viewer canvas 计算，避免 `clientX/Y` 与页面滚动错位

## Plugin

```ts
app.use(plugin)
```

插件拿到 `Arc3DContext` 与 CapabilityRegistry。插件保持对 Cesium 全局对象的隔离。

## Capability

```ts
capabilities.has("buffer-primitives")
capabilities.has("geojson-primitive")
```

实验 Cesium API 必须先注册 Capability，再被 RenderPolicy 使用。
