import { Arc3DError } from "@arc3dlab/core"
import { pointInPolygon, type LngLatLike } from "./geometry"
import { fromLocalMeters, toLocalMeters } from "./geometry"
import { resolveSampleCount } from "./scheduler"

/** 土方计算网格中的单个单元，记录中心位置、覆盖率与面积。 */
export interface CutFillCell {
  /** 单元中心的经度。 */
  longitude: number
  /** 单元中心的纬度。 */
  latitude: number
  /** 单元被多边形覆盖的比例，取值 0 到 1。 */
  coverage: number
  /** 单元的有效面积，单位为平方米。 */
  areaSquareMeters: number
}

/** 土方计算网格，包含所有单元及其分辨率信息。 */
export interface CutFillGrid {
  /** 网格单元列表。 */
  cells: CutFillCell[]
  /** 网格的综合分辨率，单位为米。 */
  resolutionMeters: number
  /** 单个单元的宽度，单位为米。 */
  cellWidthMeters: number
  /** 单个单元的高度，单位为米。 */
  cellHeightMeters: number
}

function pointInXy(
  point: { east: number; north: number },
  ring: Array<{ east: number; north: number }>,
): boolean {
  if (ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].east
    const yi = ring[i].north
    const xj = ring[j].east
    const yj = ring[j].north
    const intersect =
      yi > point.north !== yj > point.north &&
      point.east <
        ((xj - xi) * (point.north - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function cellCoverage(
  west: number,
  south: number,
  east: number,
  north: number,
  ring: Array<{ east: number; north: number }>,
): number {
  const probes = [
    { east: west, north: south },
    { east: east, north: south },
    { east: east, north: north },
    { east: west, north: north },
    { east: (west + east) / 2, north: (south + north) / 2 },
  ]
  const hits = probes.filter((probe) => pointInXy(probe, ring)).length
  return hits / probes.length
}

/** 网格构建时复用的投影边界与单元尺寸。 */
interface CutFillGridContext {
  /** 局部平面投影原点。 */
  origin: LngLatLike
  /** 投影到局部平面的多边形顶点。 */
  projected: Array<{ east: number; north: number }>
  /** 每一边划分的采样数量。 */
  samples: number
  /** 网格西边界。 */
  west: number
  /** 网格南边界。 */
  south: number
  /** 单元宽度。 */
  cellWidthMeters: number
  /** 单元高度。 */
  cellHeightMeters: number
  /** 综合分辨率。 */
  resolutionMeters: number
}

/** 进程内分块构建土方网格的选项。 */
export interface CutFillGridChunkOptions {
  /** 取消信号，在每个分块边界检查。 */
  signal?: AbortSignal
  /** 每个分块包含的网格行数，缺省为 16。 */
  chunkRows?: number
  /** 分块之间的让出回调，缺省不让出。 */
  yieldToEventLoop?: () => Promise<void>
}

/** 默认每个分块包含的网格行数。 */
const DEFAULT_GRID_CHUNK_ROWS = 16

function emptyGrid(): CutFillGrid {
  return {
    cells: [],
    resolutionMeters: 0,
    cellWidthMeters: 0,
    cellHeightMeters: 0,
  }
}

/**
 * 计算网格边界与单元尺寸。
 * @param ring - 多边形边界点列表。
 * @param samples - 每一边划分的采样数量。
 * @returns 网格构建上下文；输入退化时返回 undefined。
 */
function createGridContext(
  ring: LngLatLike[],
  samples: number,
): CutFillGridContext | undefined {
  if (ring.length < 3 || samples < 1) return undefined
  const origin = ring[0]
  const projected = ring.map((point) => toLocalMeters(origin, point))
  const west = Math.min(...projected.map((point) => point.east))
  const east = Math.max(...projected.map((point) => point.east))
  const south = Math.min(...projected.map((point) => point.north))
  const north = Math.max(...projected.map((point) => point.north))
  const width = Math.max(east - west, 0)
  const height = Math.max(north - south, 0)
  const cellWidthMeters = width / samples
  const cellHeightMeters = height / samples
  return {
    origin,
    projected,
    samples,
    west,
    south,
    cellWidthMeters,
    cellHeightMeters,
    resolutionMeters:
      Math.hypot(cellWidthMeters, cellHeightMeters) / Math.SQRT2,
  }
}

/**
 * 逐行生成网格单元，供同步与分块构建共享。
 * @param context - 网格构建上下文。
 * @param ring - 多边形边界点列表。
 * @returns 每次产出一行网格单元。
 */
function* gridRows(
  context: CutFillGridContext,
  ring: LngLatLike[],
): Generator<CutFillCell[]> {
  const {
    origin,
    projected,
    samples,
    west,
    south,
    cellWidthMeters,
    cellHeightMeters,
  } = context
  for (let i = 0; i < samples; i += 1) {
    const row: CutFillCell[] = []
    for (let j = 0; j < samples; j += 1) {
      const cellWest = west + i * cellWidthMeters
      const cellSouth = south + j * cellHeightMeters
      const cellEast = cellWest + cellWidthMeters
      const cellNorth = cellSouth + cellHeightMeters
      const coverage = cellCoverage(
        cellWest,
        cellSouth,
        cellEast,
        cellNorth,
        projected,
      )
      if (coverage <= 0) continue
      const center = fromLocalMeters(
        origin,
        (cellWest + cellEast) / 2,
        (cellSouth + cellNorth) / 2,
      )
      if (coverage < 1 && !pointInPolygon(center, ring) && coverage < 0.2)
        continue
      row.push({
        longitude: center.longitude,
        latitude: center.latitude,
        coverage,
        areaSquareMeters: cellWidthMeters * cellHeightMeters * coverage,
      })
    }
    yield row
  }
}

/**
 * 根据上下文与单元列表组装网格结果。
 * @param context - 网格构建上下文。
 * @param cells - 网格单元列表。
 * @returns 构建得到的土方计算网格。
 */
function gridResult(
  context: CutFillGridContext,
  cells: CutFillCell[],
): CutFillGrid {
  return {
    cells,
    resolutionMeters: context.resolutionMeters,
    cellWidthMeters: context.cellWidthMeters,
    cellHeightMeters: context.cellHeightMeters,
  }
}

/**
 * 根据多边形边界构建土方计算网格。
 *
 * 采用局部东-北平面近似（`"local-planar"`）构建均匀网格，以环首点为原点固定
 * 经度缩放，仅适用于多边形附近、非极区的小范围；边界单元按覆盖率加权。
 * @param ring - 多边形边界点列表。
 * @param samples - 每一边划分的采样数量。
 * @returns 构建得到的土方计算网格。
 * @throws {Arc3DError} 采样数量不是大于等于 1 的有限数值时抛出。
 */
export function buildCutFillGrid(
  ring: LngLatLike[],
  samples: number,
): CutFillGrid {
  const resolvedSamples = resolveSampleCount(samples, undefined, "samples")
  const context = createGridContext(ring, resolvedSamples)
  if (!context) return emptyGrid()
  const cells: CutFillCell[] = []
  for (const row of gridRows(context, ring)) {
    cells.push(...row)
  }
  return gridResult(context, cells)
}

/**
 * 分块构建土方计算网格，并在块间检查取消并让出事件循环。
 *
 * 与同步版本结果一致，但允许主线程降级路径在长时间计算期间响应取消。
 * 取消会在每个分块边界被观察到，并以 `Arc3DError("CANCELLED")` 结束。
 *
 * @param ring - 多边形边界点列表。
 * @param samples - 每一边划分的采样数量。
 * @param options - 取消信号、分块行数与让出回调。
 * @returns 构建得到的土方计算网格。
 * @throws {Arc3DError} 采样数量非法或任务被取消时抛出。
 */
export async function buildCutFillGridAsync(
  ring: LngLatLike[],
  samples: number,
  options: CutFillGridChunkOptions = {},
): Promise<CutFillGrid> {
  const resolvedSamples = resolveSampleCount(samples, undefined, "samples")
  const context = createGridContext(ring, resolvedSamples)
  if (!context) return emptyGrid()
  const requestedChunkRows = options.chunkRows ?? DEFAULT_GRID_CHUNK_ROWS
  const chunkRows = Number.isFinite(requestedChunkRows)
    ? Math.max(1, Math.floor(requestedChunkRows))
    : DEFAULT_GRID_CHUNK_ROWS
  const cells: CutFillCell[] = []
  let rowsInChunk = 0
  for (const row of gridRows(context, ring)) {
    if (options.signal?.aborted) {
      throw new Arc3DError("CANCELLED", "Cancelled analysis job")
    }
    cells.push(...row)
    rowsInChunk += 1
    if (rowsInChunk >= chunkRows) {
      rowsInChunk = 0
      await options.yieldToEventLoop?.()
      if (options.signal?.aborted) {
        throw new Arc3DError("CANCELLED", "Cancelled analysis job")
      }
    }
  }
  return gridResult(context, cells)
}

/**
 * 按面积加权累计各个采样的挖方与填方体积。
 * @param samples - 采样列表，每项包含高差与对应面积。
 * @returns 累计得到的挖方量与填方量。
 */
export function accumulateCutFillWeighted(
  samples: Array<{ delta: number; area: number }>,
): { cut: number; fill: number } {
  let cut = 0
  let fill = 0
  for (const sample of samples) {
    if (sample.delta > 0) cut += sample.delta * sample.area
    else fill += -sample.delta * sample.area
  }
  return { cut, fill }
}

/**
 * 估算部分覆盖单元带来的土方计算误差。
 *
 * 结果为边界单元经验量级指标（各单元按 `0.5 × 面积 × |高差|` 累计），
 * 用于提示误差来源与相对大小，并非数学误差上界。
 * @param cells - 土方计算网格单元列表。
 * @param deltas - 与单元一一对应的高差列表。
 * @returns 估算得到的误差体积。
 */
export function estimateCutFillError(
  cells: CutFillCell[],
  deltas: number[],
): number {
  let error = 0
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]
    if (cell.coverage >= 1) continue
    error += 0.5 * cell.areaSquareMeters * Math.abs(deltas[i] ?? 0)
  }
  return error
}
