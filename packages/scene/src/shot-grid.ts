import { Arc3DError, type Arc3DContext, type Extent } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { Rectangle, type Viewer } from "cesium"

/**
 * 网格出图选项。
 */
export interface ShotGridOptions {
  /** 纵向分幅行数。 */
  rows: number
  /** 横向分幅列数。 */
  columns: number
  /** 出图范围，默认为当前相机可见范围之外时必须显式提供。 */
  extent: Extent
  /** 图片格式，默认 `image/png`。 */
  format?: string
  /** 每幅截图之间的等待时间，单位为毫秒，默认为 0。 */
  delayMs?: number
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
 * @param context - Arc3D 运行时上下文。
 * @param options - 出图选项。
 * @returns 每幅图片及其对应范围。
 */
export async function captureGrid(
  context: Arc3DContext,
  options: ShotGridOptions,
): Promise<ShotGridShot[]> {
  const viewer = getCesiumViewer(context.engine.native.viewer) as
    Viewer | undefined
  const canvas = (viewer?.scene?.canvas ?? undefined) as
    (HTMLCanvasElement & { toDataURL?: (type?: string) => string }) | undefined
  if (!viewer || !canvas || typeof canvas.toDataURL !== "function") {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "Viewer does not expose a capturable canvas",
    )
  }
  const rows = Math.max(1, Math.floor(options.rows))
  const columns = Math.max(1, Math.floor(options.columns))
  const format = options.format ?? "image/png"
  const delayMs = options.delayMs ?? 0
  const cells = subdivideExtent(options.extent, rows, columns)
  const shots: ShotGridShot[] = []
  for (let index = 0; index < cells.length; index++) {
    const extent = cells[index]!
    const [west, south, east, north] = extent
    viewer.camera.setView({
      destination: Rectangle.fromDegrees(west, south, east, north),
    })
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    shots.push({
      row: Math.floor(index / columns),
      column: index % columns,
      extent,
      image: canvas.toDataURL(format),
    })
  }
  return shots
}
