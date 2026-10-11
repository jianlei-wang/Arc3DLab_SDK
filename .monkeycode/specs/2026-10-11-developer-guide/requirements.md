# Requirements Document

Feature Name: developer-guide
Updated: 2026-10-11

## Introduction

Arc3DLab SDK 已有即时预览（Sandcastle，`demo-vue3`）与自动生成的 API 参考文档（Cesium 风格）。开发者仍缺少一份**面向使用者的开发指南**：以任务为主线，按场景组织，提供可复制的代码示例，帮助开发者从安装到完成常见三维 WebGIS 功能。本特性在 SDK 工程内建立开发指南站，形式对齐参考站 `https://app.larkview.cn/sdk-docs/`（顶栏导航、按类别分组的侧边栏、正文代码示例、页内目录、上下页导航），并支持本地与在线预览。

## Glossary

- **开发指南站（Guide Site）**：面向 SDK 使用者的文档站点，基于 VitePress 构建。
- **指南章节（Chapter）**：开发指南站中的一个 Markdown 页面，对应一个使用主题。
- **Sandcastle**：基于 `demo-vue3` 的即时场景预览，默认端口 `5173`。
- **API 文档站（API Docs）**：由 `scripts/api-docs` 生成、`api-docs/` 输出的参考文档，预览端口 `5174`。
- **顶栏互链（Nav Cross-link）**：开发指南站顶栏指向 Sandcastle 与 API 文档站的链接。
- **独立端口（Dedicated Port）**：开发指南站使用自己的端口（默认 `5175`）预览，与 5173/5174 并存。

## Requirements

### Requirement 1：指南站框架

**User Story：** AS SDK 使用者, I want 指南站具备与参考站一致的导航与页面框架, so that 我能按类别快速找到主题。

#### Acceptance Criteria

1. The 开发指南站 SHALL 基于 VitePress 构建，并作为工程内的独立目录维护。
2. The 开发指南站 SHALL 提供顶栏导航，包含指南首页、Sandcastle 与 API 文档入口。
3. The 开发指南站 SHALL 提供按类别分组的左侧边栏导航。
4. The 开发指南站 SHALL 为每个章节提供页内目录与上一页 / 下一页导航。
5. The 开发指南站 SHALL 在首页提供标题、简介、快速开始与 API 文档入口。

### Requirement 2：指南内容覆盖

**User Story：** AS SDK 使用者, I want 指南覆盖 SDK 的完整能力, so that 我能据此完成常见开发任务。

#### Acceptance Criteria

1. The 开发指南 SHALL 覆盖简介与快速开始，包含安装、创建应用与首个场景。
2. The 开发指南 SHALL 覆盖运行时能力：创建、就绪、生命周期、错误处理。
3. The 开发指南 SHALL 覆盖相机与导航、场景模式、时钟与环境、性能监控。
4. The 开发指南 SHALL 覆盖影像、地形、图层与数据。
5. The 开发指南 SHALL 覆盖图形（点 / 线 / 面 / 模型）与样式。
6. The 开发指南 SHALL 覆盖交互与事件、空间分析、特效与 UI、插件扩展、迁移。
7. The 开发指南中的代码示例 SHALL 与实际公共 API 一致。

### Requirement 3：构建与预览

**User Story：** AS SDK 维护者, I want 通过固定命令构建与预览指南, so that 指南可随代码同步上线。

#### Acceptance Criteria

1. The 开发指南站 SHALL 通过固定 npm script 启动本地开发预览。
2. The 开发指南站 SHALL 通过固定 npm script 构建静态产物到仓库内目录。
3. The 开发指南站 SHALL 通过固定 npm script 预览构建产物。
4. The 开发指南站 SHALL 在开发服务器配置允许预览域名（`.monkeycode-ai.online`）。
5. IF 处于在线预览环境的兄弟端口形态，THEN the 开发指南站 SHALL 通过运行时计算指向 Sandcastle 与 API 文档的正确地址。

### Requirement 4：集成与一致性

**User Story：** AS SDK 维护者, I want 指南与既有文档、CI 保持一致, so that 文档体系不漂移。

#### Acceptance Criteria

1. The CI SHALL 构建开发指南并上传其静态产物为构件。
2. The 构建产物与缓存目录 SHALL 不进入 npm 发布包。
3. WHEN 公共 API 变更, THE 开发指南 SHALL 在后续更新中同步相应示例。
4. The 开发指南 SHALL 被纳入工程文档地图（README 与架构文档）。
