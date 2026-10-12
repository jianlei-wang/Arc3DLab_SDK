# Arc3DLab SDK 三次架构审阅与整改跟踪

> 审阅对象：`jianlei_wang` 分支
> 审阅基线：[`08f2dc7`](https://github.com/jianlei-wang/Arc3DLab_SDK/commit/08f2dc7)（对比基线 `d6b4c61`）
> 来源：`.monkeycode-tmp-files/6672840f-Arc3DLab_SDK 第三轮架构审阅与整改建议-1.md`
> 本文性质：整改落地跟踪表，逐项记录状态与验证证据。状态取值：`TODO` / `DOING` / `DONE` / `PARTIAL` / `DEFERRED`。

## 1. 总体结论

第三轮审阅基于二次整改后的提交 `08f2dc7`，确认插件生命周期、资源清理、数据语义与发布合同总体方向正确。本轮聚焦消除剩余的归属/可变性/异常收敛边界。

截至整改提交，`npx tsc --noEmit`、`npm run test:coverage`、`npm run gate:release`、`npm run test:e2e` 全绿。

## 2. 逐项整改

| 编号 | 标题 | 状态 | 证据 |
|---|---|---|---|
| P1-01 | 公开注册表默认 owner 仍可能错误归属 | DONE | 见下 |
| P1-02 | 注册表读取暴露内部可变对象 | DONE | 见下 |
| P2-01 | 清理错误上报抛错会中断剩余释放 | DONE | 见下 |
| P2-05 | ToolRegistry 旧工具停用失败状态残留 | DONE | 见下 |
| P2-02 | DataCatalog schema 生命周期歧义 | DONE | 见下 |
| P2-03 | PluginScope.manage 幂等/提前释放合同 | DONE | 见下 |
| P2-04 | benchmark 与真实 SDK 性能未区分 | DONE | 趋势任务已落地，基线待积累 |
| P2-06 | `build:watch` 不同步 rollup 声明 | DONE | 见下 |
| 文档 | 分析任务不可克隆输入边界 | DONE | 见下 |
| 发布工程 | 服务端 required checks 与 API/SemVer 审查政策 | PARTIAL | 仓库内模板与文档已就绪，服务端启用待管理员 |

### [x] P1-01 公开注册表默认 owner 仍可能错误归属

- 问题：`register(...)` 原 owner 计算顺序为 `owner ?? ownerProvider() ?? spec.plugin`，`ownerProvider` 读取共享的 `scopes.activeOwner`。异步 `install` 等待期间的外部注册若不传显式 owner，会继承当前插件 owner，卸载时被误删。
- 方案：
  - 取消注册表的隐式 `ownerProvider` 推断；`CommandBus` / `ToolRegistry` / `CapabilityRegistry` 构造不再接收 ownerProvider。
  - 默认 owner 收敛为 `spec.plugin`（仅用于归属记录）。
  - 保留命名空间（`core.` / `arc3dlab.`）授权只依据显式 owner；省略 owner 的自报 `plugin` 不再能占用保留前缀，避免插件伪造 `plugin: "core"` 抢占核心扩展。
  - `createCoreCommandBus()` 显式以 owner `"core"` 注册 `core.ping`。
- 验收：插件 install 阻塞在 `await` 时，外部以 `spec.plugin: "app"` 且不传 owner 注册；安装结束并卸载插件后，应用自身 command/tool/capability 均保留且 owner/provider 为 `app`。
- 状态：DONE（`packages/core/src/{commands,tools,capabilities,context}.ts`；`plugin-owner-isolation.test.ts` 默认路径回归；`plugins.test.ts` 保留命名空间冒充拒绝；`plugin-extensions.test.ts` 新增“自报 core 但无 owner 仍拒绝”“显式 core owner 放行”）

### [x] P1-02 注册表读取暴露内部可变对象

- 问题：`CommandBus.get()`、`CapabilityRegistry.get()/records()` 返回内部对象引用；外部修改 `plugin` / `provider` / `available` 会绕过卸载清理或改变运行行为。
- 方案：
  - `CommandBus.get()` 返回 `snapshotCommand()` 防御性副本（含 `params` / `dependsOn` 深拷贝）。
  - `CapabilityRegistry.get()/records()` 返回浅拷贝；可用性只能经新增 `updateAvailability(name, available, provider?)` 修改。
- 验收：修改读取结果后，内部 owner/provider/availability 与按插件清理不受影响。
- 状态：DONE（`packages/core/src/{commands,capabilities}.ts`；`registry-immutability.test.ts` 覆盖命令、能力、工具读取隔离与显式可用性更新）

### [x] P2-01 清理错误上报抛错会中断剩余释放

- 问题：`ResourceRegistry.clear()` 与 `DisposerStack.disposeAll()` 的 `onError` 上报回调若自身抛错，会中断后续资源释放。
- 方案：上报调用包裹 `try/catch`，best-effort 吞掉上报器异常并继续释放；`Arc3DApp` 销毁路径统一经 `logError()`，`plugins.ts` 统一经 `safeLog()`。
- 验收：注入抛错 logger/reporter 时，其余资源仍全部释放。
- 状态：DONE（`packages/core/src/{resource,disposer}.ts`；`packages/sdk/src/{Arc3DApp,plugins}.ts`；`core-runtime.test.ts` best-effort 清理用例）

### [x] P2-05 ToolRegistry 旧工具停用失败状态残留

- 问题：`activate(next)` 切换时先清 `active` 并置 `deactivating`，随后在激活 `try/catch` 之外 `await previous.deactivate()`；旧工具停用抛错会直接退出，状态不收敛。
- 方案：旧工具停用时捕获错误并回滚 `active`/`current` 为 active，再向外抛出，保证状态机一致。
- 验收：旧工具 `deactivate()` 抛错后再执行一次激活/停用，状态与活动工具语义一致。
- 状态：DONE（`packages/core/src/tools.ts`；`tools-registry.test.ts` 回退用例）

### [x] P2-02 DataCatalog schema 生命周期歧义

- 问题：`unregisterAsset()` 不处理其携带的 schema，缺少独立 schema 注销 API，可能悬挂或无法重新注册。
- 方案：新增 `schemaOwners` 映射；资产拥有的 schema 随资产注销移除；新增 `registerSchema` / `hasSchema` / `unregisterSchema`；被存活资产拥有的 schema 拒绝独立注销（`INVALID_ARGUMENT`）；`clear()` 清理 `schemaOwners`。
- 验收：资产重新注册、schema 共享/重复注册/删除语义明确且可测试。
- 状态：DONE（`packages/core/src/catalog.ts`；`data-catalog.test.ts` schema 生命周期用例）

### [x] P2-03 PluginScope.manage 幂等/提前释放合同

- 问题：`manage()` 的 disposer 自带 `disposed` 标志，但资源被外部直接 `destroy()` 后作用域卸载仍会重复销毁；`DisposableResource.destroy()` 幂等性未声明。
- 方案：在文档中把 `DisposableResource.destroy()` 幂等列为公开契约；`manage()` 以 `managed` map + 幂等 disposer 托管；新增 `unmanage(resource)` 支持提前解托管；`dispose()` 清空 `managed`。
- 验收：被托管资源提前手动销毁后再卸载插件，不产生重复销毁。
- 状态：DONE（`packages/core/src/plugin-scope.ts`；`plugin-managed-resources.test.ts` unmanage/提前销毁用例）

### [x] P2-04 benchmark 与真实 SDK 性能未区分

- 问题：`bench:check` 是纯 JS 微基准，不调用真实 SDK/Cesium 渲染路径。
- 方案：保留脚本作为稳定 micro-benchmark；新增浏览器性能场景 `e2e/perf.spec.ts`，在真实 SDK API 下创建/删除图形并采集帧分位与资源回收；通过 `.github/workflows/perf.yml`（每日定时 + 手动）作为趋势任务，非必需检查。
- 验收：真实浏览器场景产出趋势数据；时间数值仅归档、不做硬承诺，资源回收做结构性断言。
- 状态：DONE（`e2e/perf.spec.ts`、`e2e/main.ts` 场景、`.github/workflows/perf.yml`；基线待 nightly 积累）

### [x] P2-06 `build:watch` 不同步 rollup 声明

- 问题：`build:watch` 仅为 `vite build --watch`，不会触发 `scripts/rollup-dts.mjs`，开发期 `.d.ts` 与最终发布声明可能不一致。
- 方案：在 `vite.config.ts` 增加内联 Vite 插件（`apply: "build"`），仅在 `config.build.watch` 为真时，于每次 watch 重建的 `closeBundle` 后执行 declaration rollup；`npm run build` 非 watch 路径不重复执行。
- 验收：`npm run build:watch` 首次构建与源码变更重建后均输出 `declaration rollup ok`；`npm run build` 仅执行一次 rollup。
- 状态：DONE（`vite.config.ts`、`docs/guides/sdk-development.md`、`12-engineering`）

### [x] 文档：分析任务不可克隆输入边界

- 问题：不可 `structuredClone` 的输入会降级为共享引用，只发 warning，调用方缺少明确书面边界。
- 方案：在 `09-analysis.md` 增补“输入快照合同”，说明默认克隆、降级告警与 `snapshot` 钩子。
- 状态：DONE（`docs/architecture/09-analysis.md`）

### [~] 发布工程：服务端 required checks 与 API/SemVer 审查政策

- 方案：
  - 新增 `.github/PULL_REQUEST_TEMPLATE.md`，纳入公共 API/SemVer 声明、生命周期与资源契约检查、`gate:release` 与按需 E2E。
  - `docs/architecture/12-engineering.md` 增补“公共 API 与 SemVer 治理”和 PR 模板说明，明确 `exports:update` 仅刷新基线、不等同接受破坏性变更。
- 状态：PARTIAL（仓库内模板与文档就绪；`gate`/`docs`/`guide`/`e2e` 服务端 required checks 与分支保护需仓库管理员在 GitHub 设置中启用）

## 3. 建议整改顺序（对应审阅表）

1. P1-01 owner 默认归属与回归测试
2. P1-02 注册表返回快照/不可变元数据
3. P2-01 cleanup reporter 容错
4. P2-05 ToolRegistry 异常状态收敛
5. P2-02 schema 生命周期合同与测试
6. P2-03 manage 的幂等/提前释放合同
7. P2-04 真实浏览器性能趋势任务
8. 服务端 required checks、API/SemVer 审查政策（仓库侧 DONE，服务端 PARTIAL）
