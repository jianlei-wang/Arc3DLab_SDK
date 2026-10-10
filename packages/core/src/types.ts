export interface LngLat {
  longitude: number
  latitude: number
}

export interface LngLatHeight extends LngLat {
  height: number
}

export type AngleUnit = "degrees" | "radians"

export interface CameraPose {
  position: LngLatHeight
  heading: number
  pitch: number
  roll: number
  unit: AngleUnit
}

export interface WindowPosition {
  x: number
  y: number
}

export type SceneModeName = "2d" | "columbus" | "3d"

export type CreditMode = "default" | "compact" | "custom"

export type RenderMode = "auto" | "entity" | "primitive" | "buffer"

export type PositionInput =
  LngLat | LngLatHeight | [number, number] | [number, number, number]

export interface GraphicStyle {
  fill?: string
  outline?: boolean
  outlineColor?: string
  outlineWidth?: number
  pixelSize?: number
  width?: number
  color?: string
  clampToGround?: boolean
}

export interface LayerEvent {
  id: string
  type: string
}

export interface GraphicEvent {
  id: string
  type: string
}

export type PickKind =
  "graphic" | "layer" | "tiles-feature" | "terrain" | "native" | "empty"

export interface PickResult {
  kind?: PickKind
  graphicId?: string
  layerId?: string
  lngLat?: LngLatHeight
  windowPosition: WindowPosition
  native?: unknown
}

export interface CameraState extends CameraPose {
  capturedAt: number
}

export interface Arc3DEvents {
  ready: Record<string, never>
  sceneReady: SceneReadyResult
  destroy: Record<string, never>
  cameraChanged: CameraState
  layerAdded: LayerEvent
  layerRemoved: LayerEvent
  graphicAdded: GraphicEvent
  graphicRemoved: GraphicEvent
  pick: PickResult
  error: { message: string; code?: string }
}

export interface EngineViewerOptions {
  container: string | Element
  ionToken?: string
  defaultViewRectangle?: [number, number, number, number]
  sceneMode?: SceneModeName
  depthTestAgainstTerrain?: boolean
  resolutionScale?: number | "auto"
  controls?: "default" | "mapbox"
  fpsShow?: boolean
  creditMode?: CreditMode
  defaultBaseLayer?: boolean
  onError?: (error: { message: string; code?: string }) => void
}

export interface EngineViewer {
  readonly canvas: HTMLCanvasElement
  readonly container: Element
  readonly native: unknown
  setCreditMode(mode: CreditMode, element?: Element): void
  requestRender(reason?: string): void
  destroy(): void
  whenSceneReady?(options?: SceneReadyOptions): Promise<SceneReadyResult>
}

export type DefaultBaseLayerState = "disabled" | "loading" | "ready" | "failed"

export interface SceneReadyOptions {
  timeoutMs?: number
}

export interface SceneReadyResult {
  ready: boolean
  remainingTiles: number
  timedOut: boolean
  destroyed: boolean
  defaultBaseLayer: DefaultBaseLayerState
}

export interface Engine {
  readonly type: string
  createViewer(options: EngineViewerOptions): EngineViewer
  hasCapability(name: string): boolean
  mapError(error: unknown): { message: string; code?: string }
  destroy(): void
}

export interface EngineContext {
  readonly type: string
  readonly viewer: EngineViewer
  readonly native: {
    viewer: unknown
  }
  readonly engine?: Engine
}

export interface Arc3DConfig {
  container: string | Element
  engine?: {
    type?: "cesium"
    cesium?: {
      ionToken?: string
      defaultViewRectangle?: [number, number, number, number]
      defaultBaseLayer?: boolean
    }
  }
  scene?: {
    mode?: SceneModeName
    depthTestAgainstTerrain?: boolean
    resolutionScale?: number | "auto"
    controls?: "default" | "mapbox"
    fpsShow?: boolean
    creditMode?: CreditMode
  }
  tokens?: {
    cesiumIon?: string
    tdt?: string
  }
  logger?: {
    level?: "debug" | "info" | "warn" | "error" | "silent"
  }
}
