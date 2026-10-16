# Design Document

## Overview

不改动材质注册的运行时实现，围绕「内部 API 依赖」补齐治理与护栏：文档登记、版本契约集成测试、架构说明引用。

## Components and Interfaces

### 文档登记（COMPATIBILITY.md）

在「依赖锁定策略」下新增「Cesium 内部 API 依赖（升级高风险点）」小节，内容：

- 依赖清单：`Material._materialCache.addMaterial/getMaterial`，使用位置为 `packages/effects/src/materials.ts`（动态扩散、线尾迹）与 `packages/graphics/src/dynamic/materials.ts`（雷达）。
- 现状与原因：Cesium 1.146.0 无公开材质注册 API；`Material.fromType` 亦消费该缓存。
- 风险声明：不属于 Arc3DLab 稳定公开合同，不得无限期依赖。
- 缓解：`peerDependencies` 精确锁定 1.146.0；注册入口以 `if (!cache) return` 守卫访问；新增版本契约集成测试；升级 Cesium 时以该测试与 `Material.fromType` 编译结果为核查项。

### 架构说明（docs/architecture/10-effects-ui-plugin.md）

在 Effects 段落补充：内置动态材质注册依赖 Cesium 内部 `Material._materialCache`，并引用 `COMPATIBILITY.md` 的风险登记。

### 版本契约集成测试（tests/integration/cesium-material-registration.test.ts）

在 `tests/integration` 下新增测试文件（`vitest.config.ts` 已包含该目录）：

```ts
function materialCache(): MaterialCacheContract {
  return (Material as unknown as { _materialCache: MaterialCacheContract })
    ._materialCache
}
```

- 契约探针：`addMaterial` / `getMaterial` 为函数。
- 注册断言：三类材质模板进入缓存且 `fabric.type` / `fabric.source` 正确。
- 编译断言：`Material.fromType(DYNAMIC_SPREAD_MATERIAL)` 与 `Material.fromType(RADAR_NORMAL_MATERIAL)` 返回材质且 `shaderSource` 含 `czm_getMaterial`。

### headless 适配

`Material.fromType` 内部 `getUniformType` 会对 uniform 值执行 `instanceof HTMLCanvasElement/HTMLImageElement/ImageBitmap/OffscreenCanvas`，node 下这些构造器未定义会抛 `ReferenceError`。测试在 `beforeAll` 为缺失的构造器注入占位类，`afterAll` 还原，从而在 node 环境复用 Cesium 真实的材质编译路径。

线尾迹材质带 `image` 纹理 uniform，编译时会触发浏览器纹理加载（`Resource.fetchImage` → `document`），故编译断言只覆盖无纹理材质；纹理路径留待浏览器 E2E 层。注册断言覆盖全部三类。

## Testing Strategy

- 运行 `npx vitest run tests/integration/cesium-material-registration.test.ts` 验证三项断言。
- 全量 `npm test` / 门禁保证不破坏既有用例；新增测试不改变覆盖率分母（`tests/` 不纳入 coverage include）。

## Risks and Mitigations

- **node 环境缺少浏览器构造器**：以 `beforeAll` 注入、`afterAll` 还原的占位类隔离，避免污染其它用例。
- **`_materialCache` 结构在升级后改变**：契约探针与注册断言会在升级时第一时间失败，提示更新访问层与测试。
