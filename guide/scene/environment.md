# 时钟与环境

## 时钟

`app.scene.clock` 控制场景时间推进，适合回放 CZML 等带时间的动态数据。

```ts
app.scene.clock.multiplier = 60 // 60 倍速
app.scene.clock.shouldAnimate = true
```

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `multiplier` | `number` | 播放倍速，越大时间流逝越快。 |
| `shouldAnimate` | `boolean` | 是否自动推进时间。 |

## 光照与阴影

```ts
app.scene.environment.setLighting(true)
```

`setLighting()` 同时切换地球光照与阴影。

## 大气层

```ts
app.scene.environment.setAtmosphere(true)
```

## 环境与后处理的区别

- 环境（光照、大气）是地球本身的渲染开关。
- 后处理（泛光、景深、雾效等）作用于整帧画面，见[材质与后处理](/effects-ui/effects)。

相关：[渲染模式](/scene/mode)。
