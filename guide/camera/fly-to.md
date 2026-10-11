# 飞行与定位

相机操作通过 `app.camera`（即 `app.scene.camera`）访问。

## 飞行动画 `flyTo`

```ts
await app.camera.flyTo([116.391, 39.907, 1200], 2)
```

- 第一个参数为目标位置，接受 `LngLatHeight` 对象或 `[lng, lat]` / `[lng, lat, height]` 数组。
- 第二个参数为飞行时长（秒），默认 `2`。
- 返回 Promise，在飞行完成或被取消时兑现。

## 立即定位 `lookAt`

以固定俯角对准目标点，不做动画：

```ts
app.camera.lookAt([121.473, 31.230, 0], 2000)
```

- 第二个参数为相机与目标的距离（米），默认 `1000`。

## 回到默认位置 `reset`

运行时创建时会记录初始视角为 home。`reset()` 立即回到该位置：

```ts
app.camera.reset()
```

也可以用 `rememberHome()` 把当前视角更新为新的 home：

```ts
app.camera.rememberHome()
```

## 组合示例

```ts
async function focusCity(lng: number, lat: number) {
  app.camera.rememberHome()
  await app.camera.flyTo([lng, lat, 5000], 1.5)
  app.camera.lookAt([lng, lat, 0], 1500)
}
```

下一步：[视角与状态](/camera/view)。
