# 需求实施计划

Feature Name: developer-guide
Updated: 2026-10-11

- [x] 1. 指南站基础设施
  - [x] 1.1 安装 `vitepress` 开发依赖
  - [x] 1.2 新增 `guide/.vitepress/config.mts`（标题、nav、sidebar、outline、allowedHosts）
  - [x] 1.3 新增 `guide/.vitepress/theme/index.ts` 与 `PeerLinks.vue`（顶栏互链）
  - [x] 1.4 新增 `guide/index.md` 首页
  - [x] 1.5 `.gitignore` 忽略 `guide/.vitepress/dist` 与 `cache`

- [x] 2. 指南章节（全覆盖）
  - [x] 2.1 简介 / 快速开始 / 环境与安装
  - [x] 2.2 运行时：创建 / 就绪 / 生命周期 / 错误
  - [x] 2.3 相机与导航
  - [x] 2.4 场景：模式 / 时钟与环境 / 性能
  - [x] 2.5 影像与地形：底图 / 影像 / 地形
  - [x] 2.6 图层与数据：图层 / 3D Tiles / 数据目录 / 提供者
  - [x] 2.7 图形：点 / 线 / 面 / 模型 / 样式
  - [x] 2.8 交互与事件：拾取 / 选择 / 事件
  - [x] 2.9 空间分析：测量 / 地形 / 通视 / 查询 / 剖切 / 土方
  - [x] 2.10 特效与 UI：材质后处理 / 提示
  - [x] 2.11 插件系统
  - [x] 2.12 迁移：从 Viewer 迁移

- [x] 3. 脚本与 CI
  - [x] 3.1 `package.json`：`guide:dev` / `guide:build` / `guide:preview`
  - [x] 3.2 `.github/workflows/ci.yml` 新增 `guide` job 并上传产物
  - [x] 3.3 prettier 忽略 `guide/.vitepress/cache` 与 `dist`

- [x] 4. 预览
  - [x] 4.1 `guide:dev`（5175）本地预览
  - [x] 4.2 `guide:build` + `guide:preview`（5175）产物预览

- [x] 5. 文档与收尾
  - [x] 5.1 更新 `README.md` 文档地图
  - [x] 5.2 更新 `docs/guides/sdk-development.md` 过时命令（TypeDoc → 新文档体系）
  - [x] 5.3 更新 `docs/architecture/11-api.md` 与 `CHANGELOG.md` / `CHANGES.md`
  - [x] 5.4 构建与预览验证通过
