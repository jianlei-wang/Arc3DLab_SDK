# 版本与稳定性

Arc3DLab 采用语义化版本。公共导出的兼容承诺取决于稳定性等级，机器可读事实源位于仓库的 `scripts/public-api-stability.json`。

## 稳定性等级

| 等级         | 承诺                                                            | 典型范围                                              |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------- |
| stable       | 破坏性变更只出现在 major；兼容新增进入 minor；修复进入 patch    | `Arc3D`、`Arc3DApp`、各 Manager、语义类型与纯计算 API |
| experimental | 允许在 minor 发生不兼容变更并记录日志；patch 不破坏             | Worker 作业传输层、`arc3dlab/engine-cesium` 子路径    |
| internal     | 不承诺兼容性，可随 patch 调整，业务代码不应依赖                 | `NativeContext`、`activeFrameValue` 等内部实现函数    |
| deprecated   | 至少保留一个 minor，只能在下一个 major 或更晚移除，需提供替代项 | 已登记 `since` / `removeIn` 的导出                    |

`app.native.viewer` 与 `native` / `scene` / `camera` / `canvas` 逃生舱属于 advanced / unstable，随 Cesium 版本变化，不纳入 SemVer 保证。

## 升级判断

- **patch**：可以安全升级，预期只包含修复与内部调整。
- **minor**：稳定 API 保持兼容；实验性 API 可能调整。请阅读 `CHANGES.md` 的 `### Deprecated` 与 `### Known Limitations`。
- **major**：稳定 API 可能移除或改签名。升级前按 `CHANGES.md` 的 `### Breaking Changes` 与迁移指南逐项替换。

## 弃用与移除

弃用导出会在类型声明中标记 `@deprecated`，并在 `CHANGES.md` 中说明替代项。弃用项至少保留一个 minor，`removeIn` 跨 major；例如 `since: 2.1.0` 的 API 最早在 `3.0.0` 移除。提前移除或缺少迁移说明会被发布门禁拒绝。

## 已知限制

当前及后续正式版本在 `CHANGES.md` 中都有 `### Known Limitations`。发布前还会验证真实 tarball 消费、ESM-only 出口、精确 `cesium@1.146.0` peer 依赖与 Worker 资产路径；这些限制不会通过升级悄悄改变。
