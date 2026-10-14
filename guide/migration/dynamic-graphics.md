# 动态图形与特效

动态图形、粒子、体素与压平通过 `app.graphics` / `app.effects` 的公共方法使用，天气特效通过 `app.effects.weather`。

## 天气特效

`app.effects.weather` 支持 `rain`、`snow`、`fog`、`lightning`：

```ts
app.effects.weather.enable("rain", { rainSpeed: 120 })
app.effects.weather.configure("fog", { near: 10, far: 1000, farAlpha: 0.8 })
app.effects.weather.disable("snow")
app.effects.weather.clear()
```

选项按类型区分：

| 类型 | 选项 |
| --- | --- |
| `rain` | `tiltAngle`、`rainSize`、`rainSpeed` |
| `snow` | `snowSize`、`snowSpeed` |
| `fog` | `color`、`near`、`nearAlpha`、`far`、`farAlpha` |

`configure()` 在特效未启用时会记录配置，待 `enable()` 时一并生效。

## 动态图形

`app.graphics.dynamic` 是动态图形管理器，各方法接收选项对象并返回可释放的句柄：

```ts
const spread = app.graphics.dynamic.spreadPoint({
  position: { longitude: 116.39, latitude: 39.9 },
  radius: 500,
  color: "#00aaff",
})

const radar = app.graphics.dynamic.radarNormal({
  position: { longitude: 116.4, latitude: 39.9 },
  radius: 2000,
  speed: 2,
})

const trail = app.graphics.dynamic.polyline({ positions, width: 6 })
const panel = app.graphics.dynamic.panel({
  position: { longitude: 116.41, latitude: 39.9 },
  text: "热点",
  type: "hot",
})

spread.destroy()
```

可用方法：`billboard`、`spreadPoint`、`radarNormal`、`river`、`circleDiffusion`、`polyline`、`panel`。返回的 `DynamicGraphicHandle` 含 `id`、`native` 与 `destroy()`。

## 粒子特效

`app.effects.particles` 创建火焰、爆炸与水枪三类粒子系统：

```ts
const fire = app.effects.particles.fire({
  longitude: 116.39,
  latitude: 39.9,
  height: 10,
})
const boom = app.effects.particles.explosion(position)
const gun = app.effects.particles.waterGun(source, target)

fire.setVisible(false)
gun.destroy()
```

`ParticleHandle` 提供 `setVisible(visible)`、`visible` 与 `destroy()`。

## 体素

`app.graphics.addVoxel(pointData, options?)` 将离散点插值为体素盒并按数值着色：

```ts
const voxel = app.graphics.addVoxel(
  [{ x: 116.39, y: 39.9, z: 0, value: 12 }],
  { dimensions: 15 },
)

const value = voxel.interpolate(116.39, 39.9, 0)
voxel.showPoints(true)
voxel.destroy()
```

`VoxelPoint` 为 `{ x, y, z, value }`（`x`/`y` 为经纬度、`z` 为高程），`VoxelOptions` 含 `dimensions` 与 `colorsList`。

## 模型压平

`app.graphics.addFlatten(target?, options?)` 将多边形裁剪集合应用到目标模型或瓦片集：

```ts
const flatten = app.graphics.addFlatten(model.clippingPolygons, {
  enabled: true,
})
flatten.addPolygon(positions)
flatten.setEnabled(false)
flatten.destroy()
```

相关：[材质与后处理](/effects-ui/effects)。
