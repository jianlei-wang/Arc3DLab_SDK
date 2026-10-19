# 概述

<!-- 简要说明本 PR 的目的、范围与影响的模块。 -->

## 变更类型

- [ ] feat（新功能）
- [ ] fix（缺陷修复）
- [ ] refactor（重构，无行为变化）
- [ ] docs / chore / ci

## 公共 API 与 SemVer 审查

- [ ] 本 PR 未改动公共 API（`scripts/public-api-manifest.json` 无变化）。
- [ ] 本 PR 改动了公共 API，且已运行 `node scripts/release-gate.mjs exports:update` 刷新签名基线。
- [ ] 新增导出已在 `scripts/public-api-stability.json` 标记 `stable` / `experimental` / `internal`，`npm run lint:stability` 通过。
- [ ] 已运行 `npm run api:review`，并说明 SemVer 影响（major / minor / patch）。
- [ ] 破坏性变更已在 `CHANGES.md` 的 `Breaking Changes` 中记录；弃用项已写 `@deprecated`、`### Deprecated` 与 `removeIn` / 替代项。
- [ ] 涉及已发布版本 API 时已运行 `npm run api:snapshot` 更新 `scripts/api-history/`。

> 注意：`exports:update` 仅刷新基线，**不等同于接受破坏性改动**；刷新后仍需人工审查签名 diff。

API 变更说明 / 稳定性等级 / SemVer 判定：

<!-- 例如：`DataCatalog` 新增 `unregisterSchema()`，stable，minor；`AnalysisJob` 调整字段，experimental，minor。 -->

## 架构演进证据

- [ ] 本 PR 未改变架构边界或公共合同。
- [ ] 本 PR 改变架构边界，已按 `docs/architecture/15-architecture-evolution.md` 提供问题证据、基线、目标、最小验证与回滚路径。

证据 / 决策记录：

<!-- 链接基准数据、消费端报告或架构演进记录条目。 -->

## 生命周期与资源契约

- [ ] 清理流程在任一步骤失败时仍尽力释放剩余资源（错误聚合、上报 best-effort）。
- [ ] 新增/修改的注册表读取方法返回快照或不可变数据，不暴露内部可变状态。
- [ ] 新增/修改的异步生命周期 API 已说明失败回滚、关闭期限内语义与取消行为。

## 验证

- [ ] `npm run gate:release` 通过（推送前钩子会强制执行），包含 `lint:stability` 与 `api:review`。
- [ ] 如涉及 Web/生命周期，`npm run test:e2e` 通过。
- [ ] 如涉及真实渲染/资源行为，已在 `PERF=1` 下运行 `e2e/perf.spec.ts` 并附上趋势数据（可选）。

## 关联

- 审阅报告 / issue / 跟踪清单：
