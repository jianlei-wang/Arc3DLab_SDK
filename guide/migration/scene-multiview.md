# 多屏联动与网格出图

`@arc3dlab/scene` 新增多视图相机联动与按网格分幅出图能力。

## 多屏联动

`SyncViewer` 以主视图为基准，把相机变化同步到其他视图：

```ts
import { SyncViewer } from "@arc3dlab/scene"

const sync = new SyncViewer(primaryView, [secondaryView])
sync.size // 跟随视图数量
sync.sync() // 手动立即同步
sync.destroy() // 结束联动并释放监听
```

`SyncableView` 需暴露 `camera`，其 `changed` 事件用于驱动自动同步。

## 网格出图

`captureGrid` 按行列分幅导出图像集合，`subdivideExtent` 负责范围切分：

```ts
import { captureGrid, subdivideExtent } from "@arc3dlab/scene"

const shots = await captureGrid({
  rows: 2,
  columns: 3,
  extent: [116.3, 39.8, 116.5, 40.0],
  format: "image/png",
  delayMs: 50,
})
```

每个 `ShotGridShot` 含 `row`、`column`、`extent` 与 `image`（数据地址）。

相关：[相机与导航](/camera/view)、[渲染模式](/scene/mode)。
