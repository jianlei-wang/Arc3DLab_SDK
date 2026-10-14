import type {
  Arc3DContext,
  Extent,
  SceneModeName,
  SceneReadyOptions,
  SceneReadyResult,
  Unsubscribe,
} from "@arc3dlab/core"
import {
  getCesiumViewer,
  getNativeSceneModeName,
  morphNativeScene,
} from "@arc3dlab/engine-cesium"
import { Math as CesiumMath } from "cesium"
import { CameraController } from "./camera"
import { RenderController } from "./render"
import { ViewportController } from "./viewport"
import { ClockController } from "./clock"
import { EnvironmentController } from "./environment"
import {
  SyncViewer,
  type SyncableView,
  type SyncableCamera,
} from "./sync-viewer"
import {
  captureGrid,
  type ShotGridOptions,
  type ShotGridShot,
} from "./shot-grid"
import {
  PostRenderController,
  type RemovableEventListener,
} from "./post-render"
import {
  DEFAULT_VERTICAL_FOV,
  extentFromCenter,
  metersPerPixelAtHeight,
} from "./viewport-metrics"
import { scheduleSceneRestore } from "./morph"

const NOOP_EVENT_LISTENER: RemovableEventListener = {
  addEventListener: () => {},
  removeEventListener: () => {},
}

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
  /** 渲染后回调控制器。 */
  readonly postRender: PostRenderController
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
    const native = getCesiumViewer(context.engine.native.viewer) as {
      scene?: { postRender?: RemovableEventListener }
    }
    this.postRender = new PostRenderController(
      native.scene?.postRender ?? NOOP_EVENT_LISTENER,
    )
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
    return getNativeSceneModeName(this.viewer())
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
    morphNativeScene(viewer, mode)
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
   * 创建多屏联动，将当前视图相机变化同步到其他视图。
   * @param views - 需要跟随当前视图同步的其他视图。
   * @returns 多屏联动对象。
   */
  sync(views: SyncableView[]): SyncViewer {
    const viewer = this.viewer()
    return new SyncViewer({ camera: viewer.camera as SyncableCamera }, views)
  }

  /**
   * 按网格分幅导出场景图片。
   * @param options - 出图选项，含分幅行列数与出图范围。
   * @returns 每幅图片及其对应的经纬度范围。
   */
  captureGrid(options: ShotGridOptions): Promise<ShotGridShot[]> {
    return captureGrid(this.context, options)
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
   * 注册渲染后回调，在每帧渲染完成后触发。
   * @param listener - 无参回调。
   * @returns 用于取消订阅的函数。
   */
  onPostRender(listener: () => void): Unsubscribe {
    return this.postRender.on(listener)
  }

  /**
   * 估算当前视角下每像素对应的地面距离。
   * @returns 每像素对应的地面距离，单位为米。
   */
  scaleMetersPerPixel(): number {
    const viewer = this.viewer()
    const frustum = viewer.camera.frustum as unknown as { fovy?: number }
    const height = viewer.camera.positionCartographic.height
    const viewportHeight = viewer.canvas.clientHeight || viewer.canvas.height
    return metersPerPixelAtHeight(
      height,
      viewportHeight,
      frustum.fovy ?? DEFAULT_VERTICAL_FOV,
    )
  }

  /**
   * 计算当前相机的视域地理范围。
   * @returns 视域范围 `[west, south, east, north]`。
   */
  viewExtent(): Extent {
    const viewer = this.viewer()
    const carto = viewer.camera.positionCartographic
    const center = {
      longitude: CesiumMath.toDegrees(carto.longitude),
      latitude: CesiumMath.toDegrees(carto.latitude),
    }
    const metersPerPixel = this.scaleMetersPerPixel()
    const canvas = viewer.canvas
    return extentFromCenter(
      center,
      metersPerPixel * (canvas.clientWidth || canvas.width),
      metersPerPixel * (canvas.clientHeight || canvas.height),
    )
  }

  /**
   * 销毁场景控制器并取消未完成的形变恢复。
   */
  destroy(): void {
    this.cancelMorph?.()
    this.cancelMorph = undefined
    this.postRender.destroy()
  }
}
