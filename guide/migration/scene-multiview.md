# 多屏联动与网格出图

多视图相机联动与按网格分幅出图挂在 `app.scene` 上，`subdivideExtent` 从 `arc3dlab` 具名导出。

## 多屏联动

`app.scene.sync(views)` 以当前视图为主视图，把相机变化同步到其他视图，返回 `SyncViewer`：

```ts
const sync = app.scene.sync([
  { camera: leftViewer.camera },
  { camera: rightViewer.camera },
])

sync.size // 跟随视图数量（不含主视图）
sync.sync() // 立即手动同步一次
sync.destroy() // 结束联动并释放监听
```

参与联动的视图（`SyncableView`）只需暴露一个相机对象（`SyncableCamera`）：`position`、`direction`、`up`、`setView`，以及可选的 `changed` 事件，用于驱动自动同步。

## 网格出图

`app.scene.captureGrid(options)` 按行列分幅导出图像集合：

```ts
import { subdivideExtent } from "arc3dlab"

const shots = await app.scene.captureGrid({
  extent: [116.3, 39.8, 116.5, 40.0],
  rows: 2,
  columns: 3,
})

const cells = subdivideExtent([116.3, 39.8, 116.5, 40.0], 2, 3)
```

`ShotGridOptions` 含 `rows`、`columns`、`extent` 与可选的 `format`、`delayMs`；每个分幅（`ShotGridShot`）含 `row`、`column`、`extent` 与 `image`（数据地址）。`subdivideExtent(extent, rows, columns)` 返回按行优先排列的子范围数组。

相关：[相机与导航](/camera/view)、[渲染模式](/scene/mode)。
