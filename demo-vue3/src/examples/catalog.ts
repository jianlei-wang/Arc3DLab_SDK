import helloWorldThumb from "../assets/thumbnails/hello-world.avif"
import pointsThumb from "../assets/thumbnails/points.avif"
import polygonThumb from "../assets/thumbnails/polygon.avif"
import polylineThumb from "../assets/thumbnails/polyline.avif"

export interface SandcastleExample {
  id: string
  title: string
  category: string
  summary: string
  code: string
  thumbnail?: string
}

export const exampleCategories = [
  "入门",
  "图形",
  "相机",
  "场景",
  "底图地形",
  "图层数据",
  "交互",
  "分析",
  "特效",
  "标绘",
  "动态图形",
  "模型",
  "导航服务",
] as const

export const examples: SandcastleExample[] = [
  {
    id: "hello-world",
    title: "Hello World",
    category: "入门",
    summary: "创建 Arc3DApp 并飞到中国上空。运行时已注入 app 和 gui，FPS 控制默认显示。",
    thumbnail: helloWorldThumb,
    code: `// app / gui 已由 Sandcastle 注入，FPS 开关由运行时统一挂载。
await app.camera.flyTo([104.06, 30.67, 4200000], 2)

gui.addToolbarButton("成都", () => app.camera.flyTo([104.06, 30.67, 800000], 1.6))
gui.addToolbarButton("北京", () => app.camera.flyTo([116.40, 39.91, 800000], 1.6))
gui.addToolbarButton("上海", () => app.camera.flyTo([121.47, 31.23, 800000], 1.6))
`,
  },
  {
    id: "polygon",
    title: "Polygon",
    category: "图形",
    summary: "绘制多个不规则多边形，并用控制面板修改面的全部样式参数。",
    thumbnail: polygonThumb,
    code: `// 多个不规则多边形，顶点数量与形状各不相同。
const shapes = [
  {
    id: "poly-pentagon",
    positions: [
      [120.02, 30.18],
      [120.14, 30.15],
      [120.21, 30.24],
      [120.13, 30.33],
      [120.00, 30.28],
    ],
  },
  {
    id: "poly-quad",
    positions: [
      [120.24, 30.16],
      [120.36, 30.19],
      [120.31, 30.31],
      [120.22, 30.25],
    ],
  },
  {
    id: "poly-concave",
    positions: [
      [120.06, 30.02],
      [120.30, 30.02],
      [120.24, 30.10],
      [120.30, 30.13],
      [120.06, 30.13],
      [120.12, 30.07],
    ],
  },
]

const fillPalette = { 蓝: "#2F80ED88", 橙: "#F2994A88", 绿: "#27AE6088", 红: "#EB575788" }
const outlinePalette = { 白: "#FFFFFF", 黄: "#F2C94C", 青: "#56CCF2", 黑: "#111111" }

// style 覆盖面支持的全部样式参数：fill / outline / outlineColor / outlineWidth / clampToGround。
let style = {
  fill: fillPalette.蓝,
  outline: true,
  outlineColor: outlinePalette.白,
  outlineWidth: 2,
  clampToGround: true,
}
let renderMode = "auto"
let handles = []

function redraw() {
  handles.forEach((handle) => handle.remove())
  handles = shapes.map((shape) =>
    app.graphics.addPolygon({
      id: shape.id,
      positions: shape.positions,
      renderMode: renderMode === "auto" ? undefined : renderMode,
      style: Object.assign({}, style),
    }),
  )
}

redraw()

gui.addMenubarItem("填充色", Object.keys(fillPalette), "蓝", (value) => {
  style.fill = fillPalette[value]
  redraw()
})
gui.addToggleButton("轮廓", true, (value) => {
  style.outline = value
  redraw()
})
gui.addMenubarItem("轮廓色", Object.keys(outlinePalette), "白", (value) => {
  style.outlineColor = outlinePalette[value]
  redraw()
})
gui.addSlider("轮廓宽度", { min: 0, max: 10, value: 2, step: 1 }, (value) => {
  style.outlineWidth = value
  redraw()
})
gui.addToggleButton("贴地", true, (value) => {
  style.clampToGround = value
  redraw()
})
gui.addMenubarItem("渲染模式", ["auto", "entity", "primitive"], "auto", (value) => {
  renderMode = value
  redraw()
})

await app.camera.flyTo([120.18, 30.18, 70000], 1.6)
console.log("绘制了", handles.length, "个多边形", handles.map((h) => h.id))
`,
  },
  {
    id: "points",
    title: "Points",
    category: "图形",
    summary: "绘制多个点，并用控制面板修改点的全部样式参数。",
    thumbnail: pointsThumb,
    code: `const coords = [
  [116.40, 39.91],
  [121.47, 31.23],
  [113.26, 23.13],
  [104.07, 30.67],
  [108.94, 34.27],
]

const colorPalette = { 红: "#FF4D4F", 蓝: "#2D9CDB", 绿: "#27AE60", 黄: "#F2C94C" }
const outlinePalette = { 白: "#FFFFFF", 黄: "#FFE58F", 黑: "#111111" }

// style 覆盖面支持的全部样式参数：color / outlineColor / pixelSize / outlineWidth / clampToGround。
let style = {
  color: colorPalette.红,
  outlineColor: outlinePalette.黄,
  pixelSize: 14,
  outlineWidth: 2,
  clampToGround: true,
}
let renderMode = "auto"
let handles = []

function redraw() {
  handles.forEach((handle) => handle.remove())
  handles = coords.map((position, index) =>
    app.graphics.addPoint({
      id: "point-" + index,
      positions: position,
      renderMode: renderMode === "auto" ? undefined : renderMode,
      style: Object.assign({}, style),
    }),
  )
}

redraw()

gui.addMenubarItem("点颜色", Object.keys(colorPalette), "红", (value) => {
  style.color = colorPalette[value]
  redraw()
})
gui.addMenubarItem("描边色", Object.keys(outlinePalette), "黄", (value) => {
  style.outlineColor = outlinePalette[value]
  redraw()
})
gui.addSlider("像素大小", { min: 2, max: 40, value: 14, step: 1 }, (value) => {
  style.pixelSize = value
  redraw()
})
gui.addSlider("描边宽度", { min: 0, max: 10, value: 2, step: 1 }, (value) => {
  style.outlineWidth = value
  redraw()
})
gui.addToggleButton("贴地", true, (value) => {
  style.clampToGround = value
  redraw()
})
gui.addMenubarItem("渲染模式", ["auto", "entity", "primitive"], "auto", (value) => {
  renderMode = value
  redraw()
})

await app.camera.flyTo([110.0, 32.0, 2800000], 2)
`,
  },
  {
    id: "polyline",
    title: "Polyline",
    category: "图形",
    summary: "绘制多条折线，并用控制面板修改线的全部样式参数。",
    thumbnail: polylineThumb,
    code: `const routes = [
  {
    id: "route-east",
    positions: [
      [116.40, 39.91],
      [118.80, 32.06],
      [121.47, 31.23],
      [120.16, 30.25],
    ],
  },
  {
    id: "route-south",
    positions: [
      [108.94, 34.27],
      [113.26, 23.13],
      [121.47, 31.23],
    ],
  },
]

const colorPalette = { 橙: "#FAAD14", 蓝: "#2D9CDB", 绿: "#27AE60", 紫: "#BB6BD9" }

// style 覆盖面支持的全部样式参数：color / width / clampToGround。
let style = { color: colorPalette.橙, width: 4, clampToGround: true }
let renderMode = "auto"
let handles = []

function redraw() {
  handles.forEach((handle) => handle.remove())
  handles = routes.map((route) =>
    app.graphics.addPolyline({
      id: route.id,
      positions: route.positions,
      renderMode: renderMode === "auto" ? undefined : renderMode,
      style: Object.assign({}, style),
    }),
  )
}

redraw()

gui.addMenubarItem("线颜色", Object.keys(colorPalette), "橙", (value) => {
  style.color = colorPalette[value]
  redraw()
})
gui.addSlider("线宽", { min: 1, max: 12, value: 4, step: 1 }, (value) => {
  style.width = value
  redraw()
})
gui.addToggleButton("贴地", true, (value) => {
  style.clampToGround = value
  redraw()
})
gui.addMenubarItem("渲染模式", ["auto", "entity", "primitive"], "auto", (value) => {
  renderMode = value
  redraw()
})

await app.camera.flyTo([119.2, 32.4, 900000], 1.8)
`,
  },
  {
    id: "graphic-style",
    title: "Graphic Style",
    category: "图形",
    summary: "同时展示点、折线、面、模型四类 graphic，并用面板控制各项样式参数。",
    code: `// 四类 graphic 放在同一区域：点、折线、面、模型。
const anchor = { lon: 120.16, lat: 30.26 }
const palette = {
  蓝: { fill: "#2F80ED66", line: "#56CCF2" },
  橙: { fill: "#F2994A66", line: "#F2C94C" },
  绿: { fill: "#27AE6066", line: "#6FCF97" },
  紫: { fill: "#BB6BD966", line: "#D8A5F0" },
}
const MODEL_URL =
  "https://cesium.com/downloads/cesiumjs/releases/1.146/Apps/SampleData/models/CesiumAir/Cesium_Air.glb"

// 覆盖 GraphicStyle 支持的全部样式参数：
// color / fill / outline / outlineColor / outlineWidth / pixelSize / width / clampToGround。
let style = {
  color: "#2D9CDB",
  fill: palette.蓝.fill,
  outline: true,
  outlineColor: palette.蓝.line,
  outlineWidth: 2,
  pixelSize: 16,
  width: 4,
  clampToGround: true,
}
const visible = { 点: true, 线: true, 面: true, 模型: true }
let renderMode = "auto"
let handles = []

function redraw() {
  handles.forEach((handle) => app.graphics.remove(handle.id))
  handles = []
  const mode = renderMode === "auto" ? undefined : renderMode
  if (visible.点) {
    handles.push(
      app.graphics.addPoint({
        id: "style-point",
        positions: [anchor.lon - 0.07, anchor.lat + 0.06],
        renderMode: mode,
        style: { color: style.color, outlineColor: style.outlineColor, pixelSize: style.pixelSize, outlineWidth: style.outlineWidth, clampToGround: style.clampToGround },
      }),
    )
  }
  if (visible.线) {
    handles.push(
      app.graphics.addPolyline({
        id: "style-line",
        positions: [
          [anchor.lon - 0.06, anchor.lat - 0.06],
          [anchor.lon, anchor.lat - 0.02],
          [anchor.lon + 0.06, anchor.lat - 0.06],
        ],
        renderMode: mode,
        style: { color: style.color, width: style.width, clampToGround: style.clampToGround },
      }),
    )
  }
  if (visible.面) {
    handles.push(
      app.graphics.addPolygon({
        id: "style-polygon",
        positions: [
          [anchor.lon + 0.02, anchor.lat + 0.02],
          [anchor.lon + 0.14, anchor.lat + 0.02],
          [anchor.lon + 0.08, anchor.lat + 0.12],
        ],
        renderMode: mode,
        style: { fill: style.fill, outline: style.outline, outlineColor: style.outlineColor, outlineWidth: style.outlineWidth, clampToGround: style.clampToGround },
      }),
    )
  }
  if (visible.模型) {
    handles.push(
      app.graphics.addModel({
        id: "style-model",
        url: MODEL_URL,
        position: [anchor.lon, anchor.lat, 120],
        scale: 1,
        minimumPixelSize: 96,
      }),
    )
  }
}

gui.addMenubarItem("配色", Object.keys(palette), "蓝", (value) => {
  style.fill = palette[value].fill
  style.outlineColor = palette[value].line
  redraw()
})
gui.addToggleButton("轮廓", true, (value) => {
  style.outline = value
  redraw()
})
gui.addSlider("轮廓宽度", { min: 0, max: 10, value: 2, step: 1 }, (value) => {
  style.outlineWidth = value
  redraw()
})
gui.addSlider("点大小", { min: 2, max: 40, value: 16, step: 1 }, (value) => {
  style.pixelSize = value
  redraw()
})
gui.addSlider("线宽", { min: 1, max: 12, value: 4, step: 1 }, (value) => {
  style.width = value
  redraw()
})
gui.addToggleButton("贴地", true, (value) => {
  style.clampToGround = value
  redraw()
})
gui.addToggleButton("点", true, (value) => {
  visible.点 = value
  redraw()
})
gui.addToggleButton("线", true, (value) => {
  visible.线 = value
  redraw()
})
gui.addToggleButton("面", true, (value) => {
  visible.面 = value
  redraw()
})
gui.addToggleButton("模型", true, (value) => {
  visible.模型 = value
  redraw()
})
gui.addMenubarItem("渲染模式", ["auto", "entity", "primitive"], "auto", (value) => {
  renderMode = value
  redraw()
})

redraw()
await app.camera.flyTo([anchor.lon, anchor.lat, 24000], 1.6)
console.log("当前 graphic:", app.graphics.list().map((g) => g.id))
`,
  },
  {
    id: "graphic-move",
    title: "Move Graphic",
    category: "图形",
    summary: "用滑块沿经度移动一个点（删除后重建）。",
    code: `const base = { longitude: 120.00, latitude: 30.26 }

function place(longitude) {
  if (app.graphics.get("mover")) app.graphics.remove("mover")
  app.graphics.addPoint({
    id: "mover",
    positions: [longitude, base.latitude],
    style: { color: "#EB5757", pixelSize: 18, outlineColor: "#FFFFFF" },
  })
}

gui.addSlider("经度", { min: 119.8, max: 120.4, value: 120.0, step: 0.005 }, place)
gui.addToolbarButton("重置", () => place(base.longitude))
place(base.longitude)

await app.camera.flyTo([120.1, 30.26, 60000], 1.5)
`,
  },
  {
    id: "batch-graphics",
    title: "Batch Graphics",
    category: "图形",
    summary: "批量添加折线/多边形，并用按钮批量显示或删除。",
    code: `const lines = []
const polys = []
for (let i = 0; i < 5; i += 1) {
  const offset = i * 0.05
  lines.push({
    positions: [
      [119.9 + offset, 30.10],
      [120.0 + offset, 30.40],
    ],
    style: { color: "#BB6BD9", width: 3 },
  })
  polys.push({
    positions: [
      [119.85 + offset, 30.15],
      [119.95 + offset, 30.15],
      [119.95 + offset, 30.25],
      [119.85 + offset, 30.25],
    ],
    style: { fill: "#56CCF244", outlineColor: "#6FCF97" },
  })
}
const lineHandles = app.graphics.addPolylines(lines)
const polyHandles = app.graphics.addPolygons(polys)
console.log("added", lineHandles.length, "lines and", polyHandles.length, "polygons")

gui.addToggleButton("显示折线", true, (on) => app.graphics.showMany(lineHandles.map((h) => h.id), on))
gui.addToolbarButton("删除多边形", () => app.graphics.removeMany(polyHandles.map((h) => h.id)))
gui.addToolbarButton("打印列表", () => console.log("graphics", app.graphics.list().map((g) => g.id)))

await app.camera.flyTo([120.1, 30.25, 90000], 1.6)
`,
  },
  {
    id: "graphic-visibility",
    title: "Graphic Visibility",
    category: "图形",
    summary: "用开关控制每个图形的显示，并打印 list() 结果。",
    code: `const handles = [
  app.graphics.addPoint({ id: "p1", positions: [120.05, 30.20], style: { color: "#EB5757", pixelSize: 14 } }),
  app.graphics.addPoint({ id: "p2", positions: [120.15, 30.20], style: { color: "#27AE60", pixelSize: 14 } }),
  app.graphics.addPoint({ id: "p3", positions: [120.25, 30.20], style: { color: "#2D9CDB", pixelSize: 14 } }),
]

handles.forEach((handle) => {
  gui.addToggleButton("显示 " + handle.id, true, (on) => app.graphics.show(handle.id, on))
})

gui.addToolbarButton("打印列表", () => console.log("graphics", app.graphics.list().map((g) => g.id)))

await app.camera.flyTo([120.15, 30.20, 50000], 1.5)
`,
  },
  {
    id: "camera-fly",
    title: "Camera FlyTo",
    category: "相机",
    summary: "用工具栏按钮飞向城市，并打印相机姿态。",
    code: `gui.addToolbarButton("北京", () => app.camera.flyTo([116.40, 39.91, 180000], 1.4))
gui.addToolbarButton("上海", () => app.camera.flyTo([121.47, 31.23, 120000], 1.8))
gui.addToolbarButton("打印姿态", () => {
  const state = app.camera.getState()
  console.log("heading / pitch", state.heading.toFixed(1), state.pitch.toFixed(1))
})

await app.camera.flyTo([116.40, 39.91, 180000], 1.4)
`,
  },
  {
    id: "camera-lookat",
    title: "LookAt",
    category: "相机",
    summary: "用滑块改变环绕距离，固定俯角对准目标。",
    code: `const target = [116.40, 39.91, 0]
await app.camera.flyTo([116.40, 39.88, 2000], 1.5)

gui.addSlider("距离 m", { min: 500, max: 5000, value: 2000, step: 100 }, (range) => {
  app.camera.lookAt(target, range)
})
gui.addToolbarButton("重置", () => app.camera.reset())
`,
  },
  {
    id: "camera-home",
    title: "Home Pose",
    category: "相机",
    summary: "记住一个视角，再恢复；打印当前视角状态。",
    code: `gui.addToolbarButton("记住当前视角", () => {
  app.camera.rememberHome()
  console.log("home saved")
})
gui.addToolbarButton("回到首页视角", () => app.camera.reset())
gui.addToolbarButton("打印视角", () => console.log(app.camera.getState()))

await app.camera.flyTo([104.06, 30.67, 1500000], 2)
`,
  },
  {
    id: "camera-setview",
    title: "Capture / Restore",
    category: "相机",
    summary: "保存相机快照，稍后恢复任意视角。",
    code: `let saved = null
gui.addToolbarButton("保存视角", () => {
  saved = app.camera.capture()
  console.log("saved", saved)
})
gui.addToolbarButton("恢复视角", () => {
  if (saved) app.camera.restore(saved)
})

await app.camera.flyTo([120.16, 30.26, 400000], 1.6)
`,
  },
  {
    id: "scene-mode",
    title: "Scene Mode",
    category: "场景",
    summary: "用工具栏在 3D、2D 与哥伦布视图之间切换。",
    code: `app.graphics.addPolygon({
  positions: [
    [120.10, 30.20],
    [120.22, 30.20],
    [120.22, 30.32],
    [120.10, 30.32],
  ],
  style: { fill: "#73D13D66", outlineColor: "#B7EB8F" },
})

await app.camera.flyTo([120.16, 30.26, 180000], 1.2)
gui.addToolbarButton("3D", () => app.scene.setMode("3d"))
gui.addToolbarButton("2D", () => app.scene.setMode("2d"))
gui.addToolbarButton("哥伦布", () => app.scene.setMode("columbus"))
`,
  },
  {
    id: "scene-clock",
    title: "Clock",
    category: "场景",
    summary: "用开关和滑块控制场景时钟。",
    code: `gui.addToggleButton("时钟运行", true, (on) => {
  app.scene.clock.shouldAnimate = on
  console.log("animate", on)
})
gui.addSlider("倍速", { min: 1, max: 240, value: 60, step: 1 }, (value) => {
  app.scene.clock.multiplier = value
})

await app.camera.flyTo([116.40, 39.91, 1200000], 1.6)
`,
  },
  {
    id: "scene-environment",
    title: "Environment",
    category: "场景",
    summary: "用开关控制光照与大气。",
    code: `gui.addToggleButton("光照", true, (on) => {
  app.scene.environment.setLighting(on)
  console.log("lighting", on)
})
gui.addToggleButton("大气", true, (on) => {
  app.scene.environment.setAtmosphere(on)
  console.log("atmosphere", on)
})
gui.addToggleButton("贴地深度检测", true, (on) => app.scene.setDepthTestAgainstTerrain(on))

await app.camera.flyTo([110.0, 33.0, 2400000], 1.8)
`,
  },
  {
    id: "scene-capture",
    title: "Capture",
    category: "场景",
    summary: "截图当前画面并在新窗口打开。",
    code: `app.graphics.addPoint({ positions: [120.16, 30.26], style: { color: "#FF7A45", pixelSize: 18 } })
await app.camera.flyTo([120.16, 30.26, 60000], 1.5)

gui.addToolbarButton("截图", () => {
  const image = app.scene.captureImage()
  console.log("captured", image.length, "bytes")
  const win = window.open("", "_blank")
  if (win) win.document.write('<img src="' + image + '" style="max-width:100%">')
})
`,
  },
  {
    id: "scene-ready",
    title: "whenSceneReady",
    category: "场景",
    summary: "等待场景渲染完成后再操作，避免时序问题。",
    code: `console.log("waiting for scene...")
await app.scene.whenSceneReady()
console.log("scene is ready")
app.graphics.addPoint({ positions: [120.16, 30.26], style: { color: "#27AE60", pixelSize: 16 } })
gui.addToolbarButton("重新等待", async () => {
  await app.scene.whenSceneReady()
  console.log("ready again")
})
await app.camera.flyTo([120.16, 30.26, 60000], 1.5)
`,
  },
  {
    id: "scene-plugin",
    title: "Plugin",
    category: "场景",
    summary: "安装/卸载一个插件，打印插件列表。",
    code: `const locatePlugin = {
  name: "locate-demo",
  version: "1.0.0",
  install(app, context, scope) {
    scope.track(context.events.on("layerAdded", (payload) => console.log("layer added", payload.id)))
  },
  uninstall() {
    console.log("locate plugin uninstalled")
  },
}

gui.addToggleButton("安装定位插件", false, async (on) => {
  if (on) {
    await app.use(locatePlugin)
  } else {
    await app.plugins.uninstall("locate-demo")
  }
  console.log("plugins", app.plugins.list())
})

await app.camera.flyTo([120.16, 30.26, 800000], 1.4)
`,
  },
  {
    id: "basemap-switch",
    title: "Basemap Switch",
    category: "底图地形",
    summary: "用下拉菜单切换影像底图。",
    code: `gui.addMenubarItem("底图", ["影像", "街道", "暗色"], "影像", async (value) => {
  const presets = {
    影像: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    街道: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
    暗色: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer",
  }
  try {
    await app.basemap.set({ type: "arcgis", url: presets[value] })
    console.log("basemap", value)
  } catch (error) {
    console.warn("basemap failed", error && error.message)
  }
})

await app.camera.flyTo([116.40, 39.91, 900000], 1.6)
`,
  },
  {
    id: "imagery-overlay",
    title: "Imagery Overlay",
    category: "底图地形",
    summary: "叠加/移除一层影像，用滑块控制透明度。",
    code: `let overlay = null
gui.addToolbarButton("叠加影像", async () => {
  try {
    overlay = await app.layers.imagery.add({
      id: "overlay",
      type: "arcgis",
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer",
    })
    console.log("overlay added", overlay.id)
  } catch (error) {
    console.warn(error && error.message)
  }
})
gui.addSlider("透明度", { min: 0, max: 1, value: 1, step: 0.05 }, (value) => {
  if (overlay && overlay.native) overlay.native.alpha = value
})
gui.addToolbarButton("移除叠加", () => {
  if (overlay) {
    overlay.destroy()
    overlay = null
  }
})

await app.camera.flyTo([116.40, 39.91, 1200000], 1.6)
`,
  },
  {
    id: "terrain-exaggeration",
    title: "Terrain Exaggeration",
    category: "底图地形",
    summary: "用滑块控制地形夸张系数。",
    code: `gui.addSlider("夸张系数", { min: 1, max: 5, value: 1, step: 0.5 }, (value) => {
  app.analysis.terrain.setExaggeration(value)
  console.log("exaggeration", value)
})

await app.camera.flyTo([99.0, 33.0, 900000], 1.8)
`,
  },
  {
    id: "terrain-provider",
    title: "Terrain Provider",
    category: "底图地形",
    summary: "用下拉菜单切换/关闭地形。",
    code: `gui.addMenubarItem("地形", ["开启", "关闭"], "开启", async (value) => {
  try {
    if (value === "关闭") {
      await app.terrain.set({ type: "none" })
    } else {
      await app.terrain.set({
        type: "url",
        url: "https://assets.agi.com/stk-terrain/world",
      })
    }
    console.log("terrain", value)
  } catch (error) {
    console.warn("terrain failed", error && error.message)
  }
})

await app.camera.flyTo([99.0, 33.0, 900000], 1.8)
`,
  },
  {
    id: "data-geojson",
    title: "GeoJSON",
    category: "图层数据",
    summary: "加载内联 GeoJSON，并打印图层信息。",
    code: `const geojson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "zone" },
      geometry: {
        type: "Polygon",
        coordinates: [[[116.30, 39.85], [116.50, 39.85], [116.50, 39.98], [116.30, 39.98], [116.30, 39.85]]],
      },
    },
    {
      type: "Feature",
      properties: { name: "corridor" },
      geometry: { type: "LineString", coordinates: [[116.30, 39.90], [116.42, 39.95], [116.50, 39.90]] },
    },
  ],
}
const url = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson))

gui.addToolbarButton("加载 GeoJSON", async () => {
  const layer = await app.data.addGeoJson({ id: "inline-geojson", url })
  console.log("geojson layer", layer.id, layer.type)
})

await app.camera.flyTo([116.40, 39.92, 120000], 1.5)
`,
  },
  {
    id: "data-kml",
    title: "KML",
    category: "图层数据",
    summary: "加载内联 KML，标注两个城市。",
    code: `const kml =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
  '<Placemark><name>Beijing</name><Point><coordinates>116.40,39.91,0</coordinates></Point></Placemark>' +
  '<Placemark><name>Shanghai</name><Point><coordinates>121.47,31.23,0</coordinates></Point></Placemark>' +
  "</Document></kml>"
const url = "data:application/vnd.google-earth.kml+xml;charset=utf-8," + encodeURIComponent(kml)

gui.addToolbarButton("加载 KML", async () => {
  const layer = await app.data.addKml({ id: "inline-kml", url })
  console.log("kml layer", layer.id)
})

await app.camera.flyTo([118.9, 35.5, 2600000], 1.6)
`,
  },
  {
    id: "data-czml",
    title: "CZML",
    category: "图层数据",
    summary: "加载内联 CZML，并用控件控制其时钟。",
    code: `const czml = [
  {
    id: "document",
    name: "inline",
    version: "1.0",
    clock: {
      interval: "2024-01-01T00:00:00Z/2024-01-01T00:02:00Z",
      currentTime: "2024-01-01T00:00:00Z",
      multiplier: 30,
      shouldAnimate: true,
    },
  },
  {
    id: "drone",
    availability: "2024-01-01T00:00:00Z/2024-01-01T00:02:00Z",
    position: {
      epoch: "2024-01-01T00:00:00Z",
      cartographicDegrees: [0, 116.30, 39.85, 5000, 120, 116.50, 39.98, 5000],
    },
    point: { color: { rgba: [255, 80, 0, 255] }, pixelSize: 14 },
  },
]
const url = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(czml))
await app.data.addCzml({ id: "inline-czml", url })

gui.addToggleButton("时钟运行", true, (on) => {
  app.scene.clock.shouldAnimate = on
})
gui.addSlider("倍速", { min: 1, max: 120, value: 30, step: 1 }, (value) => {
  app.scene.clock.multiplier = value
})

await app.camera.flyTo([116.40, 39.92, 200000], 1.5)
`,
  },
  {
    id: "catalog",
    title: "Catalog",
    category: "图层数据",
    summary: "加载图层后，从 catalog 读取已注册的图层元数据。",
    code: `const geojson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "seed" },
      geometry: { type: "Point", coordinates: [120.16, 30.26] },
    },
  ],
}
const url = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson))

gui.addToolbarButton("加载并打印 catalog", async () => {
  const layer = await app.data.addGeoJson({ id: "catalog-demo", url })
  console.log("layer", layer.id, "catalog layers", app.context.catalog.listLayers())
})
gui.addToolbarButton("打印 catalog 资源", () => console.log(app.context.catalog.listAssets()))

await app.camera.flyTo([120.16, 30.26, 120000], 1.5)
`,
  },
  {
    id: "pick-tooltip",
    title: "Pick + Tooltip",
    category: "交互",
    summary: "点击拾取图形，并用 tooltip 显示坐标。",
    code: `app.graphics.addPoint({
  positions: [120.16, 30.26],
  style: { color: "#FF7A45", pixelSize: 16, outlineColor: "#FFF1B8" },
})

app.interaction.on("click", (event) => {
  if (event.lngLat) {
    const { longitude, latitude } = event.lngLat
    app.ui.tooltip.show(
      event.graphicId
        ? \`graphic \${event.graphicId}\`
        : \`\${longitude.toFixed(4)}, \${latitude.toFixed(4)}\`
    )
  } else {
    app.ui.tooltip.hide()
  }
})

await app.camera.flyTo([120.16, 30.26, 60000], 1.5)
`,
  },
  {
    id: "interaction-move",
    title: "Mouse Move",
    category: "交互",
    summary: "鼠标移动时显示经纬度，点击落一个点。",
    code: `app.interaction.on("move", (event) => {
  if (event.lngLat) {
    app.ui.tooltip.show(event.lngLat.longitude.toFixed(4) + ", " + event.lngLat.latitude.toFixed(4))
  }
})
app.interaction.on("click", (event) => {
  if (!event.lngLat) return
  app.graphics.addPoint({
    positions: [event.lngLat.longitude, event.lngLat.latitude],
    style: { color: "#F2C94C", pixelSize: 12, outlineColor: "#333333" },
  })
})

await app.camera.flyTo([120.16, 30.26, 60000], 1.5)
`,
  },
  {
    id: "interaction-pick",
    title: "Manual Pick",
    category: "交互",
    summary: "用按钮拾取屏幕中心位置并打印结果。",
    code: `const viewer = app.native.viewer

gui.addToolbarButton("拾取屏幕中心", () => {
  const hit = app.interaction.pickGraphic({
    x: viewer.canvas.width / 2,
    y: viewer.canvas.height / 2,
  })
  console.log("pick", hit ? hit.id : "nothing")
})

await app.camera.flyTo([120.16, 30.26, 200000], 1.5)
`,
  },
  {
    id: "measure",
    title: "Measure",
    category: "分析",
    summary: "测量三维距离、椭球高差和方位角。",
    code: `const from = [120.10, 30.20, 0]
const to = [120.22, 30.32, 120]

const distance = await app.analysis.measure.distance({ positions: [from, to] })
const height = await app.analysis.measure.height({ from, to })
const heading = await app.analysis.measure.heading({ from, to })

app.graphics.addPolyline({
  positions: [from, to],
  style: { color: "#36CFC9", width: 3, clampToGround: false },
})

app.ui.tooltip.show(
  \`\${(distance.meters / 1000).toFixed(2)} km / h \${height.meters.toFixed(0)} m / \${heading.degrees.toFixed(1)}°\`
)

await app.camera.flyTo([120.16, 30.26, 90000], 1.5)
`,
  },
  {
    id: "measure-area",
    title: "Measure Area",
    category: "分析",
    summary: "计算多边形面积与周长，切换测地线/平面模式。",
    code: `const ring = [
  [120.10, 30.20],
  [120.22, 30.20],
  [120.22, 30.32],
  [120.10, 30.32],
]
app.graphics.addPolygon({
  positions: ring,
  style: { fill: "#2F80ED44", outlineColor: "#56CCF2", outlineWidth: 2 },
})

gui.addToolbarButton("面积 / 周长", async () => {
  const area = await app.analysis.measure.area({ positions: ring })
  const perimeter = await app.analysis.measure.distance({ positions: ring.concat([ring[0]]) })
  console.log("area m2", area.squareMeters.toFixed(0), "perimeter m", perimeter.meters.toFixed(0))
})
gui.addMenubarItem("面积模式", ["测地线", "平面"], "测地线", async (value) => {
  const mode = value === "平面" ? "planar" : "geodesic"
  const result = await app.analysis.measure.area({ positions: ring, mode })
  console.log(mode, "area m2", result.squareMeters.toFixed(0))
})

await app.camera.flyTo([120.16, 30.26, 70000], 1.5)
`,
  },
  {
    id: "analysis-task",
    title: "Analysis Task",
    category: "分析",
    summary: "以任务形式运行测量，并执行一个自定义算法。",
    code: `const task = await app.analysis.measure.distanceTask({
  positions: [
    [120.10, 30.20],
    [120.22, 30.32],
  ],
})
console.log("task", task.status, task.algorithm, task.value ? task.value.meters.toFixed(1) + " m" : "-")

gui.addToolbarButton("自定义任务", async () => {
  const custom = await app.analysis.run({
    algorithm: "demo.answer",
    input: {},
    execute: async () => ({ value: { answer: 42 } }),
  })
  console.log("custom", custom.status, JSON.stringify(custom.value))
})

await app.camera.flyTo([120.16, 30.26, 60000], 1.4)
`,
  },
  {
    id: "terrain-profile",
    title: "Terrain Profile",
    category: "分析",
    summary: "采样地形高度、坡度，并沿两点生成剖面。",
    code: `const from = [120.10, 30.20]
const to = [120.22, 30.32]

const height = await app.analysis.terrain.sampleHeight({ position: from })
const slope = await app.analysis.terrain.slope({ position: from, sampleMeters: 30 })
const profile = await app.analysis.terrain.profile({ positions: [from, to], samples: 16 })

app.graphics.addPolyline({
  positions: [from, to],
  style: { color: "#FADB14", width: 3, clampToGround: true },
})

app.ui.tooltip.show(
  \`h \${height.height.toFixed(1)} m / slope \${slope.slopeDegrees.toFixed(1)}° / \${profile.points.length} pts\`
)

await app.camera.flyTo([120.16, 30.26, 90000], 1.5)
`,
  },
  {
    id: "line-of-sight",
    title: "Line of Sight",
    category: "分析",
    summary: "两点通视检测，并绘制径向视域贴地包络。",
    code: `const from = [120.10, 30.20, 80]
const to = [120.22, 30.32, 80]

const sight = await app.analysis.visibility.lineOfSight({ from, to, samples: 24 })
const viewshed = await app.analysis.visibility.viewshed({
  observer: from,
  radius: 4000,
  rays: 12,
  observerHeight: 20,
  draw: true,
})

app.graphics.addPolyline({
  positions: [from, to],
  style: { color: sight.visible ? "#73D13D" : "#FF4D4F", width: 4 },
})

app.ui.tooltip.show(
  \`los \${sight.visible} / viewshed \${viewshed.visibleCount}/\${viewshed.rayCount} / r \${viewshed.rays[0].rangeMeters.toFixed(0)} m\`
)

await app.camera.flyTo([120.16, 30.26, 90000], 1.5)
`,
  },
  {
    id: "viewshed-radius",
    title: "Viewshed",
    category: "分析",
    summary: "用滑块调整视域半径，并手动清除绘制。",
    code: `const observer = [120.16, 30.26, 30]

gui.addSlider("可视半径 m", { min: 500, max: 5000, value: 2500, step: 250 }, async (radius) => {
  try {
    const result = await app.analysis.visibility.viewshed({
      observer,
      radius,
      rays: 24,
      observerHeight: 20,
      draw: true,
    })
    console.log("viewshed", result.visibleCount + "/" + result.rayCount)
  } catch (error) {
    console.warn("viewshed needs terrain", error && error.message)
  }
})
gui.addToolbarButton("清除绘制", () => app.analysis.visibility.clearOverlay())

await app.camera.flyTo([120.16, 30.26, 80000], 1.5)
`,
  },
  {
    id: "buffer-radius",
    title: "Buffer",
    category: "分析",
    summary: "用滑块实时重算点位缓冲多边形。",
    code: `const center = [120.16, 30.26]
const style = { fill: "#27AE6055", outlineColor: "#6FCF97", outlineWidth: 2 }

function render(meters) {
  if (app.graphics.get("buffer")) app.graphics.remove("buffer")
  app.graphics.addPolygon({
    id: "buffer",
    positions: app.analysis.buffer.point(center, meters, 64),
    style,
  })
}

gui.addSlider("缓冲半径 m", { min: 200, max: 3000, value: 1000, step: 100 }, render)
render(1000)

await app.camera.flyTo([120.16, 30.26, 120000], 1.5)
`,
  },
  {
    id: "query-distance",
    title: "Distance Query",
    category: "分析",
    summary: "用滑块按距离筛选城市点。",
    code: `const cities = [
  ["Beijing", 116.40, 39.91],
  ["Shanghai", 121.47, 31.23],
  ["Guangzhou", 113.26, 23.13],
  ["Chengdu", 104.06, 30.67],
]
cities.forEach((city) => {
  app.graphics.addPoint({
    id: "city-" + city[0],
    positions: [city[1], city[2]],
    style: { color: "#2D9CDB", pixelSize: 14, outlineColor: "#FFFFFF" },
  })
})

gui.addSlider("半径 km", { min: 200, max: 2500, value: 1200, step: 100 }, async (km) => {
  const hits = await app.analysis.query.distance({ position: [116.40, 39.91], meters: km * 1000 })
  console.log("within", km + "km ->", hits.graphics.map((hit) => hit.id).join(", ") || "none")
})

await app.camera.flyTo([118.0, 34.0, 2600000], 1.7)
`,
  },
  {
    id: "spatial-query",
    title: "Spatial Query",
    category: "分析",
    summary: "按矩形范围查询 Graphic。",
    code: `app.graphics.addPoint({
  id: "hangzhou",
  positions: [120.16, 30.26],
  style: { color: "#FF7A45", pixelSize: 16 },
})
app.graphics.addPoint({
  id: "shanghai",
  positions: [121.47, 31.23],
  style: { color: "#40A9FF", pixelSize: 16 },
})

const hits = await app.analysis.query.rectangle({
  west: 120.0,
  south: 30.0,
  east: 120.4,
  north: 30.5,
})

app.ui.tooltip.show(hits.graphics.map((item) => item.id).join(", ") || "none")
await app.camera.flyTo([120.8, 30.7, 600000], 1.6)
`,
  },
  {
    id: "heatmap",
    title: "Heatmap",
    category: "分析",
    summary: "生成随机热力点，用开关控制显示。",
    code: `const points = []
for (let i = 0; i < 160; i += 1) {
  points.push({
    longitude: 120.11 + Math.random() * 0.1,
    latitude: 30.21 + Math.random() * 0.1,
    value: Math.random() * 100,
  })
}

gui.addToolbarButton("渲染热力图", () => {
  app.analysis.heatmap.setData(points, { radius: 200 })
  console.log("heatmap points", points.length)
})
gui.addToggleButton("显示", true, (on) => app.analysis.heatmap.setVisible(on))
gui.addToolbarButton("清除", () => app.analysis.heatmap.clear())

await app.camera.flyTo([120.16, 30.26, 90000], 1.5)
`,
  },
  {
    id: "flood",
    title: "Flood",
    category: "分析",
    summary: "用滑块控制水位，观察洪水淹没范围。",
    code: `const region = [
  [120.10, 30.20],
  [120.22, 30.20],
  [120.22, 30.32],
  [120.10, 30.32],
]
app.graphics.addPolygon({
  positions: region,
  style: { fill: "#1890FF22", outlineColor: "#69C0FF" },
})
app.analysis.flood.setRegion(region)

gui.addSlider("水位 m", { min: 0, max: 80, value: 30, step: 1 }, (level) => {
  try {
    app.analysis.flood.setWaterLevel(level)
  } catch (error) {
    console.warn("flood needs terrain", error && error.message)
  }
})
gui.addToolbarButton("清除洪水", () => app.analysis.flood.clear())

await app.camera.flyTo([120.16, 30.26, 80000], 1.5)
`,
  },
  {
    id: "swipe",
    title: "Swipe",
    category: "分析",
    summary: "装载两张影像后，用滑块做上下卷帘对比。",
    code: `let ready = false
gui.addToolbarButton("装载对比图层", async () => {
  try {
    const left = await app.layers.imagery.add({
      id: "swipe-left",
      type: "arcgis",
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    })
    const right = await app.layers.imagery.add({
      id: "swipe-right",
      type: "arcgis",
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
    })
    app.analysis.swipe.addLayer(left.native, "left").addLayer(right.native, "right").setPosition(0.5)
    ready = true
    console.log("swipe layers ready")
  } catch (error) {
    console.warn("swipe load failed", error && error.message)
  }
})
gui.addSlider("分割位置", { min: 0, max: 1, value: 0.5, step: 0.01 }, (value) => {
  if (ready) app.analysis.swipe.setPosition(value)
})

await app.camera.flyTo([116.40, 39.91, 1400000], 1.6)
`,
  },
  {
    id: "clip-box",
    title: "Clip Box",
    category: "分析",
    summary: "用包围盒剖切地球，并打开地形夸张。",
    code: `app.analysis.terrain.setExaggeration(2)
app.analysis.clip.setBox({
  west: 119.9,
  south: 30.1,
  east: 120.4,
  north: 30.4,
})

console.log("clip", app.analysis.clip.list())
gui.addToolbarButton("清除剖切", () => app.analysis.clip.clear())
await app.camera.flyTo([120.16, 30.26, 180000], 1.8)
`,
  },
  {
    id: "cut-fill",
    title: "Cut Fill",
    category: "分析",
    summary: "多边形内网格采样计算挖填方，并做开挖剖切。",
    code: `const positions = [
  [120.10, 30.20],
  [120.22, 30.20],
  [120.22, 30.32],
  [120.10, 30.32],
]

app.graphics.addPolygon({
  positions,
  style: { fill: "#FA8C1666", outlineColor: "#FFD591" },
})

const earthwork = await app.analysis.volume.cutFill({
  positions,
  samples: 12,
  designHeight: 10,
})
await app.analysis.volume.excavate({ positions, depth: 40 })

app.ui.tooltip.show(
  \`cut \${earthwork.cutCubicMeters.toFixed(0)} m3 / fill \${earthwork.fillCubicMeters.toFixed(0)} m3\`
)

await app.camera.flyTo([120.16, 30.26, 90000], 1.6)
`,
  },
  {
    id: "postprocess",
    title: "PostProcess",
    category: "特效",
    summary: "用开关控制 Bloom、雾和亮度校正。",
    code: `app.effects.postprocess.setBloom(true, { sigma: 3, delta: 1 })
app.effects.postprocess.setFog(true, { density: 0.0006 })
app.effects.postprocess.setColorCorrection(true, { brightness: 1.15 })

gui.addToggleButton("Bloom", true, (on) => app.effects.postprocess.setBloom(on, { sigma: 3, delta: 1 }))
gui.addToggleButton("雾", true, (on) => app.effects.postprocess.setFog(on, { density: 0.0006 }))
gui.addToggleButton("校色", true, (on) => app.effects.postprocess.setColorCorrection(on, { brightness: 1.15 }))

await app.camera.flyTo([104.06, 30.67, 1800000], 2)
`,
  },
  {
    id: "postprocess-dof",
    title: "Depth of Field",
    category: "特效",
    summary: "开启景深与描边，用滑块调焦。",
    code: `app.effects.postprocess.setDepthOfField(true, { focalDistance: 1000, focalWidth: 300 })

gui.addToggleButton("景深", true, (on) =>
  app.effects.postprocess.setDepthOfField(on, { focalDistance: 1000, focalWidth: 300 }),
)
gui.addToggleButton("描边", false, (on) => app.effects.postprocess.setOutline(on))
gui.addSlider("焦距", { min: 100, max: 5000, value: 1000, step: 100 }, (focalDistance) => {
  app.effects.postprocess.setDepthOfField(true, { focalDistance, focalWidth: 300 })
})

await app.camera.flyTo([120.16, 30.26, 1500], 2)
`,
  },
  {
    id: "materials",
    title: "Materials",
    category: "特效",
    summary: "注册自定义材质工厂，并查询已注册列表。",
    code: `app.effects.materials.register("highlight", (options) => {
  return (options && options.color) ? options.color : "#FF0000"
})

gui.addToolbarButton("创建材质", () => {
  const value = app.effects.materials.create("highlight", { color: "#00E5FF" })
  console.log("material value", value)
})
gui.addToolbarButton("已注册材质", () => console.log("materials", app.effects.materials.list()))
gui.addToolbarButton("是否已注册", () => console.log("has highlight", app.effects.materials.has("highlight")))

await app.camera.flyTo([120.16, 30.26, 80000], 1.6)
`,
  },
  {
    id: "weather",
    title: "Weather",
    category: "特效",
    summary: "用下拉菜单切换天气效果。",
    code: `gui.addMenubarItem("天气", ["无", "雨", "雪", "雾", "闪电"], "无", (value) => {
  app.effects.weather.clear()
  const map = { 雨: "rain", 雪: "snow", 雾: "fog", 闪电: "lightning" }
  const kind = map[value]
  if (kind) {
    app.effects.weather.enable(kind)
    console.log("weather", kind)
  }
})

await app.camera.flyTo([104.06, 30.67, 1200000], 1.8)
`,
  },
  {
    id: "particles",
    title: "Particles",
    category: "特效",
    summary: "创建火焰、爆炸和水炮粒子，并可销毁。",
    code: `let fire = null
let explosion = null
let water = null

gui.addToolbarButton("火焰", () => {
  if (fire) fire.destroy()
  fire = sdk.effects.createFireParticle(app.context, { longitude: 120.16, latitude: 30.26, height: 50 })
})
gui.addToolbarButton("爆炸", () => {
  if (explosion) explosion.destroy()
  explosion = sdk.effects.createExplosionParticle(app.context, { longitude: 120.20, latitude: 30.30, height: 60 })
})
gui.addToolbarButton("水炮", () => {
  if (water) water.destroy()
  const source = { longitude: 120.10, latitude: 30.20, height: 20 }
  const target = { longitude: 120.24, latitude: 30.34, height: 10 }
  water = sdk.effects.createWaterGunParticle(app.context, source, target)
})

await app.camera.flyTo([120.16, 30.26, 40000], 1.5)
`,
  },
  {
    id: "plotting-arrow",
    title: "Plot Arrow",
    category: "标绘",
    summary: "用下拉菜单切换军标箭头类型。",
    code: `const anchors = [
  { longitude: 120.10, latitude: 30.20 },
  { longitude: 120.20, latitude: 30.26 },
  { longitude: 120.30, latitude: 30.20 },
]
let handle = null

function draw(symbol) {
  if (handle) app.plotting.remove(handle.id)
  try {
    handle = app.plotting.draw(symbol, {
      positions: anchors,
      style: { fillColor: "#F2C94C66", color: "#F2994A", outlineColor: "#F2994A" },
    })
  } catch (error) {
    console.warn("plot failed", error && error.message)
  }
}

gui.addMenubarItem("箭头类型", ["简单箭头", "攻击箭头", "钳击箭头"], "攻击箭头", (value) => {
  const map = { 简单箭头: "lineArrow", 攻击箭头: "attackArrow", 钳击箭头: "pincerArrow" }
  draw(map[value])
})
draw("attackArrow")

await app.camera.flyTo([120.20, 30.24, 60000], 1.5)
`,
  },
  {
    id: "plotting-shapes",
    title: "Plot Shapes",
    category: "标绘",
    summary: "用下拉菜单切换圆、椭圆、扇形和矩形。",
    code: `const anchors = [
  { longitude: 120.16, latitude: 30.26 },
  { longitude: 120.24, latitude: 30.30 },
  { longitude: 120.24, latitude: 30.22 },
]

gui.addMenubarItem("标绘类型", ["圆", "椭圆", "扇形", "矩形"], "圆", (type) => {
  app.plotting.removeAll()
  const map = { 圆: "circle", 椭圆: "ellipse", 扇形: "sector", 矩形: "rectangle" }
  try {
    app.plotting.draw(map[type], {
      positions: anchors,
      style: { fillColor: "#BB6BD955", color: "#BB6BD9", outlineColor: "#BB6BD9" },
    })
  } catch (error) {
    console.warn("plot failed", error && error.message)
  }
})
gui.addToolbarButton("清除全部", () => app.plotting.removeAll())

await app.camera.flyTo([120.16, 30.26, 60000], 1.5)
`,
  },
  {
    id: "dynamic-spread",
    title: "Spread Point",
    category: "动态图形",
    summary: "创建动态扩散点，并支持移除。",
    code: `let spread = null
gui.addToolbarButton("创建扩散点", () => {
  spread = sdk.graphics.addSpreadPoint(app.context, {
    position: { longitude: 120.16, latitude: 30.26 },
    radius: 800,
    color: "#FF4D4F",
  })
  console.log("spread id", spread.id)
})
gui.addToolbarButton("移除", () => {
  if (spread) {
    spread.destroy()
    spread = null
  }
})

await app.camera.flyTo([120.16, 30.26, 40000], 1.5)
`,
  },
  {
    id: "dynamic-radar",
    title: "Radar Normal",
    category: "动态图形",
    summary: "用滑块调整雷达半径，实时重建。",
    code: `let radar = null

function build(radius) {
  if (radar) radar.destroy()
  radar = sdk.graphics.addRadarNormal(app.context, {
    position: { longitude: 120.16, latitude: 30.26 },
    radius,
    color: "#00FF88",
  })
}

gui.addSlider("半径 m", { min: 300, max: 3000, value: 1000, step: 100 }, build)
build(1000)

await app.camera.flyTo([120.16, 30.26, 40000], 1.5)
`,
  },
  {
    id: "dynamic-circle",
    title: "Circle Diffusion",
    category: "动态图形",
    summary: "创建圆形扩散动画，并移除。",
    code: `let circle = null
gui.addToolbarButton("圆形扩散", () => {
  circle = sdk.graphics.addCircleDiffusion(app.context, {
    position: { longitude: 120.16, latitude: 30.26 },
    radius: 1500,
    color: "rgba(0,255,255,0.5)",
  })
})
gui.addToolbarButton("移除", () => {
  if (circle) {
    circle.destroy()
    circle = null
  }
})

await app.camera.flyTo([120.16, 30.26, 60000], 1.5)
`,
  },
  {
    id: "dynamic-polyline",
    title: "Trail Line",
    category: "动态图形",
    summary: "创建动态轨迹线，并移除。",
    code: `let trail = null
gui.addToolbarButton("动态轨迹线", () => {
  trail = sdk.graphics.addDynamicPolyline(app.context, {
    positions: [
      [116.30, 39.85],
      [116.42, 39.95],
      [116.55, 39.88],
    ],
    color: "#FFD666",
    width: 8,
  })
})
gui.addToolbarButton("移除", () => {
  if (trail) {
    trail.destroy()
    trail = null
  }
})

await app.camera.flyTo([116.42, 39.92, 200000], 1.5)
`,
  },
  {
    id: "dynamic-billboard",
    title: "Billboard",
    category: "动态图形",
    summary: "添加一个广告牌图标，并移除。",
    code: `let board = null
gui.addToolbarButton("添加广告牌", () => {
  board = sdk.graphics.addBillboard(app.context, {
    position: { longitude: 120.16, latitude: 30.26 },
    image: "https://cdn.jsdelivr.net/gh/CesiumGS/cesium@1.146.0/Apps/SampleData/images/Cesium_Logo_overlay.png",
    scale: 1,
  })
})
gui.addToolbarButton("移除", () => {
  if (board) {
    board.destroy()
    board = null
  }
})

await app.camera.flyTo([120.16, 30.26, 50000], 1.5)
`,
  },
  {
    id: "dynamic-panel",
    title: "Panel",
    category: "动态图形",
    summary: "创建一个随距离缩放的信息面板，并移除。",
    code: `let panel = null
gui.addToolbarButton("创建热点面板", () => {
  panel = sdk.graphics.addPanel(app.context, {
    position: { longitude: 120.16, latitude: 30.26 },
    text: "监测站 A",
    type: "hot",
    near: 100,
    far: 200000,
  })
})
gui.addToolbarButton("移除", () => {
  if (panel) {
    panel.destroy()
    panel = null
  }
})

await app.camera.flyTo([120.16, 30.26, 60000], 1.5)
`,
  },
  {
    id: "model",
    title: "Model",
    category: "模型",
    summary: "加载 glTF 模型并作为 Graphic 管理。",
    code: `const model = app.graphics.addModel({
  id: "cesium-air",
  url: "https://cesium.com/downloads/cesiumjs/releases/1.146/Apps/SampleData/models/CesiumAir/Cesium_Air.glb",
  position: [120.16, 30.26, 200],
  scale: 1,
  minimumPixelSize: 96,
  heading: 90,
})

console.log("model id", model.id)
await app.camera.flyTo([120.16, 30.24, 1200], 2)
`,
  },
  {
    id: "model-flatten",
    title: "Model Flatten",
    category: "模型",
    summary: "用包围多边形压平模型，并支持开关与清除。",
    code: `const flatten = new sdk.graphics.ModelFlatten(app.context)
flatten.addPolygon([
  [120.10, 30.20],
  [120.22, 30.20],
  [120.22, 30.32],
  [120.10, 30.32],
])

gui.addToggleButton("启用压平", true, (on) => flatten.setEnabled(on))
gui.addToolbarButton("清除", () => flatten.clear())

await app.camera.flyTo([120.16, 30.26, 90000], 1.6)
`,
  },
  {
    id: "navigation-bar",
    title: "Navigation Bar",
    category: "导航服务",
    summary: "挂载/卸载导航条，复用控件按钮。",
    code: `let bar = null
gui.addToggleButton("导航条", false, (on) => {
  if (on) {
    bar = new sdk.ui.NavigationBar(app.context, {
      controls: ["zoomIn", "zoomOut", "home", "top", "mode"],
      zoomRatio: 0.5,
    })
    bar.mount()
    console.log("navigation bar mounted")
  } else if (bar) {
    bar.destroy()
    bar = null
  }
})

await app.camera.flyTo([116.40, 39.91, 1200000], 1.5)
`,
  },
  {
    id: "tooltip",
    title: "Tooltip",
    category: "导航服务",
    summary: "手动显示/隐藏 tooltip 文本。",
    code: `gui.addToolbarButton("显示提示", () => app.ui.tooltip.show("Hello from tooltip"))
gui.addToolbarButton("隐藏提示", () => app.ui.tooltip.hide())
gui.addSlider("停留时间 ms", { min: 0, max: 3000, value: 1000, step: 100 }, (duration) => {
  app.ui.tooltip.show("显示 " + duration + " ms")
  setTimeout(() => app.ui.tooltip.hide(), duration)
})

await app.camera.flyTo([120.16, 30.26, 2000000], 1.8)
`,
  },
  {
    id: "web-service",
    title: "Web Service",
    category: "导航服务",
    summary: "装配高德服务并做逆地理编码（需自备 key）。",
    code: `const key = window.localStorage.getItem("amap-key") || ""
if (!key) {
  console.warn("未检测到 amap-key，请先执行 localStorage.setItem('amap-key', '<你的 key>')")
}

gui.addToolbarButton("装配高德服务", () => {
  app.data.web.setProvider(sdk.data.createGaodeProvider({ key }))
  console.log("provider installed")
})
gui.addToolbarButton("逆地理编码", async () => {
  try {
    const result = await app.data.web.reverseGeocode({ longitude: 116.39, latitude: 39.9 })
    console.log("reverse", result)
  } catch (error) {
    console.warn(error && error.message)
  }
})

await app.camera.flyTo([116.40, 39.91, 300000], 1.4)
`,
  },
  {
    id: "capture-grid",
    title: "Capture Grid",
    category: "导航服务",
    summary: "把范围切分为 2x2 网格并逐格截图。",
    code: `const extent = {
  west: 120.05,
  south: 30.15,
  east: 120.27,
  north: 30.37,
}

gui.addToolbarButton("生成 2x2 网格截图", async () => {
  const shots = await sdk.scene.captureGrid(app.context, { rows: 2, columns: 2, extent })
  console.log("shots", shots.length)
  shots.forEach((shot) => console.log("shot", shot.row, shot.column, shot.extent))
})

await app.camera.flyTo([120.16, 30.26, 120000], 1.5)
`,
  },
]

const fallbackExample = examples[0] as SandcastleExample

export function findExample(id: string): SandcastleExample {
  return examples.find((item) => item.id === id) ?? fallbackExample
}
