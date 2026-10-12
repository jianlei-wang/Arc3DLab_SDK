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
- [ ] 已在下方说明 API 变更内容，并判定 SemVer 影响（major / minor / patch）。
- [ ] 破坏性变更已在 `CHANGES.md` 的 `Breaking Changes` 中记录。

> 注意：`exports:update` 仅刷新基线，**不等同于接受破坏性改动**；刷新后仍需人工审查签名 diff。

API 变更说明 / SemVer 判定：

<!-- 例如：`DataCatalog` 新增 `unregisterSchema()` -> minor；`CommandBus.register` 默认 owner 语义调整 -> major。 -->

## 生命周期与资源契约

- [ ] 清理流程在任一步骤失败时仍尽力释放剩余资源（错误聚合、上报 best-effort）。
- [ ] 新增/修改的注册表读取方法返回快照或不可变数据，不暴露内部可变状态。
- [ ] 新增/修改的异步生命周期 API 已说明失败回滚、关闭期限内语义与取消行为。

## 验证

- [ ] `npm run gate:release` 通过（推送前钩子会强制执行）。
- [ ] 如涉及 Web/生命周期，`npm run test:e2e` 通过。
- [ ] 如涉及真实渲染/资源行为，已在 `PERF=1` 下运行 `e2e/perf.spec.ts` 并附上趋势数据（可选）。

## 关联

- 审阅报告 / issue / 跟踪清单：
