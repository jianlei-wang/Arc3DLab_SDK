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

## 设计迭代

先更新 `docs/architecture/` 对应文档和 `CHANGELOG.md`，再改代码。

## 开发命令

```bash
# 安装依赖
npm install

# 单元测试
npm test

# 构建 ESM 与类型声明
npm run build
```
