# Arc3DLab SDK 迭代调整清单 - 1

> 来源：`Arc3DLab SDK 架构审阅与整改清单-1.md`
> 审阅基线：`jianlei_wang` / `c762b9cb38481975e580663bda6e4547c6b9b38b`
> 本清单为该审阅项的落地跟踪表。每项记录：优先级、问题、整改方案、验收标准、状态。
> 状态取值：`TODO` / `DOING` / `DONE` / `PARTIAL` / `DEFERRED`。
> 所有提交发生在 `jianlei_wang` 分支。

## 0. 进度总览

| 编号 | 标题 | 优先级 | 状态 |
|---|---|---|---|
| P1-01 | 插件并发安装时扩展注册归属错误 | P1 | DONE |
| P1-02 | ToolRegistry 异步竞争与停用异常阻断清理 | P1 | DONE |
| P1-03 | PluginScope 状态与生命周期不同步 | P1 | DONE |
| P1-04 | 异步分析执行期间取消仍返回 succeeded | P1 | DONE |
| P1-05 | 分析任务 inputSnapshot 非快照、注册表暴露可变对象 | P1 | DONE |
| P1-06 | Arc3D 初始化缺少失败回滚边界 | P1 | DONE |
| P1-07 | 明确 Cesium-first 与多引擎架构承诺 | P1 | DONE |
| P2-01 | 对发布后的 .d.ts 做消费者类型测试 | P2 | DONE |
| P2-02 | 加强公共导出门禁（真实导出表 diff） | P2 | DONE |
| P2-03 | 收敛包别名配置到单一来源 | P2 | DONE |
| P2-04 | 明确包的 ESM-only 合同 | P2 | DONE |
| P2-05 | 稳定/发布分支保护与必需状态检查 | P2 | DEFERRED |
| P2-06 | 修正整改文档状态标记与基线信息 | P2 | DONE |
| P3-01 | 主线程分析任务性能分级与 Worker 迁移路线 | P3 | DONE |
| P3-02 | 公共管理器统一只读诊断与异常聚合约定 | P3 | DEFERRED |

## 1. P1：高优先级整改

### [x] P1-01 插件安装并发时，扩展注册可能被错误归属

- 问题：`PluginManager.use()` 在 `await plugin.install()` 期间通过共享 `activeOwner` 传递归属，并发安装时后启动者覆盖先启动者；同名并发调用可能同时通过 `plugins.has()` 检查并覆盖 scope。
- 方案：
  - `PluginManager` 增加生命周期互斥队列，`use` / `uninstall` 串行执行；重复名检查移到临界区内，保证同名并发确定性拒绝。
  - `PluginScopeManager.open()` 对已存在且未关闭的 owner 抛 `DUPLICATE_RESOURCE`。
  - 注册表支持显式 owner 参数，插件经 scope 注册时归属不可伪造。
- 验收：并发安装两个带异步步骤的插件后，命令/工具/能力 owner 与注册者一致；分别卸载只移除自身扩展；同名并发安装确定性拒绝且无残留 scope。
- 状态：DONE（`PluginManager.runExclusive` 串行化；`open()` 重复保护；`CommandBus/ToolRegistry/CapabilityRegistry.register` 支持显式 owner；`plugins-concurrency.test.ts` 覆盖交错安装、同名并发与 owner 归属）

### [x] P1-02 ToolRegistry 的异步竞争与停用异常可能阻断清理

- 问题：`activate` / `deactivate` 无串行队列，快速并发激活可能产生多个已启动工具；`unregister` 在 `deactivate` 抛错时 `items.delete` 不执行；`unregisterByPlugin` 首个异常中止后续；插件扩展清理按类别串行，前一类失败会中断后一类。
- 方案：
  - `ToolRegistry` 内部所有状态迁移进入串行操作队列。
  - `unregister` 保证 `items.delete` 始终执行，停用错误在清理后抛出。
  - `unregisterByPlugin` 逐项处理并聚合错误，不因单项失败中止。
  - `dropPluginExtensions` 逐类别隔离错误，工具停用失败仍继续注销命令/能力。
- 验收：并发激活始终只有一个活动工具；某工具 `deactivate()` 抛错时其余工具仍被处理，该插件命令/工具/能力/资源均被清理且诊断无残留。
- 状态：DONE（`ToolRegistry` 串行队列；`unregister` finally 删除；`unregisterByPlugin` 聚合；`dropPluginExtensions` 类别隔离；`tools-registry.test.ts` 覆盖并发激活与停用异常清理）

### [x] P1-03 PluginScope 状态与生命周期实际不同步，关闭后仍可追踪释放函数

- 问题：`PluginScopeImpl` 状态恒为 `installing`（`PluginManager` 只更新自身 `stateMap`）；`track()` 在 scope 关闭后仍静默累积；`open()` 无重复保护。
- 方案：
  - 插件状态唯一来源收敛到 scope；`PluginManager` 通过 `scopes.setState()` 同步 `installing → installed → uninstalling → disposed`。
  - scope 增加 `closed` 标记；关闭后 `track()` 明确拒绝。
  - `close()` 标记 closed 并置为 `disposed`；`open()` 检测重复 owner。
- 验收：插件可读到正确状态；关闭后 `track()` 不静默累积资源；重复打开同名 scope 明确报错；反复安装/卸载后 scope 数量归零。
- 状态：DONE（`PluginScope.closed` / `setState` / `open` 重复保护；`plugins-scope.test.ts` 覆盖状态转移、关闭后 track 拒绝、scope 归零）

### [x] P1-04 异步分析在执行期间取消，仍可能返回 `succeeded`

- 问题：`runAnalysisTask()` 在 `await options.execute(runner)` 返回后直接标记 `succeeded`，未再次检查 `AbortSignal` 或运行时销毁状态。
- 方案：执行完成写结果前再次检查取消信号与生命周期；统一取消语义并在文档明确协作式取消边界。
- 验收：执行回调等待期间触发 abort 后正常 resolve，最终状态必须为 `cancelled`；运行期销毁也不能报告成功。
- 状态：DONE（`afterAwait` 关卡：完成前后各调用 `assertActive`，`signal` 已中止或生命周期终止时抛出 `CANCELLED`；`analysis-task.test.ts` 新增等待期间取消与销毁用例）

### [x] P1-05 分析任务的 `inputSnapshot` 不是快照，注册表暴露可变内部对象

- 问题：返回值 `inputSnapshot` 直接引用 `options.input`；`AnalysisTaskRegistry.get()` / `list()` 返回内部对象引用。
- 方案：启动时生成独立输入快照（`structuredClone`，不可克隆输入走显式降级策略）；注册表查询返回防御性副本。
- 验收：修改调用方原始输入、参数或读取到的任务对象，不改变已登记历史；不可序列化输入给出可预测结果。
- 状态：DONE（`cloneSnapshot` 采用 `structuredClone`，失败时降级为保留原引用并记录 warning；`AnalysisTaskRegistry.get/list` 返回 `structuredClone` 副本；`analysis-task.test.ts` 覆盖输入改写隔离与快照）

### [x] P1-06 Arc3D 初始化缺少完整的失败回滚边界

- 问题：`buildApp()` 先创建 Viewer，再创建 Context、注册能力并构造 `Arc3DApp`，无统一 `try/catch` 回滚；中途异常时 Viewer/WebGL 资源可能残留。
- 方案：初始化实现为事务式流程，逐层登记 disposer，失败时逆序回滚并保留原始错误；Engine 工厂可注入以便测试。
- 验收：模拟 manager 构造或能力注册失败后 Viewer 被销毁、资源清空，异常携带原始原因；重复失败初始化不积累资源。
- 状态：DONE（`buildApp` 登记回滚栈；失败时 `context.disposers.disposeAll` + `engineAdapter.destroy`；`arc3d-init-rollback.test.ts` 覆盖能力注册失败与重复失败）

### [x] P1-07 明确 Cesium-first 与可替换引擎的架构承诺

- 问题：架构图使用 Engine Adapter 表达可替换边界，但 `graphics`/`data`/`scene`/`layers`/`analysis` 直接导入 Cesium；release gate 亦允许。
- 决策：采用 **Cesium-first**。Engine 是内部生命周期/能力接缝，多渲染后端为长期路线图，不构成当前 API 承诺。
- 方案：在 `docs/architecture/03-engine.md`、`packages/README.md`、`README.md`、`COMPATIBILITY.md` 统一表达；包边界门禁保持现状并加注释说明。
- 验收：README、架构文档、包边界门禁与代码依赖方向对“Cesium-first”保持一致。
- 状态：DONE（架构承诺文档统一为 Cesium-first；`release-gate.mjs` 增补 Cesium-first 说明）

## 2. P2：工程化与长期维护整改

### [x] P2-01 对发布后的 `.d.ts` 做真正的消费者类型测试

- 问题：`public-api.test.ts` 从源码入口验证；`test:pack` 只做 JavaScript 运行时导入检查。
- 发现（附加缺陷）：消费者类型测试暴露出发布产物的 `dist/index.d.ts` 实际非法——`vite-plugin-dts` 的 `rollupTypes`（api-extractor）沿 tsconfig `paths`/`baseUrl` 解析到源码 `.ts` 并内联方法实现体（`ae-wrong-input-file-type`），含语法错误 `case "polygon": :`，消费者 `tsc` 直接报 `TS1129`。
- 方案：`pack-smoke.mjs` 临时消费者目录加入 TypeScript，从 `arc3dlab` 与 `arc3dlab/engine-cesium` 导入公共类型并执行 `tsc --noEmit`；同时修复声明打包链路——`vite.config.ts` 只生成逐文件 `.d.ts`，由 `scripts/rollup-dts.mjs`（`npm run build` 末步）先规范化 `.ts` 引用，再用 `@microsoft/api-extractor` + `tsconfig.rollup.json`（`baseUrl: ./dist`）打包为 `dist/index.d.ts` / `dist/engine-cesium.d.ts`。
- 验收：仅依赖 tarball 的消费者项目通过类型检查；破坏类型导出或子路径时失败；`dist/index.d.ts` 不含实现体、`.ts` 引用或 `import('src')`。
- 状态：DONE（消费者 `tsc --noEmit` 通过；声明打包缺陷已修复，`npm run build && npm run test:pack` 验证）

### [x] P2-02 加强公共导出门禁，避免基于字符串出现即判定通过

- 问题：`checkPublicExports()` 用正则检查名称是否出现，无法证明是正确 `export`，也不覆盖全部值/类型导出。
- 方案：使用 TypeScript Compiler API 解析根入口真实导出表，生成稳定 public API manifest；CI 比较 manifest 增删改。
- 验收：改为非导出、意外删除 type export 或改变子路径时门禁可检出。
- 状态：DONE（`release-gate.mjs` 使用 TS Compiler API 解析 `src/index.ts` 导出表，生成并比较 `scripts/public-api-manifest.json`）

### [x] P2-03 将 Vite、Vitest、TypeScript 的包别名配置收敛到单一来源

- 问题：同一批 `@arc3dlab/*` 路径映射分别维护在 `vite.config.ts` / `vitest.config.ts` / `tsconfig.json`。
- 方案：抽出共享别名来源 `scripts/package-aliases.mjs`，三方配置读取同一来源；增加一致性检查。
- 验收：新增内部 package 只需修改一个声明源；CI 可检测缺失别名与未知包目录。
- 状态：DONE（新增 `scripts/package-aliases.mjs`；`vite.config.ts` / `vitest.config.ts` 读取同一来源；`lint:exports` 的 `checkWorkspaceAliases` 校验 `tsconfig.json` 路径别名与包目录一致）

### [x] P2-04 明确包的 ESM-only 合同，或补齐 CommonJS 产物

- 问题：`exports` 只声明 `types` 与 `import`，`main` 指向 ESM；CommonJS `require()` 不在测试合同内。
- 方案：明确 ESM-only，在 README / COMPATIBILITY 说明支持范围与不支持 `require()` 的边界；`package.json` 移除误导性 `main`。
- 验收：包格式支持矩阵与 exports map 一致。
- 状态：DONE（`README.md` 与 `COMPATIBILITY.md` 增加 ESM-only 说明；`package.json` 移除 `main`）

### [ ] P2-05 为稳定分支/发布分支设置保护与必需状态检查

- 说明：属于 GitHub 仓库设置，无法由代码仓库内改动完成。
- 建议：默认分支与 release 分支启用 PR 合并、CI 必需检查、分支最新状态检查。
- 状态：DEFERRED（需仓库管理员在 GitHub 设置中启用）

### [x] P2-06 修正整改文档中的状态标记和基线信息

- 问题：`.monkeycode/docs/SDK整改与优化清单.md` 状态列写 `DONE` 但复选框仍为 `[ ]`；基线仍引用旧提交 `2dbd41b`。
- 方案：以复选框为唯一状态来源，完成项勾选 `[x]`；更新基线提交、审阅日期与重新验证结果。
- 状态：DONE（复选框与状态列一致；基线更新为本次审阅提交）

## 3. P3：路线图与可选优化

### [x] P3-01 对主线程分析任务建立性能分级与 Worker 迁移路线
- 方案：在 `docs/architecture/03-engine.md` 增加“多引擎路线图（非当前 API 合同）”，在 `packages/analysis/src/worker-host.ts` 补充真实 Web Worker 迁移的约束（可结构化克隆/Transferable、取消语义、跨线程错误序列化）。
- 验收：文档与代码注释明确标注为路线图、非当前合同，并列出落地前置条件。
- 状态：DONE（路线图已记录，无落地时间表）

### [ ] P3-02 为公共管理器补充统一的只读诊断和异常聚合约定
状态：DEFERRED（路线图项）
- 方向：为 `ToolRegistry`、`PluginManager`、`AnalysisTaskRegistry` 等公共管理器定义统一的只读诊断快照约定（如 `diagnostics(): readonly ...`），冻结返回值并集中错误聚合结构，避免各自为政。
- 暂缓原因：属于跨包 API 约定，需先在设计文档评审后统一落地，避免破坏现有合同。

## 4. 建议整改顺序

1. 运行时正确性：P1-01 插件并发归属、P1-02 工具激活/注销、P1-03 scope 状态、P1-04 任务取消、P1-05 输入快照。
2. 异常路径：P1-06 初始化回滚 + 故障注入测试。
3. 架构承诺：P1-07 Cesium-first。
4. 发布合同：P2-01、P2-02、P2-03、P2-04。
5. 分支与文档治理：P2-05、P2-06。
6. 路线图：P3-01、P3-02。
