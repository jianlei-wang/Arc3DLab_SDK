# Requirements Document

Feature Name: cesium-style-api-docs
Updated: 2026-10-10

## Introduction

Arc3DLab SDK 需要一个自动生成的 API 参考文档站。该文档站要在**框架与形式**上严格对齐 CesiumJS 官方参考文档（https://cesium.com/learn/cesiumjs/ref-doc/），覆盖全部 13 个 `packages`，并以统一的中文 TSDoc/JSDoc 注释规范作为内容来源。核心目标：消费者看到的 API 文档在导航分类、页面结构、参数/返回值/异常/示例呈现、源码链接、类型交叉引用等维度与 Cesium ref-doc 同形。

## Glossary

- **文档系统（Doc System）**：生成 API 站点的一整套脚本、模板、样式与校验工具。
- **API 模型（API Model）**：从 TypeScript 源码提取、归一化后的中间文档数据（分类、符号、成员、方法、参数、返回、异常、示例、源码位置）。
- **公共入口（Public Entry）**：包对外导出符号的入口文件，即 `packages/*/src/index.ts` 与顶层 `src/index.ts`。
- **公共符号（Public Symbol）**：从公共入口可导入的类、接口、类型别名、枚举、函数、变量。
- **Cesium ref-doc 形式**：`https://cesium.com/learn/cesiumjs/ref-doc/` 使用的页面结构，包括侧边栏分类索引、`ClassName.html` 页面、`new X(...)` 构造签名与源码链接、`Name|Type|Description` 参数表、Throws、`dl.details`（Example / Demo / See / Default Value / Since / Deprecated）、Members / Methods 分区、`readonly` 与 `optional` 标记、`.param-type` / `.type-signature` 等标记与样式类。
- **正文**：文档页面中解释性文字，使用中文；标识符、类型名、代码、签名保持英文。
- **TSDoc**：TypeScript 源码中的文档注释（JSDoc 语法），字段包含 `@param` / `@returns` / `@example` / `@throws` / `@see` / `@defaultValue` / `@since` / `@deprecated`。

## Requirements

### Requirement 1：全包 API 提取

**User Story：** AS 文档维护者, I want 文档系统从所有包的公共入口提取 API 模型, so that 13 个包的公开能力都能被文档覆盖。

#### Acceptance Criteria

1. The 文档系统 SHALL 从 `packages/*/src/index.ts` 与顶层 `src/index.ts` 提取 API 模型。
2. The 文档系统 SHALL 仅收录从公共入口可达的公共符号。
3. IF 某个包缺少公共入口文件，THEN the 文档系统 SHALL 跳过该包并在生成报告中记录该包名称。
4. The 文档系统 SHALL 按符号类别与名称产生稳定的排序结果。
5. The 文档系统 SHALL 为每个公共符号保留源码文件路径与行号。

### Requirement 2：Cesium ref-doc 站点框架

**User Story：** AS SDK 消费者, I want 文档导航与页面组织与 Cesium ref-doc 一致, so that 我能用熟悉的方式浏览 API。

#### Acceptance Criteria

1. The 文档系统 SHALL 在首页与侧边栏按类别分组展示符号：Classes、Interfaces、Type Aliases、Enumerations、Functions、Variables、Namespaces。
2. The 文档系统 SHALL 为每个公共符号生成独立页面，且页面文件名与 Cesium 形式一致（类为 `ClassName.html`）。
3. The 文档系统 SHALL 提供覆盖全部符号的搜索入口。
4. The 文档系统 SHALL 在 `styles/jsdoc-default.css` 与 `styles/prism.css` 两个路径提供页面样式与代码高亮样式。
5. The 文档系统 SHALL 在每个符号页面顶部展示符号名称、签名与源码链接。

### Requirement 3：类与接口页面形式

**User Story：** AS SDK 消费者, I want 类页面结构与 Cesium ref-doc 相同, so that 我能快速定位构造参数、成员与方法。

#### Acceptance Criteria

1. The 文档系统 SHALL 以 `new <Namespace>.<Name>(<必选参数>, <可选参数>)` 形式展示类的构造签名。
2. The 文档系统 SHALL 为构造签名提供源码链接。
3. The 文档系统 SHALL 将构造函数与方法的参数渲染为 `Name|Type|Description` 三列表格。
4. The 文档系统 SHALL 为可选参数追加 `optional` 标记。
5. The 文档系统 SHALL 渲染 Throws 列表，并标注每个异常的类型与说明。
6. The 文档系统 SHALL 渲染 `dl.details` 区块，并在存在时展示 Example、Demo、See、Default Value、Since、Deprecated。
7. The 文档系统 SHALL 渲染 Members 分区，成员展示类型签名并在只读时追加 `readonly` 标记。
8. The 文档系统 SHALL 渲染 Methods 分区，方法展示签名、参数表、Returns 表与 Throws。
9. The 文档系统 SHALL 使用与 Cesium ref-doc 相同的结构类名与容器类名（如 `container-overview`、`nameContainer`、`params`、`subsection-title`、`type-signature`、`param-type`）。

### Requirement 4：类型与交叉引用

**User Story：** AS SDK 消费者, I want 类型名称可点击跳转, so that 我能沿类型关系理解 API。

#### Acceptance Criteria

1. WHEN 页面中出现指向已知符号的类型名, THE 文档系统 SHALL 将其渲染为到该符号页面的链接。
2. The 文档系统 SHALL 以 Cesium 形式表达联合类型与数组类型（如 `A | B`、`Array.<T>`）。
3. The 文档系统 SHALL 为枚举生成取值表并标注默认取值。
4. The 文档系统 SHALL 在命名空间（包）页面聚合属于该包的符号。

### Requirement 5：源码注释规范

**User Story：** AS SDK 维护者, I want 公共 API 注释遵循统一规范, so that 文档内容完整且一致。

#### Acceptance Criteria

1. The 公共导出 SHALL 携带中文 TSDoc 摘要。
2. The 公共方法 SHALL 在适用时携带 `@param`、`@returns`、`@example`、`@throws`、`@see`、`@defaultValue`、`@since`、`@deprecated`。
3. The 注释标签 SHALL 遵循 Cesium 约定顺序：摘要 → `@param` → `@returns` → `@throws` → `@example` → `@see` → `@since` → `@deprecated`。
4. The 文档系统 SHALL 校验公共导出的摘要覆盖率与参数注释覆盖率。
5. IF 覆盖率低于配置阈值，THEN the 文档系统 SHALL 以非零退出码结束。

### Requirement 6：构建、预览与集成

**User Story：** AS SDK 维护者, I want 通过固定命令生成与预览文档, so that 文档随代码同步更新。

#### Acceptance Criteria

1. The 文档系统 SHALL 通过 `npm run docs:build` 生成静态站点。
2. The 文档系统 SHALL 将产物输出到仓库内的固定目录。
3. The 文档系统 SHALL 通过 `npm run docs:preview` 提供本地预览。
4. The CI SHALL 在门禁中执行文档构建与文档覆盖率校验。
5. The 文档站产物 SHALL 不进入 npm 发布包与运行时 bundle。

### Requirement 7：一致性与可维护性

**User Story：** AS SDK 维护者, I want 文档与公共合同保持一致, so that 文档不会偏离实际导出。

#### Acceptance Criteria

1. The 文档系统 SHALL 使文档分类与公共 API 导出集合一致。
2. The 文档系统 SHALL 在相同输入下产生相同输出。
3. The 文档系统 SHALL 在生成报告中列出未文档化或注释不完整的公共符号。
4. WHEN 公共 API 发生变更, THE 文档系统 SHALL 在下次生成时反映该变更。
