export interface SandcastleExample {
  id: string
  title: string
  category: string
  summary: string
  code: string
}

export const exampleCategories = ["入门", "图形", "相机", "场景", "交互", "分析", "模型"] as const

export const examples: SandcastleExample[] = [
  {
    id: "hello-world",
    title: "Hello World",
    category: "入门",
    summary: "创建 Arc3DApp 并飞到中国上空。运行时已注入 app。",
    code: `// app 已由 Sandcastle 创建，直接调用公共 API。
app.performance.setFpsVisible(false)
await app.camera.flyTo([104.06, 30.67, 4200000], 2)
`,
  },
  {
    id: "polygon",
    title: "Polygon",
    category: "图形",
    summary: "用 graphics.addPolygon 绘制贴地面。",
    code: `const polygon = app.graphics.addPolygon({
  positions: [
    [120.10, 30.20],
    [120.22, 30.20],
    [120.22, 30.32],
    [120.10, 30.32],
  ],
  style: {
    fill: "#2F80ED88",
    outline: true,
    outlineColor: "#FFFFFF",
    outlineWidth: 2,
  },
})

await app.camera.flyTo([120.16, 30.26, 90000], 1.6)
console.log("polygon id", polygon.id)
`,
  },
  {
    id: "points",
    title: "Points",
    category: "图形",
    summary: "批量加点，并打开 FPS 方便观察渲染。",
    code: `app.performance.setFpsVisible(true)

app.graphics.addPoints({
  positions: [
    [116.40, 39.91],
    [121.47, 31.23],
    [113.26, 23.13],
    [104.07, 30.67],
  ],
  style: {
    color: "#FF4D4F",
    outlineColor: "#FFE58F",
    pixelSize: 14,
    outlineWidth: 2,
  },
})

await app.camera.flyTo([110.0, 32.0, 2800000], 2)
`,
  },
  {
    id: "polyline",
    title: "Polyline",
    category: "图形",
    summary: "城市之间连线，clampToGround 贴地。",
    code: `app.graphics.addPolyline({
  positions: [
    [116.40, 39.91],
    [118.80, 32.06],
    [121.47, 31.23],
    [120.16, 30.25],
  ],
  style: {
    color: "#FAAD14",
    width: 4,
    clampToGround: true,
  },
})

await app.camera.flyTo([119.2, 32.4, 900000], 1.8)
`,
  },
  {
    id: "camera-fly",
    title: "Camera FlyTo",
    category: "相机",
    summary: "连续飞向两个目标，并打印相机状态。",
    code: `await app.camera.flyTo([116.40, 39.91, 180000], 1.4)
await app.camera.flyTo([121.47, 31.23, 120000], 1.8)

const state = app.camera.getState()
console.log("heading / pitch", state.heading.toFixed(1), state.pitch.toFixed(1))
`,
  },
  {
    id: "scene-mode",
    title: "Scene Mode",
    category: "场景",
    summary: "在 3D 与哥伦布视图之间切换。",
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
app.scene.setMode("columbus")
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
    id: "postprocess",
    title: "PostProcess",
    category: "场景",
    summary: "打开 Bloom、雾和亮度校正。",
    code: `app.effects.postprocess.setBloom(true, { sigma: 3, delta: 1 })
app.effects.postprocess.setFog(true, { density: 0.0006 })
app.effects.postprocess.setColorCorrection(true, { brightness: 1.15 })

console.log("postprocess", app.effects.postprocess.list())
await app.camera.flyTo([104.06, 30.67, 1800000], 2)
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
    id: "hover-select",
    title: "Hover + Selection",
    category: "交互",
    summary: "悬停显示 Graphic id，点击写入 selection。",
    code: `app.graphics.addPolygon({
  id: "hangzhou-block",
  positions: [
    [120.10, 30.20],
    [120.22, 30.20],
    [120.22, 30.32],
    [120.10, 30.32],
  ],
  style: { fill: "#9254DE66", outlineColor: "#F9F0FF" },
})

app.interaction.on("hover", (event) => {
  if (event.graphic) app.ui.tooltip.show(event.graphic.id)
  else app.ui.tooltip.hide()
})

app.interaction.on("click", () => {
  const selected = app.interaction.selection.get()
  console.log("selected", selected?.id)
})

await app.camera.flyTo([120.16, 30.26, 80000], 1.5)
`,
  },
  {
    id: "model",
    title: "Model",
    category: "模型",
    summary: "加载 glTF 模型并作为 Graphic 管理。",
    code: `const model = app.graphics.addModel({
  id: "cesium-air",
  url: "https://cdn.jsdelivr.net/gh/CesiumGS/cesium@1.146.0/Apps/SampleData/models/CesiumAir/Cesium_Air.glb",
  position: [120.16, 30.26, 200],
  scale: 1,
  minimumPixelSize: 96,
  heading: 90,
})

console.log("model id", model.id)
await app.camera.flyTo([120.16, 30.24, 1200], 2)
`,
  },
]

export function findExample(id: string): SandcastleExample {
  return examples.find((item) => item.id === id) ?? examples[0]
}
