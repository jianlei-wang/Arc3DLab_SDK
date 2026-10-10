# 需求实施计划

Feature Name: cesium-style-api-docs
Updated: 2026-10-10

- [ ] 1. 生成器基础设施
  - [ ] 1.1 改造 `typedoc.json`：13 个包入口 + 顶层入口，`entryPointStrategy: resolve`，关闭 HTML 主题输出
  - [ ] 1.2 新增 `scripts/api-docs/config.mjs`（分类顺序、阈值、repo base、输出目录）
  - [ ] 1.3 新增 `scripts/api-docs/extract.mjs`（调用 typedoc --json）
  - [ ] 1.4 新增 `scripts/api-docs/normalize.mjs`（reflection → DocsModel）
  - [ ] 1.5 新增 `scripts/api-docs/render/*`（html/comment/type/symbol/index）
  - [ ] 1.6 新增 `scripts/api-docs/build.mjs` 编排与 CLI
  - [ ] 1.7 新增 `scripts/api-docs/check.mjs` 覆盖率校验与 `report.json`

- [ ] 2. 主题与资源（Cesium 形式）
  - [ ] 2.1 原创 `theme/jsdoc-default.css` 复刻布局与结构类名
  - [ ] 2.2 vendored `theme/prism.css` + `theme/prism.js`（MIT）
  - [ ] 2.3 `theme/logo.svg`

- [ ] 3. 页面渲染
  - [ ] 3.1 `index.html` 首页 + 侧边栏（包命名空间 + 类别）
  - [ ] 3.2 命名空间（包）页面
  - [ ] 3.3 类/接口页面（构造签名、参数表、Members、Methods、Throws、details）
  - [ ] 3.4 类型别名 / 枚举 / 函数 / 变量页面
  - [ ] 3.5 类型交叉链接与 `global.html`

- [ ] 4. 脚本与 CI 接入
  - [ ] 4.1 `package.json`：`docs:extract` / `docs:build` / `docs:preview` / `lint:docs`，移除旧主题依赖
  - [ ] 4.2 `.github/workflows/ci.yml`：`gate` 加 `lint:docs`，构建 `api-docs` artifact
  - [ ] 4.3 `format`/`format:check` 纳入 `scripts/api-docs/**`

- [ ] 5. 源码 TSDoc 注释（13 个包）
  - [ ] 5.1 顶层 `arc3dlab` 与 `@arc3dlab/sdk` 公共导出
  - [ ] 5.2 `core`
  - [ ] 5.3 `engine-cesium`
  - [ ] 5.4 `scene` / `layers` / `graphics`
  - [ ] 5.5 `data` / `interaction`
  - [ ] 5.6 `analysis`
  - [ ] 5.7 `effects` / `ui` / `legacy`
  - [ ] 5.8 使公共导出摘要覆盖率与参数覆盖率达标

- [ ] 6. 测试
  - [ ] 6.1 `tests/unit/docs-normalize.test.ts`（夹具）
  - [ ] 6.2 `tests/unit/docs-render.test.ts`（形式/结构类名 + 快照）
  - [ ] 6.3 `tests/unit/docs-type.test.ts`（类型表达式与链接）
  - [ ] 6.4 链接完整性测试（内部 href 全部可解析）
  - [ ] 6.5 覆盖率门禁测试（缺注释 → 非零退出）

- [ ] 7. 文档与收尾
  - [ ] 7.1 更新 `docs/architecture/11-api.md`（指向新文档站入口）
  - [ ] 7.2 追加 `docs/architecture/CHANGELOG.md` 与 `CHANGES.md`
  - [ ] 7.3 `docs:build` + `gate` 全绿，人工对照 Cesium ref-doc 抽查
