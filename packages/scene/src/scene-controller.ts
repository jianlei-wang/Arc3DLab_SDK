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

/**
 * 场景控制器，聚合相机、渲染、视口、时钟与环境等子控制器并管理场景模式。
 */
export class SceneController {
  /** 相机控制器。 */
  readonly camera: CameraController
  /** 渲染控制器。 */
  readonly render: RenderController
  /** 视口控制器。 */
  readonly viewport: ViewportController
  /** 时钟控制器。 */
  readonly clock: ClockController
  /** 环境控制器。 */
  readonly environment: EnvironmentController
  private cancelMorph: (() => void) | undefined

  /**
   * 创建场景控制器并初始化各子控制器。
   * @param context - Arc3D 运行时上下文。
   */
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

  /**
   * 当前场景的投影模式名称。
   */
  get mode(): SceneModeName {
    const mode = this.viewer().scene.mode
    if (mode === SceneMode.SCENE2D) return "2d"
    if (mode === SceneMode.COLUMBUS_VIEW) return "columbus"
    return "3d"
  }

  /**
   * 切换场景投影模式，并在形变完成后恢复相机状态。
   * @param mode - 目标场景模式，可选 2d、columbus 或 3d。
   */
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

  /**
   * 当前画布的像素宽高。
   */
  get size(): { width: number; height: number } {
    const canvas = this.viewer().canvas
    return { width: canvas.width, height: canvas.height }
  }

  /**
   * 等待场景加载就绪，并广播就绪事件。
   * @param options - 可选的场景就绪等待参数。
   * @returns 场景就绪结果。
   */
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

  /**
   * 渲染一帧并将当前画布导出为 PNG 数据地址。
   * @returns Base64 编码的 PNG 数据 URL。
   */
  captureImage(): string {
    const viewer = this.viewer()
    viewer.render()
    return viewer.scene.canvas.toDataURL("image/png")
  }

  /**
   * 开启或关闭地形深度测试。
   * @param enabled - 是否启用地形深度测试。
   */
  setDepthTestAgainstTerrain(enabled: boolean): void {
    this.viewer().scene.globe.depthTestAgainstTerrain = enabled
  }

  /**
   * 显示或隐藏帧率调试信息。
   * @param visible - 是否显示每秒帧数。
   */
  setFpsVisible(visible: boolean): void {
    this.viewer().scene.debugShowFramesPerSecond = visible
  }

  /**
   * 开启或关闭地球光照及阴影效果。
   * @param enabled - 是否启用光照与阴影。
   */
  setLighting(enabled: boolean): void {
    const viewer = this.viewer()
    viewer.scene.globe.enableLighting = enabled
    viewer.shadows = enabled
  }

  /**
   * 销毁场景控制器并取消未完成的形变恢复。
   */
  destroy(): void {
    this.cancelMorph?.()
    this.cancelMorph = undefined
  }
}
