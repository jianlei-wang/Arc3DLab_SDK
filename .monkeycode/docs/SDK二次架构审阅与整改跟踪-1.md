# Arc3DLab SDK 二次架构审阅与整改跟踪

> 审阅对象：`jianlei_wang` 分支  
> 审阅基线：[`d6b4c616ddcf82e86adb004304c5d8f295302c9f`](https://github.com/jianlei-wang/Arc3DLab_SDK/commit/d6b4c616ddcf82e86adb004304c5d8f295302c9f)  
> 前一基线：[`c762b9cb38481975e580663bda6e4547c6b9b38b`](https://github.com/jianlei-wang/Arc3DLab_SDK/commit/c762b9cb38481975e580663bda6e4547c6b9b38b)  
> 本文性质：基于仓库源码、配置、测试和最新 GitHub Actions 结果的静态复核；未在本会话中重新克隆仓库并手动运行浏览器/性能压测。

## 1. 总体结论

**上一轮整改已经取得明显进展，但不能认为所有问题都已完全处理。** 最新提交已引入插件/工具关键操作串行化、插件作用域状态同步、初始化失败回滚、分析任务协作式取消与快照、公共 API manifest、workspace alias 校验，以及打包后的 JavaScript/TypeScript 消费测试。上一轮提出的绝大多数结构性问题已在代码或文档中得到落实。

截至本次审阅基线，GitHub Actions 的最新工作流运行 [`38230597134`](https://github.com/jianlei-wang/Arc3DLab_SDK/actions/runs/38230597134) 中，`gate`、`guide`、`docs`、`e2e` 四个 job 均成功。`gate` job 的类型检查、覆盖率测试、依赖/导出/许可证/API 门禁、依赖审计、文档构建、格式检查、SDK 构建、包体积和 npm pack 消费测试均通过。这是良好的工程质量信号，但自动化通过并不等于所有并发时序、异常清理和数据隔离场景均已覆盖。

**建议当前结论：可继续迭代，不建议把整改状态标成“全部完成”。** 下一轮发布前，优先补齐以下 P1 风险：

1. `Arc3DApp.destroy()` 与正在进行的插件异步安装之间存在竞态窗口。
2. 资源注册表清理遇到一个资源的 `destroy()` 抛错后，可能中断剩余资源清理。
3. 分析任务的 `inputSnapshot` / 任务注册表仍存在嵌套引用共享，外部代码可能间接修改登记中的任务数据。
4. Ion Token 作用域对无 token 的调用绕过串行队列，在其他临时 token 生效期间可能并发执行。
5. 插件 owner 依赖跨 `await` 保持的全局活动状态，队列无法隔离所有非 PluginManager 发起的直接注册操作。

此外，`DataCatalog` 的注册事务与数据引用语义、插件资源所有权、公共 API 合同的签名级变更检测、发布脚本的直接依赖声明也值得继续完善。

## 2. 上一轮清单逐项复核

状态定义：

- **已解决**：从当前代码/配置/测试可确认核心整改已经落实。
- **部分解决**：主体方案已实现，但仍存在明确的边界、健壮性或验证缺口。
- **按设计关闭**：在当前明确的架构决策下不是缺陷，但原先更宽泛的目标不再承诺。
- **需补充验证**：实现已存在，但当前证据不足以证明全部语义正确。

| 编号 | 原整改主题 | 当前判断 | 复核意见 |
|---|---|---|---|
| P0-01 | Engine 适配器与可注入边界 | **按设计关闭** | 架构文档现已明确采取 Cesium-first：`Engine` 是内部生命周期/能力接缝，不承诺当前就支持任意渲染后端。该决策合理，但不能将它描述成已完成多引擎可替换架构。见 [`00-index.md`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/docs/architecture/00-index.md)。 |
| P0-02 | Ion Token 全局状态并发串扰 | **部分解决** | 有 token 的任务会排队并恢复全局值；但 `run(undefined, work)` 会直接执行，不参与队列。在另一项任务临时覆盖 `Cesium.Ion.defaultAccessToken` 时，无 token 任务仍可能同时使用该临时值。见 P1-D。 |
| P0-03 | CapabilityRegistry 与真实引擎能力一致 | **已解决** | 后端能力通过 `Engine.hasCapability()` 判断，不再仅按静态能力清单宣称可用。建议后续让核心能力清单只读，避免公开数组/记录被调用方运行时修改。 |
| P0-04 | 插件卸载异常清理 | **部分解决** | `PluginManager` 已串行化 `use/uninstall`，清理命令、工具和能力时也会收集错误；但 `destroy()` 未与队列形成完整关闭屏障，插件异步安装与应用销毁竞态仍可能漏清理；跨 `await` 的全局 owner 仍可能误归属外部直接注册。通用图形/图层/任务资源也不是自动按插件归属回收。 |
| P1-01 | AnalysisWorkerHost 名称与真实 Worker 语义 | **已解决（明确限制）** | 主线程实现现称 `AnalysisJobHost`，文档明确尚未启动真实 Worker；真实 Worker 被标为路线图。只要 API 文档不让消费者误以为任务一定运行在独立线程，该整改成立。 |
| P1-02 | ToolRegistry 状态机及注销 | **主体已解决** | 激活、停用、注销经队列串行化；按插件注销会继续处理其他工具并聚合错误。仍建议增加“工具激活中插件卸载/应用销毁”的竞态测试，并明确注册操作能否与关闭流程并发。 |
| P1-03 | 插件依赖、命名空间和注册归属 | **主体已解决** | `requiresCapabilities` 与 `dependsOnPlugins` 分开；安装队列避免并发安装覆盖当前 owner，注册时由当前作用域覆盖自报 owner。应用销毁竞态仍需另行修复。 |
| P1-04 | Command 参数 Schema | **已解决** | 已有参数模式及其单测。建议持续保留 `NaN/Infinity/null/嵌套对象/额外字段` 等边界用例，避免后续 schema 扩展回退。 |
| P1-05 | 空间参考、高程基准和单位语义 | **已落地，需领域验证** | 已有相关类型与输入约束。类型/语义合同存在不等于全部空间算法已达到测绘精度；投影转换、跨日期变更线、多边形环、垂直基准和极端纬度等应另有算法级测试。 |
| P1-06 | Layer/DataAsset/Feature/Graphic 语义边界 | **部分解决** | 类型和目录已存在，但 `DataCatalog` 直接存储并返回传入对象；`registerAsset()` 可能先写入资产再因 schema 冲突抛错，留下部分状态。见第 4 节。 |
| P1-07 | 统一 AnalysisTask/AnalysisResult 合同 | **部分解决** | 已加入协作式取消、输入快照和注册表防御性读取，但 `add()` 仍存储调用方原对象，且任务输入快照与最终结果存在共享引用；取消也不是对任意未配合的异步操作进行强制中断。见第 4 节。 |
| P1-08 | 浏览器/WebGL E2E | **已解决（当前覆盖范围内）** | 最新 CI 的 Playwright job 成功，当前主链路覆盖创建、图形、拾取、分析、销毁和重建等场景。当前主要为 Chromium/单条集成主路径，尚不能据此推断跨浏览器、复杂真实服务和长时间运行均已验证。 |
| P1-09 | Runtime ready 与资源 ready 语义 | **已解决** | 运行时 facade 就绪与底图/地形/数据资源就绪已区分，并提供场景 ready 状态路径。 |
| P1-10 | Bloom/Blur API 语义 | **按上一轮实现结果关闭** | 前一轮代码与测试已针对 Bloom 语义修正；当前 CI 通过。后续仍应保留启用、改参、停用、重复启用和销毁的状态组合测试。 |
| P1-11 | 公共 API 类型白名单 | **部分解决** | 根入口增加了 `public-api-manifest.json` 与导出门禁，但该 manifest 主要比较符号名称，不能检测类型签名/类成员的兼容性变化；`arc3dlab/engine-cesium` 子路径没有同等细粒度的 API manifest。 |
| P1-12 | 领域插件样板从产品代码中分离 | **已解决** | 示例位于 `examples/domain-plugins/`，测试 harness 位于 fixtures，符合 SDK 与领域扩展分离的目标。 |
| P1-13 | 诊断对象与异步可观测性 | **主体已解决** | 已有统一诊断能力。建议将清理失败、仍在运行的插件安装、未终止的任务/监听器纳入可定位的诊断信息和销毁验收。 |
| P2-01 | 包管理器配置一致性 | **已解决** | 仓库明确 npm 为规范包管理器，保留 `pnpm-workspace.yaml` 的原因也有注释说明。 |
| P2-02 | format:check 覆盖主要源码 | **已解决** | 格式检查已覆盖主要 TS、脚本、测试和配置文件。 |
| P2-03 | 拆分过大的聚合源文件 | **已解决** | graphics/layers/scene 已拆为职责模块，入口主要负责导出。 |
| P2-04 | 静态资源与包体积 | **已解决（门禁层面）** | 已有 bundle 基线、资源外置与体积门禁，最新 CI 通过。建议后续按主要功能域继续观察实际消费者加载体积。 |
| P2-05 | 开发预览与库构建配置隔离 | **已解决** | 根 Vite 配置聚焦库构建，演示应用独立配置。 |
| P2-06 | Legacy Viewer 兼容映射与废弃计划 | **已解决** | 已有 legacy 适配层和迁移文档。 |
| P2-07 | 架构文档、API 合同、测试同步 | **主体已解决** | 文档体系完整度明显提升；但根 `CHANGES.md`、架构目录中的 `CHANGELOG.md`、贡献指南里对 `CHANGELOG.md` 的泛称仍建议统一说明，降低维护者更新错文件的概率。 |
| P2-08 | 发布质量门禁 | **CI 已解决；本地快捷门禁仍有差别** | CI 包含 audit、build、bundle、pack、E2E 和文档构建。但 `npm run gate` 本身没有覆盖全部 CI 检查；要避免维护者误以为本地 `gate` 与发布 CI 完全等价。 |
| P2-09 | 兼容矩阵与 SemVer | **已解决** | 已有 Cesium/Node 兼容矩阵和公共 API 的版本策略。 |
| P2-10 | 许可证与分发策略 | **已解决（工程声明层面）** | 许可证文件、NOTICE 与打包门禁已建立。商业闭源集成场景仍应由项目所有方根据实际分发形态做合规判断。 |
| D-01 | 通用数据语义 | **部分解决** | 数据资产/图层/要素引用类型已落地，但可变引用和注册事务问题影响数据目录作为稳定共享语义层的可靠性。 |
| D-02 | 统一任务与结果语义 | **部分解决** | 任务状态与结果合同已建立，但深层引用隔离和取消语义仍需补强。 |
| D-03 | 插件合同与领域模型分离 | **已解决** | 有独立示例插件，新增领域样例不需修改 core。 |

## 3. P1：下一轮建议必须处理

### P1-A. 插件异步安装与 `Arc3DApp.destroy()` 竞态

**位置：** [`packages/sdk/src/plugins.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/sdk/src/plugins.ts)、[`packages/sdk/src/Arc3DApp.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/sdk/src/Arc3DApp.ts)

`use()` 已进入串行队列后，`performUse()` 会执行 `await plugin.install(...)`；插件只有在 `install()` 返回后才写入 `this.plugins`。与此同时，`destroy()` 会立即基于当前 `this.plugins.keys()` 取快照并卸载。若某个插件仍在异步安装、还未进 Map，`destroy()` 可能看不到它；应用随后销毁管理器/引擎，安装 Promise 之后仍可能继续并将插件登记为 `installed`。`performUse()` 在 `await plugin.install()` 后没有再次检查 Runtime 是否已进入 `destroying/destroyed`，也没有以统一的终止屏障阻止安装提交。

**建议整改：**

- 引入 `PluginManager` 的终态标识，例如 `closing/closed`；一旦开始销毁，同步拒绝新的 `use()`。
- 将 `destroy()` 本身作为队列中的终止操作处理，不能仅对当前插件 Map 做快照后逐项 enqueue。
- `plugin.install()` 返回后，在提交为 `installed` 前再次检查 manager 与 Runtime 的状态；若应用已销毁，执行回滚（`uninstall`、关闭 scope、移除扩展），不允许完成注册。
- 明确插件初始化可否无限等待；对于可能卡住的插件，考虑向 install contract 传递 `AbortSignal` 或支持可配置超时，但不要在未真正中止时谎报已取消。

**验收测试：**用 deferred Promise 暂停 `install()`，先调用 `app.destroy()`，再放行安装；必须保证 `destroy()` 完成后插件列表、scope、commands、tools、capabilities、资源注册表均无残留，且不会在 Viewer 已销毁后继续产生副作用。另需覆盖 `uninstall()` 与 `destroy()` 并发、重复 destroy 和插件依赖逆序卸载。

### P1-B. `ResourceRegistry.clear()` 必须具备“单项失败、继续清理”的保证

**位置：**[`packages/core/src/resource.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/core/src/resource.ts)、[`packages/sdk/src/Arc3DApp.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/sdk/src/Arc3DApp.ts)

`ResourceRegistry.clear()` 遍历资源并直接调用 `item.destroy()`。如果其中一个资源的 `destroy()` 抛错，递归遍历可能被中断，剩余兄弟资源不会尝试销毁，末尾的 `items.clear()` 与 `tracker.clear()` 也不会执行。`Arc3DApp.runDestroyStep()` 只能捕获这次整体调用的错误，无法使被中断的 `clear()` 从中间恢复，因此在 `destroy()` 后仍可能残留 JS 注册记录或资源关系。

**建议整改：**

- `clear()` 内部对每个资源的销毁分别 try/catch；收集错误后继续清理所有节点。
- 用 `finally` 保证 Registry/Tracker 状态最终清空；清理错误通过 logger 或聚合错误返回，不应阻止其余资源回收。
- 明确 `remove()` 在原生销毁失败时的合同：是仍然解除注册并把错误上报，还是保留待重试句柄。不能出现无记录的“孤儿资源”。
- 同样检查 `ResourceTracker.childrenOf()` 暴露内部数组的问题，返回只读或防御性副本，避免调用方直接改写依赖关系。

**验收测试：**构造三个资源，其中一个销毁时抛错；断言三个 `destroy()` 都已尝试，Registry/Tracker 最终状态符合合同，并能读取全部销毁错误用于诊断。

### P1-C. 分析任务快照仍有深层引用泄漏

**位置：**[`packages/analysis/src/task.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/analysis/src/task.ts)

当前 `AnalysisTaskRegistry.add(task)` 仍执行 `this.tasks.set(task.id, task)`，传入对象直接成为内部数据。虽然 `get()/list()` 会尝试返回 `structuredClone`，但 `runAnalysisTask()` 中登记的 task 的 `input` 指向 `inputSnapshot`；成功结果又把同一个 `inputSnapshot` 直接返回给调用方。外部修改 `result.inputSnapshot.someField`，可能间接改到注册表里存储的 `task.input`。同样，`runner.report()` 中创建的 `progress` 对象同时传给 registry 与 `onProgress` 回调；回调可以修改它，从而污染登记状态。`cloneTask()` 在不能结构化克隆时只退化到浅拷贝，嵌套引用依然共享。

**建议整改：**

- Registry 的 `add()` 应复制后再存储，而不只是复制返回值；`update()` 应明确嵌套值是否允许共享。
- 在内部任务快照、`AnalysisResult.inputSnapshot`、`onProgress` 入参之间分配独立副本；对非可克隆输入，明确退化语义并产生警告，不应继续宣称具有隔离性。
- 对 `params` 快照同样记录 clone 失败；对于自定义 `snapshot` 的返回值，定义由 SDK 复制还是由调用方负责不可变。
- 考虑使用只读结果类型，并在运行时对可安全冻结的普通对象进行冻结；类型上的 `Readonly` 本身不能阻止 JS 调用方修改对象。
- 如果需要长期任务持久化，额外明确任务记录的版本化/序列化合同，不要把内部对象结构当作永久格式。

**验收测试：**分别变更最初传入的 `task`、`result.inputSnapshot`、`registry.get()` 返回对象、`onProgress` 的参数对象；这些外部修改都不得反向污染 registry 的内部快照。

### P1-D. Ion Token 作用域的无 token 分支也必须参与串行化

**位置：**[`packages/engine-cesium/src/ion.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/engine-cesium/src/ion.ts)

`SerialIonTokenScope.run()` 在 `token` 为空时直接 `return Promise.resolve().then(work)`，没有进入 `chain`。如果任务 A 调用 `run("token-a", workA)`，在 `workA` 尚未结束时，任务 B 调用 `run(undefined, workB)`，B 可以和 A 并发执行，并在窗口中观察到 A 临时写入的 `Cesium.Ion.defaultAccessToken`。这会重新引入跨请求凭据串扰，只是触发条件从“两个显式 token 并发”变为“显式 token 与未指定 token 并发”。

**建议整改：**所有 `run()` 调用都进入同一个串行队列；只有在 token 非空时才临时覆盖全局值。无 token 的任务排队等待前一个临界区恢复后，再以恢复后的全局值运行。若确有一种工作完全不依赖 Ion 全局状态，应把它作为独立的非 Ion 工作函数，而不是让通用 `IonTokenScope` 猜测是否安全。

**验收测试：**使用 deferred Promise 暂停 token A 临界区，再提交一个 `run(undefined, workB)`；断言 B 不会在 A 释放前启动，并且 B 观察到的是 A 之前的全局值。还应保留异常恢复、无 token 空闲时 passthrough 和三个以上任务交错测试。

### P1-E. 插件 owner 的全局活动状态仍不是完全隔离的注册上下文

**位置：**[`packages/sdk/src/plugins.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/sdk/src/plugins.ts)、[`packages/core/src/plugin-scope.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/core/src/plugin-scope.ts)、[`packages/core/src/commands.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/core/src/commands.ts)

`performUse()` 在调用插件 `install()` 前执行 `scopes.setActive(plugin.name)`，并一直保持到 `await plugin.install(...)` 完成。命令、工具、能力注册通过 owner provider 读取这个共享活动 owner。PluginManager 的队列只能阻止同一个 PluginManager 中其他 `use/uninstall` 插入；它不能阻止外部业务代码、应用事件回调或其他直接持有 `app.context` 的代码在这一期间调用公共注册表。因此，插件安装等待网络/异步任务时，其他代码注册的命令或工具也可能被错误归属给当前插件，随后随插件卸载而被删除。当前并发测试覆盖了两个插件安装互相交错，但因为第二次 `use()` 被队列阻塞，还没有覆盖“插件安装中由队列外代码直接注册”的情况。

**建议整改：**优先通过插件专属 facade/scope 注入显式 owner，例如插件拿到的 `scope.commands.register()`、`scope.tools.register()` 和 `scope.capabilities.register()` 自动绑定所有者；注册表核心方法接收显式 owner 并校验保留命名空间。避免以跨 `await` 的可变全局 `activeOwner` 作为唯一归属机制。若暂时保留 ambient owner，应限制或隔离 Runtime 内部注册表的外部访问，并给这项限制写入正式 API 合同。

**验收测试：**一个插件 install 暂停在 deferred Promise 上；此时从插件安装队列之外注册一个应用级命令/工具/能力；恢复并卸载该插件后，插件自己的扩展被移除，应用级扩展仍存在且 owner 正确。

## 4. P2：高收益的模型与工程化优化

### P2-A. 让 `DataCatalog` 注册行为具备事务性，并明确定义数据的可变性

**位置：**[`packages/core/src/catalog.ts`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/packages/core/src/catalog.ts)

`registerAsset()` 先把 asset 写入 `assets`，再调用 `registerSchema()`。当 schema ID 冲突时，方法会抛错，但 asset 已经留在目录中，形成“操作失败但状态部分提交”的情形。此外，`registerAsset/getAsset/listAssets`、schema 和 layer metadata 方法基本直接存储或返回原对象；调用方之后修改输入对象或读取结果的嵌套字段，会静默改变 Catalog 内部状态。这可能是有意的可变对象模型，但当前合同需要写清楚。

**建议整改：**先校验 asset/schema/layer 的全部约束，再一次性提交；或在提交失败时回滚。对外可选择以下一种合同并贯彻到底：

1. **不可变目录模型（推荐）**：输入时拷贝、对外返回快照、更新必须调用显式方法；或
2. **可变引用模型**：明文说明对象引用由 Catalog 与调用方共享，任何更新都必须通过 Catalog API，并为并发状态变更添加版本/锁定策略。

不要混合“看起来是 registry 的防御性接口”与“实际返回内部引用”的两套语义。

**验收测试：**重复 schema 导致 `registerAsset()` 失败后，asset 不得残留；对输入对象及 getter/list 返回值做嵌套修改时，结果必须符合已书面定义的合同。

### P2-B. 公共 API 门禁从“名称差异”升级到“签名差异”

**位置：**[`scripts/release-gate.mjs`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/scripts/release-gate.mjs)、[`scripts/public-api-manifest.json`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/scripts/public-api-manifest.json)、[`scripts/rollup-dts.mjs`](https://github.com/jianlei-wang/Arc3DLab_SDK/blob/d6b4c616ddcf82e86adb004304c5d8f295302c9f/scripts/rollup-dts.mjs)

现有 manifest 对根入口导出值/类型的符号名做差异检查，能够阻止许多意外新增或移除，但不能充分检测同名接口字段、方法参数、返回值、泛型约束或类成员的破坏性变化；同时 `arc3dlab/engine-cesium` 子路径没有独立的完整导出合同。打包消费测试覆盖了一组典型符号和类型，但它不可能枚举整个公共 API。

**建议整改：**

- 对根入口和 `./engine-cesium` 分别维护 API 报告/manifest。
- 考虑启用 API Extractor 的 API report，或对生成后的 `.d.ts` 做可审查的基线 diff；在 PR 中明确显示签名变化。
- 将公共 API 变更与 SemVer 规则关联：新增、弃用、删除、参数变更、返回值变更分别给出检查或审批路径。
- 保留真实 pack consumer 的 ESM 与 `tsc --noEmit` 测试；后续可增加 `exports` 路径的 `import`/类型 smoke，并对错误导入深路径设负面测试。

### P2-C. 插件 scope 需要统一管理插件创建的资源

当前 `PluginScope` 可以手动 `track(disposer)`，`PluginManager` 会在卸载时关闭 scope 并清理命令、工具、能力。但图形、图层、效果、数据任务等通用资源并未天然都带有插件所有者；如果插件开发者忘记 `scope.track(() => resource.destroy())` 或在 `uninstall()` 中手动清理，这些资源并不会仅因插件卸载而自动移除。

建议至少选一种策略：

- 通过 SDK 工厂 API 创建插件资源时，自动记录 owner 和 disposer；或
- 提供 `scope.addGraphic()/scope.addLayer()/scope.addTask()` 等受管理接口，并明确禁止插件直接创建未登记资源；或
- 明确“插件作者必须为每一个外部资源注册 disposer”的规范，并在诊断中暴露插件资源计数和销毁后的残留检查。

验收应包含：插件创建 graphic、layer、effect、事件监听器和分析任务，随后卸载插件；所有资源计数恢复到安装前状态。

### P2-D. 声明文件构建脚本应声明它直接使用的依赖

` scripts/rollup-dts.mjs ` 直接通过 `createRequire()` 加载 `@microsoft/api-extractor`，但根 `package.json` 的 `devDependencies` 中没有显式声明该包（它可能目前由其他工具的依赖间接带入）。构建脚本不应依赖未声明的传递依赖；升级 `vite-plugin-dts` 或调整 npm 依赖提升方式都可能令声明文件构建失效。

建议将 `@microsoft/api-extractor` 作为直接 devDependency 固定到已验证版本，并更新 lockfile；CI 继续在干净安装 `npm ci` 后执行 `npm run build` 与 `npm run test:pack`。同时检查 `build:watch` 当前只调用 `vite build --watch`，不会在每次声明文件变化后自动执行 `rollup-dts.mjs`；如团队依赖 watch 模式调试公共类型，应为它补充 watcher 或在文档中声明其不生成最终 rollup 声明。

### P2-E. 将本地 `gate` 与发布门禁的范围说清楚

CI 的 `gate` job 还有 `lint:audit`、`lint:size`、`test:pack`；独立 job 还运行 E2E、API 文档与指南构建。但 package script 的 `npm run gate` 并没有执行所有这些步骤。

建议将命令拆分为清楚的层次，例如：

- `gate:fast`：类型检查、单测、依赖边界、格式；
- `gate:release`：快门禁 + audit + API 文档/指南构建 + package build + size + pack smoke；
- CI 的浏览器 E2E 作为独立但必需的状态检查。

这样能避免开发者本地运行 `npm run gate` 通过后误以为与完整发布验证等价。

### P2-F. 补足 CI/仓库治理闭环

- 检查目标分支是否启用了必需状态检查、PR 合并策略和至少一项代码审阅；本次连接无法读取分支保护 API，因此不对当前保护状态作事实判断。
- 为公共 API、生命周期、资源注册表、插件安装/卸载等核心目录配置 `CODEOWNERS` 或等效责任归属。
- 对关键模块逐步抬升测试覆盖率阈值，优先按包设置阈值，而不是只设置全仓总阈值；覆盖率门槛需要逐步提高且不降低已有基线。
- 将 E2E 从单条 happy path 扩展到失败路径：底图加载失败、WebGL 初始化失败、插件初始化失败、重复创建/销毁、多个 SDK 实例、长时间任务取消等。
- 保留 bundle size 预算；另为大规模 Graphic、3D Tiles、地形采样、反复创建/销毁增加稳定基准测试或趋势报告。包体积小不代表帧率和显存可控。
- 统一根 `CHANGES.md`、`docs/architecture/CHANGELOG.md` 和贡献指南对变更日志的引用与用途，减少文档维护歧义。

## 5. 长期架构建议

### 5.1 Cesium-first 既然是明确决策，就应让抽象保持克制

当前 `docs/architecture/00-index.md` 已明确业务包可以直接依赖 Cesium，`Engine` 是内部生命周期/能力接缝，多渲染后端属于长期路线而非现有 API 承诺。这种产品策略是合理的：避免为了尚未确定的第二引擎提前设计过度泛化抽象。

建议下一阶段以以下原则约束演进：

- `core` 持续不依赖 Cesium、Vue/React；它是生命周期、错误、资源、数据语义与扩展协议的稳定底座。
- 业务功能包可以是 Cesium-first，但应避免在多个包中重复实现同样的 viewer 生命周期、资源清理、坐标转换、事件订阅和异步加载状态逻辑。
- 将未来确实可能替换的能力用窄接口抽离（例如资源创建、场景就绪、相机控制），不要仅为了“有一个 Engine 接口”就声称所有功能可跨引擎。
- 如果未来确实要接入第二个渲染引擎，应先选出一条端到端垂直能力（场景创建、点线面、拾取、销毁）验证，再逐步抽象，而不是一次性抽象所有 Manager。

### 5.2 稳定公共 API 与内部实现分层

- 主入口只导出有 SemVer 承诺的 API；`native`、底层 Viewer、具体引擎工具应继续有明确的 advanced/unstable 标识。
- 对 `Graphics/Layer/Data/Analysis` 的配置、结果、事件和错误分别定义稳定合同；内部实现对象不应通过返回引用无意暴露。
- `Legacy Viewer` 只保留迁移能力，应有可查询的弃用计划、每个旧方法的映射和最终移除版本。
- 避免用一个过于宽泛的 `Record<string, unknown>` 承载核心可校验合同；在扩展点保留开放字段，在稳定主路径采用可枚举语义类型。

### 5.3 统一资源、事件和异步操作合同

把以下内容视为一条完整的 Runtime 生命周期合同，而不是分别散落于每个 Manager：

- 所有创建方法返回可销毁句柄或注册过的资源 ID。
- 每个订阅都返回 disposer，且 disposer 幂等。
- 异步资源加载应支持取消、状态、错误归类和销毁后结果处理。
- 创建事务失败时回滚已创建资源；销毁事务中单项失败时继续完成剩余清理。
- 多次 create/destroy 与多实例并行运行不会共享不应共享的可变状态，尤其是 Ion token、事件、任务、工具和插件 owner。
- diagnostics 能证明所有监听器、插件 scope、资源注册、活动工具和未完成任务都已归零或列出残留原因。

### 5.4 可复用 GIS 算法的边界

空间运算尽量拆成纯 TypeScript 算法层，与 Cesium 场景读写分开：纯算法接受有明确坐标参考/单位的输入，返回可序列化结果；Cesium 层只负责采样、渲染、拾取和资源管理。算法测试应覆盖边界值、精度容差、无效几何、跨日期变更线、重复点/闭合环、空数据、超大采样量与取消路径。这能提高算法复用率，也为将来真正的 Worker 执行提供条件。

## 6. 推荐整改顺序和验收门槛

### 第一批：下次发布前

- [x] P1-A 插件 `install()` / Runtime `destroy()` 关闭屏障与竞态修复。
- [x] P1-B 资源注册表在单个 disposer 抛错时仍完成所有资源清理。
- [x] P1-C AnalysisTask 的深层快照和回调入参隔离。
- [x] P1-D Ion Token 无 token 分支纳入串行队列。
- [x] P1-E 插件 owner 通过作用域绑定 facade 显式注入。
- [x] 增加对应的回归测试并通过最新 CI 全部 job。

### 第二批：提升数据语义与发布合同

- [x] P2-A DataCatalog 注册事务和可变性合同。
- [x] P2-B 根入口与 `engine-cesium` 子路径的签名级 API 基线。
- [x] P2-C 插件拥有资源的自动回收（`PluginScope.manage()` 统一托管）。
- [x] P2-D 声明文件构建直接依赖 `@microsoft/api-extractor`。
- [x] P2-E 统一快速 gate 与 release gate 命令。

### 第三批：长期治理

- [ ] 核心模块分包覆盖率门槛逐步提升。
- [ ] E2E 增加初始化失败、清理失败、多实例、长任务取消和真实服务模拟。
- [ ] 性能预算覆盖渲染规模、分析负载、创建/销毁循环，不仅是 bundle size。
- [ ] 为目标分支启用必需状态检查与代码审阅策略，并明确 API、Runtime、渲染和 GIS 算法的代码责任人。
- [ ] 统一变更日志和贡献指南。

## 6.1 本轮整改执行记录

| 项 | 实现要点 | 证据 |
|---|---|---|
| P1-A | `PluginManager` 增 `closing/closed/destroyTask` 与 `shuttingDown`；`use()` 在关闭期同步拒绝；`performUse` 在 `plugin.install()` 返回后再次校验 manager 与 `lifecycle.isTerminating`，否则回滚；`destroy()` 作为队列终止操作。 | `packages/sdk/src/plugins.ts`、`tests/unit/plugin-shutdown.test.ts` |
| P1-B | `ResourceRegistry.clear()` 逐项 try/catch、聚合错误、`finally` 清空；`remove()` 先解除登记再销毁；`childrenOf/unlink` 返回防御性副本。 | `packages/core/src/resource.ts`、`tests/unit/core-runtime.test.ts` |
| P1-C | `AnalysisTaskRegistry.add()` 存副本并返回副本；`inputs/params` 走 `cloneInput` 并记录克隆失败警告；`onProgress` 传入独立副本。 | `packages/analysis/src/task.ts`、`tests/unit/analysis-task.test.ts` |
| P1-D | `SerialIonTokenScope.run()` 的无 token 分支同样进入串行 `chain`。 | `packages/engine-cesium/src/ion.ts`、`tests/unit/ion-token.test.ts` |
| P1-E | 新增 `ScopedCommandSpec/ScopedToolSpec/ScopedCapabilityRecord` 与 `PluginRegistrationBinding`；`PluginScope.registerCommand/registerTool/registerCapability` 显式绑定 owner；`PluginScopeManager.setBinding` 接线。 | `packages/core/src/plugin-scope.ts`、`packages/core/src/context.ts`、`tests/unit/plugin-owner-isolation.test.ts` |
| P2-A | `DataCatalog` 采用不可变快照模型：输入/输出均复制；`registerAsset()` 事务化（schema 冲突不残留资产）。 | `packages/core/src/catalog.ts`、`tests/unit/data-catalog.test.ts` |
| P2-B | `collectPublicSurface()` 生成根入口与 `./engine-cesium` 的签名基线；`diffManifest` 检测签名新增/移除/变更；manifest 含 `entries`。 | `scripts/release-gate.mjs`、`scripts/public-api-manifest.json`、`tests/unit/release-gate.test.ts` |
| P2-C | `PluginScope.manage(resource)` 统一托管插件创建的图形/图层/效果/任务等资源，卸载与安装回滚时自动、幂次销毁。 | `packages/core/src/plugin-scope.ts`、`tests/unit/plugin-managed-resources.test.ts` |
| P2-D | `@microsoft/api-extractor@7.59.4` 固定为直接 devDependency；`build:watch` 不生成最终 rollup 声明已在指南注明。 | `package.json`、`package-lock.json`、`docs/guides/sdk-development.md` |
| P2-E | 命令拆分：`gate:fast`、`gate:release`，`gate` 为 `gate:fast` 别名。 | `package.json` |

本记录对应基线 `d6b4c61` 之后的整改提交；完整验证以 `npm run gate:release` 与 CI 全部 job 通过为准。

## 7. 本轮审阅边界

本轮确认了仓库分支的最新提交、关键实现文件、测试文件与最新 CI job/step 结果；没有本地重新执行项目，也没有执行针对 GPU/显存/长时间会话的压测。当前发现的三个 P1 项是根据源码控制流和对象引用关系识别的风险，应优先补成可复现测试，再据测试结果修改实现。对空间算法的测绘级精度、不同浏览器的 WebGL 行为和实际生产数据源的健壮性，仍需专项验证，不能仅凭 CI 全绿下结论。
