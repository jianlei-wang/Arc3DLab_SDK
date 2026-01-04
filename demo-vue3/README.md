# Arc3DLab SDK Vue3 示例

本项目演示了如何在 Vue3 项目中使用 Arc3DLab SDK。

## 开发说明

如果您正在开发 Arc3DLab SDK 并希望在此示例中测试本地构建的版本，请按以下步骤操作：

1. 在项目根目录运行 `npm run build` 构建 SDK
2. 确保 `vite.config.ts` 中的别名配置正确指向本地构建文件
3. 运行 `npm run dev` 启动开发服务器

## 本地开发工作流程

在主项目中使用以下命令：

```bash
# 开发监听模式 - 自动监听文件更改并重新构建
npm run dev:watch
```

然后在本项目中运行：

```bash
npm run dev
```

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
