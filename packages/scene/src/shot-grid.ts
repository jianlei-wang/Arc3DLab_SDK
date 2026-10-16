import { Arc3DError, type Arc3DContext, type Extent } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { Cartesian3, Rectangle } from "cesium"

/**
 * 网格出图选项。
 */
export interface ShotGridOptions {
  /** 纵向分幅行数，须为大于等于 1 的整数。 */
  rows: number
  /** 横向分幅列数，须为大于等于 1 的整数。 */
  columns: number
  /** 出图范围 `[west, south, east, north]`。 */
  extent: Extent
  /** 图片格式，默认 `image/png`。 */
  format?: string
  /** 每幅截图在渲染完成后的追加等待时间，单位为毫秒，默认为 0。 */
  delayMs?: number
  /** 单次出图允许创建的最大图像数量，默认为 64。 */
  maxShots?: number
  /** 等待单幅渲染完成的兜底超时时间，单位为毫秒，默认为 1000。 */
  renderTimeoutMs?: number
}

/**
 * 单幅出图结果。
 */
export interface ShotGridShot {
  /** 行索引（从 0 开始）。 */
  row: number
  /** 列索引（从 0 开始）。 */
  column: number
  /** 该幅对应的经纬度范围。 */
  extent: Extent
  /** 图像数据地址。 */
  image: string
}

/** 出图所依赖的相机最小接口。 */
interface ShotCamera {
  positionWC?: Cartesian3
  heading?: number
  pitch?: number
  roll?: number
  setView?(options: {
    destination: unknown
    orientation?: { heading: number; pitch: number; roll: number }
  }): void
}

/** 出图所依赖的场景最小接口。 */
interface ShotScene {
  canvas?: { toDataURL?: (type?: string) => string }
  postRender?: {
    addEventListener(listener: () => void): void
    removeEventListener?(listener: () => void): void
  }
  requestRender?: () => void
}

/** 出图所依赖的 viewer 最小接口。 */
interface ShotViewer {
  camera?: ShotCamera
  scene?: ShotScene
  render?: () => void
}

/** 相机状态快照。 */
interface CameraSnapshot {
  position: Cartesian3
  heading: number
  pitch: number
  roll: number
}

const DEFAULT_MAX_SHOTS = 64
const DEFAULT_RENDER_TIMEOUT_MS = 1000

/**
 * 将一个范围按行列均分拆分为多个子范围。
 * @param extent - 原始范围 `[west, south, east, north]`。
 * @param rows - 行数。
 * @param columns - 列数。
 * @returns 按行优先顺序排列的子范围数组。
 */
export function subdivideExtent(
  extent: Extent,
  rows: number,
  columns: number,
): Extent[] {
  const [west, south, east, north] = extent
  const rowCount = Math.max(1, Math.floor(rows))
  const columnCount = Math.max(1, Math.floor(columns))
  const cellWidth = (east - west) / columnCount
  const cellHeight = (north - south) / rowCount
  const result: Extent[] = []
  for (let row = 0; row < rowCount; row++) {
    for (let column = 0; column < columnCount; column++) {
      const cellWest = west + column * cellWidth
      const cellEast = cellWest + cellWidth
      const cellNorth = north - row * cellHeight
      const cellSouth = cellNorth - cellHeight
      result.push([cellWest, cellSouth, cellEast, cellNorth])
    }
  }
  return result
}

/**
 * 按网格分幅导出场景图片。
 *
 * 每幅在设置相机后请求并等待一帧渲染再采集；出图前保存相机状态，结束时
 * 在 `finally` 中恢复，正常与异常路径都不会改变用户视图。
 *
 * @param context - Arc3D 运行时上下文。
 * @param options - 出图选项。
 * @returns 每幅图片及其对应范围。
 * @throws {Arc3DError} 当行列数非法、超过分幅上限或 viewer 无可采集画布时抛出。
 */
export async function captureGrid(
  context: Arc3DContext,
  options: ShotGridOptions,
): Promise<ShotGridShot[]> {
  const viewer = getCesiumViewer(context.engine.native.viewer) as unknown as
    ShotViewer | undefined
  const canvas = viewer?.scene?.canvas
  if (!viewer || !canvas || typeof canvas.toDataURL !== "function") {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Viewer does not expose a capturable canvas",
    )
  }
  const maxShots = resolveMaxShots(options.maxShots)
  const renderTimeoutMs = resolveRenderTimeout(options.renderTimeoutMs)
  assertGridShape(options.rows, options.columns, maxShots)
  const format = options.format ?? "image/png"
  const delayMs = options.delayMs ?? 0
  const cells = subdivideExtent(options.extent, options.rows, options.columns)
  const camera = viewer.camera
  const snapshot = captureCameraState(camera)
  const release = (() => {
    const acquire = context.engine?.viewer?.acquireContinuousRender
    return typeof acquire === "function"
      ? acquire.call(context.engine.viewer, "shot-grid")
      : () => {}
  })()
  const shots: ShotGridShot[] = []
  try {
    for (let index = 0; index < cells.length; index++) {
      const extent = cells[index]!
      const [west, south, east, north] = extent
      camera?.setView?.({
        destination: Rectangle.fromDegrees(west, south, east, north),
      })
      await awaitFrame(viewer, renderTimeoutMs)
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
      shots.push({
        row: Math.floor(index / options.columns),
        column: index % options.columns,
        extent,
        image: canvas.toDataURL(format),
      })
    }
    return shots
  } finally {
    restoreCameraState(camera, snapshot)
    viewer.scene?.requestRender?.()
    release()
  }
}

/**
 * 校验分幅行列数与总数上限。
 * @param rows - 行数。
 * @param columns - 列数。
 * @param maxShots - 分幅上限。
 * @throws {Arc3DError} 当行列数非法或总数超过上限时抛出。
 */
function assertGridShape(
  rows: number,
  columns: number,
  maxShots: number,
): void {
  if (!Number.isInteger(rows) || rows < 1) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `rows must be a positive integer, received ${String(rows)}`,
    )
  }
  if (!Number.isInteger(columns) || columns < 1) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `columns must be a positive integer, received ${String(columns)}`,
    )
  }
  if (rows * columns > maxShots) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `rows × columns (${rows * columns}) exceeds maxShots (${maxShots})`,
    )
  }
}

function resolveMaxShots(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_SHOTS
  if (!Number.isInteger(value) || value < 1) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `maxShots must be a positive integer, received ${String(value)}`,
    )
  }
  return value
}

function resolveRenderTimeout(value: number | undefined): number {
  if (value === undefined) return DEFAULT_RENDER_TIMEOUT_MS
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `renderTimeoutMs must be a non-negative number, received ${String(value)}`,
    )
  }
  return value
}

/**
 * 捕获相机状态，缺少可读位置或写回能力时返回 undefined。
 * @param camera - 目标相机。
 * @returns 相机状态快照，或 undefined。
 */
function captureCameraState(
  camera: ShotCamera | undefined,
): CameraSnapshot | undefined {
  if (!camera || !camera.positionWC || typeof camera.setView !== "function") {
    return undefined
  }
  return {
    position: Cartesian3.clone(camera.positionWC),
    heading: camera.heading ?? 0,
    pitch: camera.pitch ?? 0,
    roll: camera.roll ?? 0,
  }
}

/**
 * 使用快照恢复相机状态。
 * @param camera - 目标相机。
 * @param snapshot - 相机状态快照，未提供时跳过。
 */
function restoreCameraState(
  camera: ShotCamera | undefined,
  snapshot: CameraSnapshot | undefined,
): void {
  if (!camera || !snapshot || typeof camera.setView !== "function") return
  camera.setView({
    destination: Cartesian3.clone(snapshot.position),
    orientation: {
      heading: snapshot.heading,
      pitch: snapshot.pitch,
      roll: snapshot.roll,
    },
  })
}

/**
 * 请求一帧渲染，并在可监听时等待渲染完成信号。
 * @param viewer - 目标 viewer。
 * @param timeoutMs - 等待信号的兜底超时时间。
 */
async function awaitFrame(
  viewer: ShotViewer,
  timeoutMs: number,
): Promise<void> {
  if (typeof viewer.render === "function") viewer.render()
  const scene = viewer.scene
  const postRender = scene?.postRender
  if (!postRender || typeof postRender.addEventListener !== "function") return
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      postRender.removeEventListener?.(listener)
      resolve()
    }
    const listener = (): void => finish()
    const timer = setTimeout(finish, timeoutMs)
    postRender.addEventListener(listener)
    if (typeof scene?.requestRender === "function") scene.requestRender()
    else if (typeof viewer.render === "function") viewer.render()
  })
}
