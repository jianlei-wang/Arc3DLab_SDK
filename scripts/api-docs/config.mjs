/**
 * 配置：文档系统的类别、包名、阈值与输出路径。
 */

import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const repoRoot = path.resolve(__dirname, "..", "..")
export const modelDir = path.join(repoRoot, "docs", "api", ".model")
export const modelJsonPath = path.join(modelDir, "model.json")
export const docsModelPath = path.join(modelDir, "docs-model.json")
export const outDir = path.join(repoRoot, "api-docs", "api")
export const themeDir = path.join(__dirname, "theme")
export const reportPath = path.join(repoRoot, "docs", "api", "report.json")
export const typedocConfig = path.join(repoRoot, "typedoc.json")

/** TypeDoc ReflectionKind 数值。 */
export const KIND = {
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
  TypeParameter: 131072,
  Accessor: 262144,
  GetSignature: 524288,
  SetSignature: 1048576,
  TypeAlias: 2097152,
  Reference: 4194304,
}

/** 符号类别及侧边栏展示顺序。 */
export const CATEGORIES = [
  { id: "namespace", label: "Namespaces", kind: KIND.Namespace },
  { id: "class", label: "Classes", kind: KIND.Class },
  { id: "interface", label: "Interfaces", kind: KIND.Interface },
  { id: "enumeration", label: "Enumerations", kind: KIND.Enum },
  { id: "type-alias", label: "Type Aliases", kind: KIND.TypeAlias },
  { id: "function", label: "Functions", kind: KIND.Function },
  { id: "variable", label: "Variables", kind: KIND.Variable },
]

export const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

/** 包名 → 展示命名空间。 */
export const PACKAGE_DISPLAY = {
  "@arc3dlab/core": "core",
  "@arc3dlab/engine-cesium": "engine-cesium",
  "@arc3dlab/scene": "scene",
  "@arc3dlab/layers": "layers",
  "@arc3dlab/graphics": "graphics",
  "@arc3dlab/data": "data",
  "@arc3dlab/interaction": "interaction",
  "@arc3dlab/analysis": "analysis",
  "@arc3dlab/effects": "effects",
  "@arc3dlab/ui": "ui",
  "@arc3dlab/sdk": "sdk",
  "@arc3dlab/legacy": "legacy",
  arc3dlab: "arc3dlab",
}

export const PACKAGE_ORDER = [
  "arc3dlab",
  "sdk",
  "core",
  "engine-cesium",
  "scene",
  "layers",
  "graphics",
  "data",
  "interaction",
  "analysis",
  "effects",
  "ui",
  "legacy",
]

/** 包名 → 首页副标题。 */
export const PACKAGE_SUMMARY = {
  arc3dlab: "顶层入口，聚合公开的 Arc3D 运行时 API。",
  sdk: "运行时门面：Arc3D、Arc3DApp 与其管理器。",
  core: "运行时内核：上下文、生命周期、事件、错误与业务语义类型。",
  "engine-cesium": "CesiumJS 引擎适配与原生 Viewer 上下文。",
  scene: "相机、渲染策略与首屏就绪语义。",
  layers: "图层与底图/地形等场景资源。",
  graphics: "点、线、面、模型等图形对象。",
  data: "数据目录、数据资产与要素语义。",
  interaction: "拾取、选择与悬停交互。",
  analysis: "测量、地形、通视、查询、剖切与土方等分析任务。",
  effects: "材质与后处理效果。",
  ui: "轻量 UI 控件与提示。",
  legacy: "旧版 Viewer 兼容适配器。",
}

/** 文档覆盖率阈值（0-1）。 */
export const THRESHOLDS = {
  summary: 0.7,
  params: 0.5,
}

export const SITE = {
  title: "Arc3DLab SDK API",
  subtitle: "A Modular 3D WebGIS Runtime built on CesiumJS",
  lang: "zh-CN",
}
