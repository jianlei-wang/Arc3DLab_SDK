/**
 * 经纬度坐标（WGS84、度）。
 *
 * 使用经度/纬度数值表达，不携带高程；需要高程时使用 {@link LngLatHeight}。
 */
export interface LngLat {
  /** 经度（度）。 */
  longitude: number
  /** 纬度（度）。 */
  latitude: number
}

/** 带高程的经纬度坐标；高程为椭球高（米）。 */
export interface LngLatHeight extends LngLat {
  /** 椭球高（米）。 */
  height: number
}

/** 角度单位：`degrees`（度）或 `radians`（弧度）。 */
export type AngleUnit = "degrees" | "radians"

/** 相机位姿。 */
export interface CameraPose {
  /** 相机位置。 */
  position: LngLatHeight
  /** 航向角。 */
  heading: number
  /** 俯仰角。 */
  pitch: number
  /** 翻滚角。 */
  roll: number
  /** 角度单位。 */
  unit: AngleUnit
}

/** 屏幕坐标（CSS 像素，相对画布左上角）。 */
export interface WindowPosition {
  /** 水平像素坐标。 */
  x: number
  /** 垂直像素坐标。 */
  y: number
}

/** 场景模式名称。 */
export type SceneModeName = "2d" | "columbus" | "3d"

/** Credits 展示模式。 */
export type CreditMode = "default" | "compact" | "custom"

/** 图形渲染模式：`auto` 自动选择，其余为显式指定。 */
export type RenderMode = "auto" | "entity" | "primitive" | "buffer"

/** 位置输入，接受对象或元组形式。 */
export type PositionInput =
  LngLat | LngLatHeight | [number, number] | [number, number, number]

/** 图形样式。 */
export interface GraphicStyle {
  /** 填充色（CSS 颜色）。 */
  fill?: string
  /** 是否绘制轮廓。 */
  outline?: boolean
  /** 轮廓颜色。 */
  outlineColor?: string
  /** 轮廓宽度（像素）。 */
  outlineWidth?: number
  /** 点像素大小。 */
  pixelSize?: number
  /** 线宽（像素）。 */
  width?: number
  /** 通用颜色。 */
  color?: string
  /** 是否贴地。 */
  clampToGround?: boolean
}

/** 图层事件负载。 */
export interface LayerEvent {
  /** 图层 ID。 */
  id: string
  /** 事件类型。 */
  type: string
}

/** 图形事件负载。 */
export interface GraphicEvent {
  /** 图形 ID。 */
  id: string
  /** 事件类型。 */
  type: string
}

/** 拾取命中类型。 */
export type PickKind =
  "graphic" | "layer" | "tiles-feature" | "terrain" | "native" | "empty"

/** 拾取结果。 */
export interface PickResult {
  /** 命中类型。 */
  kind?: PickKind
  /** 命中的图形 ID。 */
  graphicId?: string
  /** 命中的图层 ID。 */
  layerId?: string
  /** 命中的地理坐标。 */
  lngLat?: LngLatHeight
  /** 查询所用的屏幕坐标。 */
  windowPosition: WindowPosition
  /** 原生拾取对象；advanced / unstable。 */
  native?: unknown
}

/** 相机状态快照。 */
export interface CameraState extends CameraPose {
  /** 采集时间戳（毫秒）。 */
  capturedAt: number
}

/** 运行时事件表。 */
export interface Arc3DEvents {
  /** Runtime facade 就绪。 */
  ready: Record<string, never>
  /** 首屏资源就绪，见 {@link SceneReadyResult}。 */
  sceneReady: SceneReadyResult
  /** 运行时销毁。 */
  destroy: Record<string, never>
  /** 相机变化。 */
  cameraChanged: CameraState
  /** 图层新增。 */
  layerAdded: LayerEvent
  /** 图层移除。 */
  layerRemoved: LayerEvent
  /** 图形新增。 */
  graphicAdded: GraphicEvent
  /** 图形移除。 */
  graphicRemoved: GraphicEvent
  /** 拾取事件。 */
  pick: PickResult
  /** 运行时错误。 */
  error: { message: string; code?: string }
}

/** 引擎 Viewer 创建选项。 */
export interface EngineViewerOptions {
  /** 容器元素或元素 ID。 */
  container: string | Element
  /** Cesium Ion Token。 */
  ionToken?: string
  /** 默认视图范围 `[west, south, east, north]`（度）。 */
  defaultViewRectangle?: [number, number, number, number]
  /** 初始场景模式。 */
  sceneMode?: SceneModeName
  /** 是否对地形进行深度测试。 */
  depthTestAgainstTerrain?: boolean
  /** 渲染分辨率缩放。 */
  resolutionScale?: number | "auto"
  /** 交互控件方案。 */
  controls?: "default" | "mapbox"
  /** 是否显示帧率。 */
  fpsShow?: boolean
  /** Credits 展示模式。 */
  creditMode?: CreditMode
  /** 是否启用默认底图。 */
  defaultBaseLayer?: boolean
  /** 引擎错误回调。 */
  onError?: (error: { message: string; code?: string }) => void
}

/** 引擎 Viewer 抽象，屏蔽具体引擎的原生差异。 */
export interface EngineViewer {
  /** 画布元素。 */
  readonly canvas: HTMLCanvasElement
  /** 容器元素。 */
  readonly container: Element
  /** 原生 Viewer 句柄；advanced / unstable。 */
  readonly native: unknown
  /**
   * 设置 Credits 展示模式。
   *
   * @param mode - 展示模式。
   * @param element - 自定义容器。
   */
  setCreditMode(mode: CreditMode, element?: Element): void
  /**
   * 请求一次渲染。
   *
   * @param reason - 触发渲染的原因，便于调试。
   */
  requestRender(reason?: string): void
  /** 销毁 Viewer。 */
  destroy(): void
  /**
   * 等待首屏资源就绪。
   *
   * @param options - 就绪等待选项。
   */
  whenSceneReady?(options?: SceneReadyOptions): Promise<SceneReadyResult>
}

/** 默认底图状态。 */
export type DefaultBaseLayerState = "disabled" | "loading" | "ready" | "failed"

/** 首屏就绪等待选项。 */
export interface SceneReadyOptions {
  /** 超时时间（毫秒）；超时后以 `timedOut` 返回。 */
  timeoutMs?: number
}

/** 首屏就绪结果。 */
export interface SceneReadyResult {
  /** 未超时且未销毁。 */
  ready: boolean
  /** 仍在加载的 Globe 瓦片数。 */
  remainingTiles: number
  /** 是否因超时返回。 */
  timedOut: boolean
  /** 等待期间是否被销毁。 */
  destroyed: boolean
  /** 默认底图状态。 */
  defaultBaseLayer: DefaultBaseLayerState
}

/** 引擎适配合同。 */
export interface Engine {
  /** 引擎类型标识。 */
  readonly type: string
  /**
   * 创建引擎 Viewer。
   *
   * @param options - Viewer 创建选项。
   */
  createViewer(options: EngineViewerOptions): EngineViewer
  /**
   * 查询引擎能力。
   *
   * @param name - 能力名称。
   */
  hasCapability(name: string): boolean
  /**
   * 将引擎错误映射为统一错误结构。
   *
   * @param error - 原始错误。
   */
  mapError(error: unknown): { message: string; code?: string }
  /** 销毁引擎。 */
  destroy(): void
}

/** 引擎运行时上下文。 */
export interface EngineContext {
  /** 引擎类型标识。 */
  readonly type: string
  /** 引擎 Viewer。 */
  readonly viewer: EngineViewer
  /** 原生引擎句柄。 */
  readonly native: {
    viewer: unknown
  }
  /** 引擎适配器。 */
  readonly engine?: Engine
}

/** Arc3D 运行时配置。 */
export interface Arc3DConfig {
  /** 容器元素或元素 ID。 */
  container: string | Element
  /** 引擎配置。 */
  engine?: {
    /** 引擎类型，当前仅支持 `cesium`。 */
    type?: "cesium"
    /** Cesium 引擎选项。 */
    cesium?: {
      /** Cesium Ion Token。 */
      ionToken?: string
      /** 默认视图范围 `[west, south, east, north]`（度）。 */
      defaultViewRectangle?: [number, number, number, number]
      /** 是否启用默认底图。 */
      defaultBaseLayer?: boolean
    }
  }
  /** 场景配置。 */
  scene?: {
    /** 初始场景模式。 */
    mode?: SceneModeName
    /** 是否对地形进行深度测试。 */
    depthTestAgainstTerrain?: boolean
    /** 渲染分辨率缩放。 */
    resolutionScale?: number | "auto"
    /** 交互控件方案。 */
    controls?: "default" | "mapbox"
    /** 是否显示帧率。 */
    fpsShow?: boolean
    /** Credits 展示模式。 */
    creditMode?: CreditMode
  }
  /** 第三方服务令牌。 */
  tokens?: {
    /** Cesium Ion Token。 */
    cesiumIon?: string
    /** 天地图 Token。 */
    tdt?: string
  }
  /** 日志配置。 */
  logger?: {
    /** 日志级别。 */
    level?: "debug" | "info" | "warn" | "error" | "silent"
  }
}
