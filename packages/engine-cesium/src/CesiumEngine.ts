import type {
  Engine,
  EngineContext,
  EngineViewer,
  EngineViewerOptions,
  CreditMode,
  DefaultBaseLayerState,
  SceneReadyOptions,
  SceneReadyResult,
} from "@arc3dlab/core"
import { Arc3DError, classifyLoadFailure } from "@arc3dlab/core"
import * as Cesium from "cesium"
import globeImg from "./assets/globe-img"
import { CreditManager } from "./credits"

function resolveContainer(container: string | Element): Element {
  if (typeof container !== "string") return container
  const el = document.getElementById(container)
  if (!el) {
    throw new Arc3DError(
      "INVALID_CONTAINER",
      `Container element not found: ${container}`,
    )
  }
  return el
}

function createDefaultBaseLayer():
  Promise<Cesium.ImageryLayer> | Cesium.ImageryLayer {
  return Cesium.ImageryLayer.fromProviderAsync(
    Cesium.SingleTileImageryProvider.fromUrl(globeImg),
    {},
  )
}

/**
 * 基于 Cesium 的引擎视图实现，封装原生 Viewer 与运行时配置。
 */
export class CesiumEngineViewer implements EngineViewer {
  /** Cesium 画布元素。 */
  readonly canvas: HTMLCanvasElement
  /** 视图挂载的容器元素。 */
  readonly container: Element
  /** 原生 Cesium Viewer 实例。 */
  readonly native: Cesium.Viewer
  /** 版权信息管理器。 */
  readonly credits: CreditManager
  private destroyed = false
  private defaultBaseLayerState: DefaultBaseLayerState = "disabled"

  /**
   * 创建并初始化 Cesium 引擎视图。
   * @param options - 引擎视图初始化选项。
   */
  constructor(options: EngineViewerOptions) {
    this.container = resolveContainer(options.container)

    const viewer = createCesiumViewer(this.container, options)

    this.native = viewer
    this.canvas = viewer.canvas
    this.credits = new CreditManager(viewer)
    this.credits.setMode(options.creditMode ?? "default")

    if (options.defaultBaseLayer !== false) {
      this.defaultBaseLayerState = "loading"
      void Promise.resolve(createDefaultBaseLayer())
        .then((layer) => {
          if (this.destroyed) return
          viewer.imageryLayers.add(layer, 0)
          this.defaultBaseLayerState = "ready"
        })
        .catch((error) => {
          if (this.destroyed) return
          this.defaultBaseLayerState = "failed"
          const message = error instanceof Error ? error.message : String(error)
          options.onError?.({ message, code: "ENGINE_FAILURE" })
        })
    }

    viewer.scene.globe.depthTestAgainstTerrain =
      options.depthTestAgainstTerrain ?? true
    viewer.clock.multiplier = 1
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true
    viewer.resolutionScale =
      options.resolutionScale === "auto" ||
      options.resolutionScale === undefined
        ? window.devicePixelRatio
        : options.resolutionScale
    viewer.scene.debugShowFramesPerSecond = options.fpsShow ?? false
    viewer.scene.requestRenderMode = true
    viewer.scene.maximumRenderTimeChange = Infinity

    if (options.controls === "mapbox") {
      applyMapboxControls(viewer)
    }

    const rect = options.defaultViewRectangle
    if (rect) {
      viewer.camera.setView({
        destination: Cesium.Rectangle.fromDegrees(
          rect[0],
          rect[1],
          rect[2],
          rect[3],
        ),
      })
    }
  }

  /**
   * 设置版权信息的展示模式。
   * @param mode - 版权展示模式。
   * @param element - 可选的自定义版权容器元素。
   */
  setCreditMode(mode: CreditMode, element?: Element): void {
    this.credits.setMode(mode, element)
  }

  /**
   * 请求渲染一帧画面。
   * @param _reason - 可选的请求原因，仅用于标注。
   */
  requestRender(_reason?: string): void {
    if (this.destroyed) return
    this.native.scene.requestRender()
  }

  /**
   * 等待场景与默认底图加载就绪。
   * @param options - 超时等就绪检测选项。
   * @returns 场景就绪结果的 Promise。
   */
  whenSceneReady(options: SceneReadyOptions = {}): Promise<SceneReadyResult> {
    const timeoutMs = options.timeoutMs ?? 20000
    const scene = this.native.scene
    const globe = scene.globe
    if (this.destroyed) {
      return Promise.resolve({
        ready: false,
        remainingTiles: 0,
        timedOut: false,
        destroyed: true,
        defaultBaseLayer: this.defaultBaseLayerState,
      })
    }

    return new Promise<SceneReadyResult>((resolve) => {
      let settled = false
      let remainingTiles = globe?.tilesLoaded ? 0 : 1
      let timer: ReturnType<typeof setTimeout> | undefined

      const cleanup = (): void => {
        if (timer !== undefined) clearTimeout(timer)
        globe?.tileLoadProgressEvent.removeEventListener(onProgress)
        scene.postRender.removeEventListener(onPostRender)
      }

      const settle = (timedOut: boolean): void => {
        if (settled) return
        settled = true
        cleanup()
        resolve({
          ready: !timedOut && !this.destroyed,
          remainingTiles: globe?.tilesLoaded ? 0 : remainingTiles,
          timedOut,
          destroyed: this.destroyed,
          defaultBaseLayer: this.defaultBaseLayerState,
        })
      }

      const maybeSettle = (): void => {
        const tilesLoaded = !globe || globe.tilesLoaded
        const baseSettled = this.defaultBaseLayerState !== "loading"
        if (tilesLoaded && baseSettled) settle(false)
      }

      const onProgress = (remaining: number): void => {
        remainingTiles = remaining
        maybeSettle()
      }
      const onPostRender = (): void => {
        maybeSettle()
      }

      timer =
        timeoutMs > 0 ? setTimeout(() => settle(true), timeoutMs) : undefined

      globe?.tileLoadProgressEvent.addEventListener(onProgress)
      scene.postRender.addEventListener(onPostRender)
      scene.requestRender()
      maybeSettle()
    })
  }

  /**
   * 销毁视图并释放原生 Cesium 资源。
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.native.destroy()
  }
}

/**
 * Cesium 引擎实现，负责创建视图并提供能力声明与错误映射。
 */
export class CesiumEngine implements Engine {
  /** 引擎类型标识。 */
  readonly type = "cesium"
  private viewer: CesiumEngineViewer | undefined
  private readonly capabilities = [
    "engine:cesium",
    "render:entity",
    "render:primitive",
    "graphic:model",
    "effects:postprocess",
  ]

  /**
   * 创建并返回一个 Cesium 引擎视图。
   * @param options - 引擎视图初始化选项。
   * @returns 已创建的引擎视图。
   */
  createViewer(options: EngineViewerOptions): EngineViewer {
    this.viewer = new CesiumEngineViewer(options)
    return this.viewer
  }

  /**
   * 判断引擎是否具备指定能力。
   * @param name - 能力名称。
   * @returns 具备该能力时返回 true。
   */
  hasCapability(name: string): boolean {
    return this.capabilities.includes(name)
  }

  /**
   * 将任意错误映射为统一的消息与错误码。
   * @param error - 待映射的错误。
   * @returns 包含消息与错误码的对象。
   */
  mapError(error: unknown): { message: string; code?: string } {
    const classified = classifyLoadFailure(error)
    return { message: classified.message, code: classified.code }
  }

  /**
   * 销毁引擎及其持有的视图。
   */
  destroy(): void {
    this.viewer?.destroy()
    this.viewer = undefined
  }
}

/**
 * 创建 Cesium 引擎运行时上下文。
 * @param options - 引擎视图初始化选项。
 * @returns 引擎运行时上下文。
 */
export function createCesiumEngineContext(
  options: EngineViewerOptions,
): EngineContext {
  const engine = new CesiumEngine()
  const viewer = engine.createViewer(options)
  return {
    type: engine.type,
    viewer,
    native: {
      viewer: viewer.native,
    },
    engine,
  }
}

/**
 * 将未知的原生对象断言为 Cesium Viewer。
 * @param native - 原生视图对象。
 * @returns 原生 Cesium Viewer 实例。
 */
export function getCesiumViewer(native: unknown): Cesium.Viewer {
  return native as Cesium.Viewer
}

function viewerConstructorOptions(
  options: EngineViewerOptions,
  webgl: { failIfMajorPerformanceCaveat: boolean; antialias: boolean },
): ConstructorParameters<typeof Cesium.Viewer>[1] {
  return {
    animation: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    timeline: false,
    sceneMode: toSceneMode(options.sceneMode ?? "3d"),
    scene3DOnly: (options.sceneMode ?? "3d") === "3d",
    baseLayerPicker: false,
    navigationHelpButton: false,
    vrButton: false,
    selectionIndicator: false,
    orderIndependentTranslucency: true,
    shouldAnimate: true,
    baseLayer: false,
    contextOptions: {
      webgl: {
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: webgl.failIfMajorPerformanceCaveat,
        antialias: webgl.antialias,
        alpha: true,
        powerPreference: "high-performance",
      },
      requestWebgl1: false,
    },
    shadows: false,
  }
}

function createCesiumViewer(
  container: Element,
  options: EngineViewerOptions,
): Cesium.Viewer {
  try {
    return new Cesium.Viewer(
      container,
      viewerConstructorOptions(options, {
        failIfMajorPerformanceCaveat: true,
        antialias: true,
      }),
    )
  } catch (error) {
    options.onError?.({
      message:
        "WebGL high-performance context failed; retrying with compatibility settings. Check GPU drivers and hardware acceleration.",
      code: "ENGINE_FAILURE",
    })
    try {
      return new Cesium.Viewer(
        container,
        viewerConstructorOptions(options, {
          failIfMajorPerformanceCaveat: false,
          antialias: false,
        }),
      )
    } catch (fallbackError) {
      throw new Arc3DError(
        "ENGINE_FAILURE",
        "WebGL initialization failed. Enable hardware acceleration and confirm the browser supports WebGL2.",
        fallbackError,
      )
    }
  }
}

function toSceneMode(mode: string): Cesium.SceneMode {
  if (mode === "2d") return Cesium.SceneMode.SCENE2D
  if (mode === "columbus") return Cesium.SceneMode.COLUMBUS_VIEW
  return Cesium.SceneMode.SCENE3D
}

function applyMapboxControls(viewer: Cesium.Viewer): void {
  viewer.scene.screenSpaceCameraController.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.MIDDLE_DRAG,
    Cesium.CameraEventType.PINCH,
  ]
  viewer.scene.screenSpaceCameraController.tiltEventTypes = [
    Cesium.CameraEventType.RIGHT_DRAG,
    Cesium.CameraEventType.PINCH,
    {
      eventType: Cesium.CameraEventType.RIGHT_DRAG,
      modifier: Cesium.KeyboardEventModifier.CTRL,
    },
    {
      eventType: Cesium.CameraEventType.MIDDLE_DRAG,
      modifier: Cesium.KeyboardEventModifier.CTRL,
    },
  ]
}
