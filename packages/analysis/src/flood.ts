import { Arc3DError, type Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { Color, HeightReference, Rectangle } from "cesium"

/** 洪水淹没网格计算选项。 */
export interface FloodGridOptions {
  /** 网格覆盖范围 `[west, south, east, north]`。 */
  extent: [number, number, number, number]
  /** 网格列数。 */
  width: number
  /** 网格行数。 */
  height: number
  /** 按行优先存储的地形高程，长度应为 `width * height`。 */
  heights: ArrayLike<number>
  /** 水位高程，单位为米。 */
  waterLevel: number
}

/** 洪水淹没网格计算结果。 */
export interface FloodGridResult {
  /** 网格列数。 */
  width: number
  /** 网格行数。 */
  height: number
  /** 淹没掩膜，`1` 表示被淹没，`0` 表示未淹没。 */
  flooded: Uint8Array
  /** 淹没单元占比，取值位于 `[0, 1]`。 */
  floodedRatio: number
  /** 最大淹没深度，单位为米。 */
  maxDepth: number
}

/**
 * 依据高程网格与水位计算各单元的淹没情况。
 * @param options - 洪水淹没网格计算选项。
 * @returns 淹没网格结果。
 * @throws {Arc3DError} 当维度非法或高程长度不匹配时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function computeFloodGrid(options: FloodGridOptions): FloodGridResult {
  const { width, height, heights, waterLevel } = options
  if (!(width > 0) || !(height > 0)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `flood grid dimensions must be positive: ${width}x${height}`,
    )
  }
  if (heights.length !== width * height) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `flood heights length mismatch: expected ${width * height}, got ${heights.length}`,
    )
  }
  const flooded = new Uint8Array(width * height)
  let floodedCells = 0
  let maxDepth = 0
  for (let i = 0; i < heights.length; i += 1) {
    const depth = waterLevel - heights[i]
    if (depth > 0) {
      flooded[i] = 1
      floodedCells += 1
      if (depth > maxDepth) maxDepth = depth
    }
  }
  return {
    width,
    height,
    flooded,
    floodedRatio: floodedCells / (width * height),
    maxDepth,
  }
}

/**
 * 洪水淹没分析，负责计算淹没范围并渲染半透明水面。
 */
export class FloodAnalysis {
  private entityId: string | undefined

  /**
   * 创建洪水淹没分析。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 计算指定网格的淹没情况。
   * @param options - 洪水淹没网格计算选项。
   * @returns 淹没网格结果。
   */
  analyze(options: FloodGridOptions): FloodGridResult {
    this.context.lifecycle.assertUsable("analyze flood")
    return computeFloodGrid(options)
  }

  /**
   * 在给定范围内渲染指定水位的半透明水面。
   * @param waterLevel - 水位高程，单位为米。
   * @param extent - 水面覆盖范围 `[west, south, east, north]`，若省略则沿用上次设置。
   */
  setWaterLevel(
    waterLevel: number,
    extent?: [number, number, number, number],
  ): void {
    this.context.lifecycle.assertUsable("set water level")
    if (extent) this.extent = extent
    if (!this.extent) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        "setWaterLevel requires an extent on first call",
      )
    }
    this.clear()
    const [west, south, east, north] = this.extent
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const entity = viewer.entities.add({
      rectangle: {
        coordinates: Rectangle.fromDegrees(west, south, east, north),
        height: waterLevel,
        heightReference: HeightReference.NONE,
        material: Color.fromCssColorString("#1890FF").withAlpha(0.35),
      },
    })
    this.entityId = entity.id
  }

  /** 清除已渲染的水面。 */
  clear(): void {
    if (this.entityId === undefined) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    viewer.entities.removeById(this.entityId)
    this.entityId = undefined
  }

  /** 销毁洪水淹没分析并释放图元。 */
  destroy(): void {
    this.clear()
  }

  private extent: [number, number, number, number] | undefined
}
