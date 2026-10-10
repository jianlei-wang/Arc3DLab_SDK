# Change Log

## 关键字说明 :mega:

``` 说明
## v 版本号 - 时间
### Breaking Changes：:mega: 重大变更（移除or替换）
### feat: :tada: 新功能、新特性
### fix: :wrench: 修复bug
```

## 当前

- 内置分析新增任务化方法（`measure` / `terrain` / `visibility` / `query` / `volume.*Task`），返回统一 `AnalysisResult` 并登记到 `app.analysis.tasks`；导出 `createTaskExecutor` / `AnalysisTaskExecutor`
- 新增 bundle 体积门禁 `lint:size`（`bundle-baseline.json` + `scripts/check-bundle-size.mjs`）与依赖漏洞审计 `lint:audit`
- 公共 API 白名单扩展：Options / Event / 空间与数据语义 / `AnalysisTask` 等类型，根入口与 `@arc3dlab/sdk` 命名导出
- `Viewer`（兼容入口）标注 `@deprecated`，`Layers.get` 返回资源句柄
- 拆分 `graphics` / `layers` / `scene` 聚合源文件为职责单一模块（对外符号不变）
- 质量门禁新增 `lint:api`：禁止消费者深路径导入 `packages/*/src`
- Sandcastle 左侧底部显示运行控制台
- Sandcastle 示例通过 gui.addToolbarButton / addToggleButton / addToolbarMenu 在地球上创建交互控件

## v1.0.0-alpha.1 - 2026-10-08

### Breaking Changes

- 主入口切换为 `Arc3D.create()`
- `package.json` license 与 `LICENSE` 对齐为 GPL-2.0-only
- 移除源码内置 Cesium Ion / 天地图 Token

### feat

- 内部 packages 模块化：core / engine-cesium / scene / layers / graphics / data / interaction / analysis / effects / ui / sdk
- 引入 Arc3DApp、ResourceRegistry、EventBus、Lifecycle、CreditManager、RenderPolicy
- `Viewer` 降为兼容适配器
- 设计迭代文档：`docs/architecture/`
- `app.graphics.addModel` 加载 glTF 模型
- `app.data.createProvider` / `load` / `addKml` / `addCzml`
- Interaction：hover、pickGraphic、pickLayer、selection
- 测量：height / heading / horizontalDistance / verticalDistance / spaceAngle
- `app.effects.materials` Material Registry
- `app.analysis.terrain` 地形采样 / 坡度 / 剖面
- `app.analysis.visibility` 通视 / 径向视域
- `app.effects.postprocess` Bloom / Outline / DoF / Fog / ColorCorrection
- `app.analysis.query` 矩形 / 多边形 / 距离查询
- `app.analysis.clip` Plane / Box / Polygon 剖切
- `app.analysis.terrain.setExaggeration` 地形夸张
- `app.analysis.visibility.viewshed` 贴地可见包络
- `app.analysis.volume` 挖填方 / 开挖剖切

### fix

- addPoints 始终返回 Graphic
- Polygon Primitive 按 onGround 选择 GroundPrimitive / Primitive
- Polygon fill 与 outline 使用不同内部 ID，销毁时一起回收
- Imagery 同名添加先移除旧资源
- EventHandler 完整 destroy
- Tooltip 使用 textContent 与 canvas 相对坐标

### chore

- 移除旧 `src/core` / `src/utils` / `src/types` 封装实现与 Rollup 构建配置
- 固定 Cesium `1.146.0`
- Sandcastle playground 编辑器移到地球左侧
- 移除 `demo-html`，Playground 由 `demo-vue3` 承担
