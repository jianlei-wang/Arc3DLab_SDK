import { Arc3D } from "../src/index"
import type { LngLat, SceneReadyResult } from "../src/index"
import { SwipeComparison } from "@arc3dlab/analysis"

declare global {
  interface Window {
    __ARC3D_READY__?: SceneReadyResult
    __ARC3D_REPORT__?: Record<string, unknown>
    __ARC3D_ERROR__?: string
  }
}

const POINT: [number, number, number] = [116.391, 39.906, 0]
const FAR_POINT: [number, number, number] = [116.401, 39.916, 0]

const PLOT_ANCHORS: LngLat[] = [
  { longitude: 116.386, latitude: 39.902 },
  { longitude: 116.396, latitude: 39.91 },
  { longitude: 116.402, latitude: 39.9 },
]

function nextFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number): void => {
      if (remaining <= 0) {
        resolve()
        return
      }
      window.requestAnimationFrame(() => step(remaining - 1))
    }
    step(count)
  })
}

async function boot(): Promise<void> {
  try {
    const app = await Arc3D.create({ container: "app" })
    const report: Record<string, unknown> = {}

    report.ready = await app.scene.whenSceneReady({ timeoutMs: 20000 })

    const graphic = app.graphics.addPoint({
      positions: POINT,
      style: { pixelSize: 14, color: "#ff2d55" },
    })
    report.graphicId = graphic.id

    app.camera.lookAt(POINT, 5000)
    await nextFrames(3)

    const canvas = document.querySelector<HTMLCanvasElement>("#app canvas")
    const center = {
      x: canvas ? canvas.clientWidth / 2 : 0,
      y: canvas ? canvas.clientHeight / 2 : 0,
    }
    const picked = app.interaction.pick(center)
    report.pickKind = picked.kind
    report.pickGraphicId = picked.graphicId

    const distance = await app.analysis.measure.distance({
      positions: [POINT, FAR_POINT],
    })
    report.distanceMeters = distance.meters

    const plot = app.plotting.draw("attackArrow", {
      positions: PLOT_ANCHORS,
      style: { color: "#00e5ff", fillColor: "#00e5ff" },
    })
    report.plotId = plot.id
    report.plotShapeCount = plot.shapes.length

    app.effects.weather.enable("rain")
    report.weatherEnabled = true
    app.effects.weather.disable("rain")
    report.weatherDisabled = true

    const swipe = new SwipeComparison(app.context, "vertical")
    swipe.setPosition(0.35)
    report.swipePosition = swipe.getPosition()
    swipe.setActive(false)
    swipe.setActive(true)
    swipe.destroy()
    report.swipeDestroyed = true

    await app.destroy()
    report.destroyed = true

    const rebuilt = await Arc3D.create({ container: "app" })
    report.rebuiltReady = (
      await rebuilt.scene.whenSceneReady({ timeoutMs: 20000 })
    ).ready

    window.__ARC3D_REPORT__ = report
    window.__ARC3D_READY__ = report.ready as SceneReadyResult
  } catch (error) {
    window.__ARC3D_ERROR__ =
      error instanceof Error ? error.message : String(error)
  }
}

void boot()
