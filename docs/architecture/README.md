# Arc3DLab SDK 设计迭代

本目录是 Arc3DLab SDK 的可迭代设计框架。代码实现以这里的模块边界、API 契约和演进路线为准。

## 如何迭代

1. 先改本目录中的对应设计文件，再改代码。
2. 每次设计变更在 `CHANGELOG.md` 追加一条记录：日期、变更点、影响模块。
3. 公共 API 变更同步更新 `11-api.md` 与 `docs/guides/migration.md`。
4. 原则变更必须同步 `01-principles.md` 与根目录 `CONTRIBUTING.md`。
5. 开发命令、即时测试、预览、API 文档和发布见 `docs/guides/sdk-development.md`。

## 文档地图

- `00-index.md`：产品定位与六层架构
- `01-principles.md`：架构依赖原则（Rule 1-12）
- `02-runtime.md`：Arc3DContext / Lifecycle / EventBus / Resource
- `03-engine.md`：Engine Adapter 与 CesiumEngine
- `04-scene.md`：Scene / Camera / Render / Clock
- `05-layers.md`：Layer / Basemap / Terrain / Tileset
- `06-graphics.md`：Graphic 领域模型与 RenderPolicy
- `07-data.md`：Data / Provider
- `08-interaction.md`：拾取、选择、指针事件
- `09-analysis.md`：测量与空间分析能力域
- `10-effects-ui-plugin.md`：特效、UI、插件、Capability
- `11-api.md`：稳定公共 API 与兼容层
- `12-engineering.md`：构建、测试、发布、许可证
- `13-migration.md`：旧目录到新模块映射
- `14-roadmap.md`：P0-P4 路线
- `CHANGELOG.md`：设计迭代日志
- `docs/guides/sdk-development.md`：SDK 开发、测试、预览、发布

## 代码映射

当前仓库采用内部模块边界优先、npm 边界随后的策略：

- 源码位于 `packages/*`
- 对外仍发布单一包 `arc3dlab`
- 主入口：`Arc3D.create()`
- 兼容入口：`Viewer`（Legacy Adapter）
