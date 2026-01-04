# Arc3DLab SDK 项目结构说明

## 项目概述
Arc3DLab SDK 是一个基于 Cesium 封装的 WebGIS 应用框架，提供了增强的 Cesium 功能和针对 3D 地理空间可视化的优化设置。

## 目录结构

```
Arc3DLab_SDK/
├── .git/                    # Git 版本控制目录
├── .gitignore              # Git 忽略文件配置
├── .prettierrc             # Prettier 代码格式化配置
├── CHANGES.md              # 项目变更记录
├── LICENSE                 # 项目许可证
├── LOG.md                  # 项目日志
├── README.md               # 项目说明文档
├── demo-html/              # HTML 示例项目目录
├── demo-vue3/              # Vue3 示例项目目录
├── docs/                   # 文档目录
├── package-lock.json       # NPM 包锁定文件
├── package.json            # 项目配置文件
├── rollup.config.js        # Rollup 打包配置
├── scripts/                # 构建脚本目录
│   └── generate-docs.js    # 文档生成脚本
├── src/                    # 源代码目录
│   ├── core/               # 核心功能模块
│   │   ├── EventEmitter.ts # 事件发射器类
│   │   ├── Viewer.ts       # 增强型 Cesium Viewer 类
│   │   └── index.ts        # 核心模块导出
│   ├── index.ts            # 主入口文件
│   ├── types/              # 类型定义目录
│   └── utils/              # 工具函数目录
├── tsconfig.json           # TypeScript 配置
└── typedoc.json            # TypeDoc 配置
```

## 详细说明

### 根目录文件
- **.git/**: Git 版本控制系统目录
- **.gitignore**: 定义 Git 忽略的文件和目录
- **.prettierrc**: 代码格式化工具 Prettier 的配置文件
- **CHANGES.md**: 记录项目的变更历史
- **LICENSE**: 项目的许可证信息
- **LOG.md**: 项目开发日志
- **README.md**: 项目介绍和使用说明
- **package-lock.json**: 确保依赖包版本一致性的锁定文件
- **package.json**: 项目配置，包含依赖、脚本等信息
- **rollup.config.js**: JavaScript 打包工具 Rollup 的配置文件
- **tsconfig.json**: TypeScript 编译配置
- **typedoc.json**: API 文档生成工具 TypeDoc 的配置文件

### 源代码目录 (src/)
- **src/core/**: 核心功能模块
  - **EventEmitter.ts**: 扩展了 Cesium 的 ScreenSpaceEventHandler，支持多个回调函数的事件发射器类
  - **Viewer.ts**: 增强型 Cesium Viewer 类，预配置了适合 WebGIS 应用的默认设置
  - **index.ts**: 核心模块导出文件
- **src/index.ts**: 项目的主入口文件，导出所有公共 API
- **src/types/**: 类型定义文件目录
- **src/utils/**: 工具函数目录

### 示例项目目录
- **demo-html/**: HTML 示例项目，展示 SDK 的基本用法
- **demo-vue3/**: Vue3 示例项目，展示在 Vue3 项目中使用 SDK 的方法

### 文档目录 (docs/)
- **docs/api/**: 生成的 API 文档
- **docs/index.html**: 文档首页重定向文件

### 构建脚本目录 (scripts/)
- **scripts/generate-docs.js**: 自定义文档生成脚本，用于生成中文 API 文档

## 构建与使用

### 构建 SDK
```bash
npm run build
```

### 生成文档
```bash
npm run docs
```

### 构建并复制 UMD 文件到示例项目
```bash
npm run build:copy
```
此命令会构建项目并将生成的 arc3dlab.umd.js 文件复制到 demo-html/public/lib 目录下，以便在 HTML 示例中使用。

### 开发工作流程
```bash
npm run dev
```
此命令构建 SDK 并提供在 demo-vue3 中测试的说明。开发时可以使用别名配置直接测试本地构建的 SDK。

```bash
npm run dev:watch
```
此命令启动监听模式，当源代码更改时自动重新构建 SDK，便于开发测试。

## 项目特点

1. **基于 Cesium**: 扩展了 Cesium 的功能，提供了优化的默认配置
2. **TypeScript 支持**: 完整的 TypeScript 类型定义
3. **模块化设计**: 清晰的模块结构，便于维护和扩展
4. **中文文档**: 完整的中文 API 文档
5. **现代化主题**: 使用 Material Design 风格的文档主题
6. **多示例支持**: 提供 HTML 和 Vue3 示例项目