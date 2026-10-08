# 工程化

Updated: 2026-10-08

## 构建

Vite library mode + TypeScript + `vite-plugin-dts`。主产物为 ESM。UMD 降为可选 legacy bundle。

## 包版本

- 当前发布：单一包 `arc3dlab`
- 内部包：`@arc3dlab/core` 等，`private: true`
- Cesium peer：`1.146.0`
- Active 矩阵：Arc3DLab 1.0.x + Cesium 1.146.0

## 许可证

源码 `LICENSE` 为 GNU GPL v2。`package.json` 与 README 必须与 `LICENSE` 文件一致，使用 `GPL-2.0-only`。

CesiumJS 采用 Apache-2.0，第三方底图、示例数据需要在 `NOTICE.md` 声明。

## 测试

- Unit：core 的 EventBus / Lifecycle / Registry / ID
- Integration：Arc3DApp destroy 回收
- 后续 E2E：Playground 关键路径

开发命令、即时测试、预览、API 文档生成和 npm 发布步骤见 `docs/guides/sdk-development.md`。
