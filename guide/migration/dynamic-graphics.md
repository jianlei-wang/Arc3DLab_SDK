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

`app.graphics.addVoxel(pointData, options?)` 将离散点数据空间插值为体素盒并按数值着色：

```ts
const voxel = app.graphics.addVoxel(
  [
    { x: 116.39, y: 39.9, z: 0, value: 12 },
    { x: 116.4, y: 39.91, z: 20, value: 40 },
  ],
  { dimensions: 15, method: "idw", power: 2, padding: 0 },
)

const value = voxel.interpolate(116.395, 39.905, 10)
voxel.showPoints(true)
voxel.destroy()
```

### 数据合同

- `VoxelPoint` 为 `{ x, y, z, value }`：`x` 为 WGS84 经度（度），`y` 为 WGS84 纬度（度），`z` 为相对 WGS84 椭球面的高程（米），`value` 为应用自定义标量。
- `value` 为 `NaN` 表示缺失：缺失点不参与边界、颜色定义域与插值；无有效输入的网格节点输出透明颜色，`interpolate` 返回 `NaN`。
- 体素盒地理范围由有效点的经度、纬度、高程最小/最大值决定，垂直跨度取高程跨度 `maxZ - minZ`；`padding`（米）在各维度两侧扩展范围，默认 `0`。

### 插值与颜色

| `method` | 说明 |
| --- | --- |
| `idw`（默认） | 反距离加权，权重为距离倒数的 `power` 次幂（`power` 默认 `2`）；查询点与输入点重合时返回该点值 |
| `nearest` | 最近邻，取距离最小输入点的值 |

距离在盒中心的东-北-天局部坐标系中以米计算，经度按 `cos(centerLat)` 折算。颜色定义域取自有效采样值的 `[min, max]`，高值映射到 `colorsList` 首项、低值映射到末项。

`VoxelOptions` 字段：`dimensions`（默认 `15`）、`colorsList`、`method`、`power`、`padding`。

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
