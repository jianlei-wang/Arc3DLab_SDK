import type {
  Arc3DContext,
  SceneModeName,
  SceneReadyOptions,
  SceneReadyResult,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { SceneMode } from "cesium"
import { CameraController } from "./camera"
import { RenderController } from "./render"
import { ViewportController } from "./viewport"
import { ClockController } from "./clock"
import { EnvironmentController } from "./environment"
import { scheduleSceneRestore } from "./morph"

export class SceneController {
  readonly camera: CameraController
  readonly render: RenderController
  readonly viewport: ViewportController
  readonly clock: ClockController
  readonly environment: EnvironmentController
  private cancelMorph: (() => void) | undefined

  constructor(private readonly context: Arc3DContext) {
    this.camera = new CameraController(context)
    this.render = new RenderController(context)
    this.viewport = new ViewportController(context)
    this.clock = new ClockController(context)
    this.environment = new EnvironmentController(context)
    this.context.disposers.push(() => this.destroy())
  }

  private viewer() {
    this.context.lifecycle.assertUsable("use scene")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  get mode(): SceneModeName {
    const mode = this.viewer().scene.mode
    if (mode === SceneMode.SCENE2D) return "2d"
    if (mode === SceneMode.COLUMBUS_VIEW) return "columbus"
    return "3d"
  }

  setMode(mode: SceneModeName): void {
    const snapshot = this.camera.capture()
    const viewer = this.viewer()
    this.cancelMorph?.()
    this.cancelMorph = scheduleSceneRestore(() => {
      this.cancelMorph = undefined
      if (this.context.lifecycle.isTerminating) return
      this.camera.restore(snapshot)
    }, viewer.scene.morphComplete)
    if (mode === "2d") viewer.scene.morphTo2D(1)
    else if (mode === "columbus") viewer.scene.morphToColumbusView(1)
    else viewer.scene.morphTo3D(1)
  }

  get size(): { width: number; height: number } {
    const canvas = this.viewer().canvas
    return { width: canvas.width, height: canvas.height }
  }

  async whenSceneReady(options?: SceneReadyOptions): Promise<SceneReadyResult> {
    if (this.context.lifecycle.isTerminating) {
      return {
        ready: false,
        remainingTiles: 0,
        timedOut: false,
        destroyed: true,
        defaultBaseLayer: "disabled",
      }
    }
    const engineViewer = this.context.engine.viewer
    const result = engineViewer.whenSceneReady
      ? await engineViewer.whenSceneReady(options)
      : {
          ready: true,
          remainingTiles: 0,
          timedOut: false,
          destroyed: false,
          defaultBaseLayer: "disabled" as const,
        }
    this.context.events.emit("sceneReady", result)
    return result
  }

  captureImage(): string {
    const viewer = this.viewer()
    viewer.render()
    return viewer.scene.canvas.toDataURL("image/png")
  }

  setDepthTestAgainstTerrain(enabled: boolean): void {
    this.viewer().scene.globe.depthTestAgainstTerrain = enabled
  }

  setFpsVisible(visible: boolean): void {
    this.viewer().scene.debugShowFramesPerSecond = visible
  }

  setLighting(enabled: boolean): void {
    const viewer = this.viewer()
    viewer.scene.globe.enableLighting = enabled
    viewer.shadows = enabled
  }

  destroy(): void {
    this.cancelMorph?.()
    this.cancelMorph = undefined
  }
}
