# Contributing to Arc3DLab

Arc3DLab 是模块化 3D WebGIS Runtime。贡献代码前请先阅读 `docs/architecture/`。

## 架构原则

1. `core` 独立于 Cesium。
2. `core` 独立于 Vue / React。
3. 公共 API 使用明确类型，禁止 `any`。
4. 只使用 Cesium 公开 API。
5. 模块加载过程保持无副作用。
6. Token 由运行时配置注入，源码默认配置只允许占位符。
7. 所有 SDK 创建的资源都能回收。
8. 异步 API 必须声明 `Promise<T>`。
9. Layer 与 Graphic 分离。
10. 数据描述与渲染后端分离。
11. 插件通过 Plugin / Capability API 扩展。
12. 稳定公共 API 必须有自动化测试。

## 设计迭代与变更记录

先更新设计文档与变更记录，再改代码。三类文档职责不同，勿混用：

- `docs/architecture/`：设计文档，描述各模块的当前合同与实现状态。
- `docs/architecture/CHANGELOG.md`：设计迭代日志，按日期记录架构、合同与质量门禁的变更，面向 SDK 维护者。
- `CHANGES.md`：发布变更日志，按版本记录 `Breaking Changes` / `feat` / `fix`，面向 SDK 使用者。

仅当改动影响公共 API、运行时合同、门禁或使用者可感知行为时，才需要同时更新迭代日志与发布日志。

## 开发命令

```bash
# 安装依赖
npm install

# 单元测试
npm test

# 构建 ESM 与类型声明
npm run build
```

日常命令、即时测试、预览、API 文档和发布步骤见 `docs/guides/sdk-development.md`。
