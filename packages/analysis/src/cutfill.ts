import { pointInPolygon, type LngLatLike } from "./geometry"
import { fromLocalMeters, toLocalMeters } from "./geometry"

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

/**
 * 根据多边形边界构建土方计算网格。
 * @param ring - 多边形边界点列表。
 * @param samples - 每一边划分的采样数量。
 * @returns 构建得到的土方计算网格。
 */
export function buildCutFillGrid(
  ring: LngLatLike[],
  samples: number,
): CutFillGrid {
  if (ring.length < 3 || samples < 1) {
    return {
      cells: [],
      resolutionMeters: 0,
      cellWidthMeters: 0,
      cellHeightMeters: 0,
    }
  }
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
  const resolutionMeters =
    Math.hypot(cellWidthMeters, cellHeightMeters) / Math.SQRT2
  const cells: CutFillCell[] = []
  for (let i = 0; i < samples; i += 1) {
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
      cells.push({
        longitude: center.longitude,
        latitude: center.latitude,
        coverage,
        areaSquareMeters: cellWidthMeters * cellHeightMeters * coverage,
      })
    }
  }
  return { cells, resolutionMeters, cellWidthMeters, cellHeightMeters }
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
