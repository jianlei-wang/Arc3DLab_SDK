import { defineConfig } from "vitepress"

const sidebar = [
  {
    text: "简介",
    collapsed: false,
    items: [
      { text: "什么是 Arc3DLab SDK", link: "/intro/what-is" },
      { text: "快速开始", link: "/intro/quick-start" },
      { text: "环境与安装", link: "/intro/environment" },
    ],
  },
  {
    text: "运行时",
    collapsed: false,
    items: [
      { text: "创建应用", link: "/runtime/create-app" },
      { text: "就绪语义", link: "/runtime/readiness" },
      { text: "生命周期与销毁", link: "/runtime/lifecycle" },
      { text: "错误处理", link: "/runtime/errors" },
    ],
  },
  {
    text: "相机与导航",
    collapsed: false,
    items: [
      { text: "飞行与定位", link: "/camera/fly-to" },
      { text: "视角与状态", link: "/camera/view" },
    ],
  },
  {
    text: "场景",
    collapsed: false,
    items: [
      { text: "渲染模式", link: "/scene/mode" },
      { text: "时钟与环境", link: "/scene/environment" },
      { text: "性能监控", link: "/scene/performance" },
    ],
  },
  {
    text: "影像与地形",
    collapsed: false,
    items: [
      { text: "底图设置", link: "/imagery-terrain/basemap" },
      { text: "影像图层", link: "/imagery-terrain/imagery" },
      { text: "地形", link: "/imagery-terrain/terrain" },
    ],
  },
  {
    text: "图层与数据",
    collapsed: false,
    items: [
      { text: "图层管理", link: "/layers/layer-manager" },
      { text: "3D Tiles", link: "/layers/tileset" },
      { text: "数据目录", link: "/data/catalog" },
      { text: "数据源与提供者", link: "/data/providers" },
    ],
  },
  {
    text: "图形",
    collapsed: false,
    items: [
      { text: "点", link: "/graphics/points" },
      { text: "线", link: "/graphics/polyline" },
      { text: "面", link: "/graphics/polygon" },
      { text: "模型", link: "/graphics/model" },
      { text: "样式与批量更新", link: "/graphics/style" },
    ],
  },
  {
    text: "交互与事件",
    collapsed: false,
    items: [
      { text: "拾取", link: "/interaction/pick" },
      { text: "选择与悬停", link: "/interaction/selection" },
      { text: "事件总线", link: "/interaction/events" },
    ],
  },
  {
    text: "空间分析",
    collapsed: false,
    items: [
      { text: "测量", link: "/analysis/measure" },
      { text: "地形分析", link: "/analysis/terrain" },
      { text: "通视与可视域", link: "/analysis/visibility" },
      { text: "空间查询", link: "/analysis/query" },
      { text: "剖切与开挖", link: "/analysis/clip" },
      { text: "土方计算", link: "/analysis/volume" },
      { text: "任务契约", link: "/analysis/tasks" },
    ],
  },
  {
    text: "特效与 UI",
    collapsed: false,
    items: [
      { text: "材质与后处理", link: "/effects-ui/effects" },
      { text: "UI 提示", link: "/effects-ui/tooltip" },
    ],
  },
  {
    text: "扩展与迁移",
    collapsed: false,
    items: [
      { text: "插件系统", link: "/plugins/plugins" },
      { text: "从 Viewer 迁移", link: "/migration/viewer" },
    ],
  },
]

export default defineConfig({
  lang: "zh-CN",
  title: "Arc3DLab 开发指南",
  description:
    "Arc3DLab SDK 使用指南：从快速开始到相机、图层、图形、交互、空间分析与插件扩展。",
  base: "/",
  cleanUrls: true,
  lastUpdated: true,
  head: [["link", { rel: "icon", href: "/logo.svg" }]],
  vite: {
    server: {
      allowedHosts: [".monkeycode-ai.online"],
    },
  },
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Arc3DLab 开发指南",
    nav: [{ text: "指南", link: "/intro/what-is", activeMatch: "/" }],
    sidebar,
    outline: { level: [2, 3], label: "本页目录" },
    docFooter: { prev: "上一页", next: "下一页" },
    darkModeSwitchLabel: "外观",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "回到顶部",
    lastUpdated: { text: "最后更新" },
    search: { provider: "local" },
    footer: {
      message: "基于 CesiumJS 的模块化三维 WebGIS 运行时",
      copyright: "Arc3DLab",
    },
  },
})
