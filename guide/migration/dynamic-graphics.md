# 动态图形与特效

动态图形、体素、压平与粒子/天气能力，分别由 `@arc3dlab/graphics` 与 `@arc3dlab/effects` 提供。

## 动态图形

`graphics/dynamic` 导出一组工厂函数，接收 `Arc3DContext` 并返回 `DynamicGraphicHandle`：

```ts
import {
  addSpreadPoint,
  addRadarNormal,
  addCircleDiffusion,
  addDynamicPolyline,
} from "@arc3dlab/graphics"

const spread = addSpreadPoint(app.context, {
  position: { longitude: 116.39, latitude: 39.9 },
})

spread.destroy() // 移除图元并解除销毁登记
```

可用工厂：`addBillboard`、`addSpreadPoint`、`addRadarNormal`、`addRiver`、`addCircleDiffusion`、`addDynamicPolyline`、`addPanel`。句柄的销毁会登记到 `context.disposers`，应用销毁时自动清理。

雷达材质可单独注册：`registerRadarNormalMaterial()` 与 `RadarNormalMaterialProperty`（名称常量 `RADAR_NORMAL_MATERIAL`）。

## 体素

`MultiTileVoxel` 通过 `GridVoxelProvider` 与 `VoxelPrimitive` 渲染多瓦片体素：

```ts
import { MultiTileVoxel } from "@arc3dlab/graphics"

const voxel = new MultiTileVoxel(app.context, { /* VoxelOptions */ })
voxel.showPoints(true)
voxel.interpolate(x, y, z)
voxel.destroy()
```

## 压平

`ModelFlatten` 基于裁剪多边形集合压平模型：

```ts
import { ModelFlatten } from "@arc3dlab/graphics"

const flatten = new ModelFlatten(app.context, { /* ModelFlattenOptions */ })
flatten.addPolygon(positions)
flatten.setEnabled(true)
flatten.clear()
```

## 粒子与天气

```ts
import {
  createFireParticle,
  createExplosionParticle,
  createWaterGunParticle,
} from "@arc3dlab/effects"

const fire = createFireParticle(app.context, { longitude: 116.39, latitude: 39.9 })
createExplosionParticle(app.context, position)
createWaterGunParticle(app.context, source, target)

app.effects.weather.enable("rain", { intensity: 0.6 })
app.effects.weather.configure("fog", { density: 0.0003 })
app.effects.weather.disable("snow")
```

`WeatherKind` 支持 `rain`、`snow`、`fog`、`lightning`。

相关：[材质与后处理](/effects-ui/effects)。
