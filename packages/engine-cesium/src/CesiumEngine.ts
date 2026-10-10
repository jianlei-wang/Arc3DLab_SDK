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

export class CesiumEngineViewer implements EngineViewer {
  readonly canvas: HTMLCanvasElement
  readonly container: Element
  readonly native: Cesium.Viewer
  readonly credits: CreditManager
  private destroyed = false
  private defaultBaseLayerState: DefaultBaseLayerState = "disabled"

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

  setCreditMode(mode: CreditMode, element?: Element): void {
    this.credits.setMode(mode, element)
  }

  requestRender(_reason?: string): void {
    if (this.destroyed) return
    this.native.scene.requestRender()
  }

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

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.native.destroy()
  }
}

export class CesiumEngine implements Engine {
  readonly type = "cesium"
  private viewer: CesiumEngineViewer | undefined
  private readonly capabilities = [
    "engine:cesium",
    "render:entity",
    "render:primitive",
    "graphic:model",
    "effects:postprocess",
  ]

  createViewer(options: EngineViewerOptions): EngineViewer {
    this.viewer = new CesiumEngineViewer(options)
    return this.viewer
  }

  hasCapability(name: string): boolean {
    return this.capabilities.includes(name)
  }

  mapError(error: unknown): { message: string; code?: string } {
    const classified = classifyLoadFailure(error)
    return { message: classified.message, code: classified.code }
  }

  destroy(): void {
    this.viewer?.destroy()
    this.viewer = undefined
  }
}

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
