export interface SandcastleExample {
  id: string
  title: string
  category: string
  summary: string
  code: string
}

export const exampleCategories = ["入门", "图形", "相机", "场景", "交互"] as const

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
]

export function findExample(id: string): SandcastleExample {
  return examples.find((item) => item.id === id) ?? examples[0]
}
