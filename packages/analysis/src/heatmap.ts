import { Arc3DError } from "@arc3dlab/core"

/** 热力图数据点。 */
export interface HeatmapPoint {
  /** 经度，单位为度。 */
  longitude: number
  /** 纬度，单位为度。 */
  latitude: number
  /** 权重值，取值越大贡献越强。 */
  value: number
}

/** 渐变色标。 */
export interface GradientStop {
  /** 位置，取值位于 `[0, 1]`。 */
  offset: number
  /** RGBA 颜色，各分量位于 `[0, 255]`。 */
  color: [number, number, number, number]
}

/** 热力图网格结果。 */
export interface HeatmapGrid {
  /** 网格列数。 */
  width: number
  /** 网格行数。 */
  height: number
  /** 网格覆盖范围 `[west, south, east, north]`。 */
  extent: [number, number, number, number]
  /** 归一化后的网格值，取值位于 `[0, 1]`。 */
  values: Float32Array
  /** 归一化前的最大累计值。 */
  maxValue: number
}

/** 热力图网格计算选项。 */
export interface HeatmapGridOptions {
  /** 影响半径，单位为米。 */
  radius?: number
  /** 网格单元尺寸，单位为米。 */
  cellSize?: number
  /** 单边最大网格数量，默认 256。 */
  maxGridSize?: number
}

/** 默认的经典热力图渐变。 */
export const DEFAULT_HEATMAP_GRADIENT: GradientStop[] = [
  { offset: 0, color: [0, 0, 255, 0] },
  { offset: 0.3, color: [0, 255, 255, 180] },
  { offset: 0.5, color: [0, 255, 0, 220] },
  { offset: 0.7, color: [255, 255, 0, 235] },
  { offset: 1, color: [255, 0, 0, 255] },
]

const METERS_PER_DEGREE_LAT = 110540
const METERS_PER_DEGREE_LON_EQUATOR = 111320

/**
 * 在渐变上按位置采样颜色。
 * @param gradient - 渐变色标列表，需按 `offset` 升序排列。
 * @param t - 采样位置，取值位于 `[0, 1]`。
 * @returns RGBA 颜色分量。
 */
export function sampleGradient(
  gradient: GradientStop[],
  t: number,
): [number, number, number, number] {
  const clamped = Math.min(1, Math.max(0, t))
  if (gradient.length === 0) return [0, 0, 0, 0]
  if (clamped <= gradient[0].offset) return [...gradient[0].color]
  const last = gradient[gradient.length - 1]
  if (clamped >= last.offset) return [...last.color]
  for (let i = 1; i < gradient.length; i += 1) {
    const prev = gradient[i - 1]
    const next = gradient[i]
    if (clamped <= next.offset) {
      const span = next.offset - prev.offset || 1
      const f = (clamped - prev.offset) / span
      return [
        Math.round(prev.color[0] + (next.color[0] - prev.color[0]) * f),
        Math.round(prev.color[1] + (next.color[1] - prev.color[1]) * f),
        Math.round(prev.color[2] + (next.color[2] - prev.color[2]) * f),
        Math.round(prev.color[3] + (next.color[3] - prev.color[3]) * f),
      ]
    }
  }
  return [...last.color]
}

/**
 * 依据点集计算热力图网格。
 * @param points - 热力图数据点，不能为空。
 * @param options - 网格计算选项。
 * @returns 热力图网格结果。
 * @throws {Arc3DError} 当点集为空或半径非正时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function computeHeatmapGrid(
  points: HeatmapPoint[],
  options: HeatmapGridOptions = {},
): HeatmapGrid {
  if (points.length === 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "computeHeatmapGrid requires at least one point",
    )
  }
  const radius = options.radius ?? 500
  if (!(radius > 0)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `heatmap radius must be positive: ${radius}`,
    )
  }
  const maxGridSize = options.maxGridSize ?? 256
  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const point of points) {
    west = Math.min(west, point.longitude)
    east = Math.max(east, point.longitude)
    south = Math.min(south, point.latitude)
    north = Math.max(north, point.latitude)
  }
  const midLat = (south + north) / 2
  const padLat = radius / METERS_PER_DEGREE_LAT
  const padLon =
    radius /
    (METERS_PER_DEGREE_LON_EQUATOR * Math.cos((midLat * Math.PI) / 180) || 1)
  west -= padLon
  east += padLon
  south -= padLat
  north += padLat

  const spanLonMeters =
    (east - west) *
    METERS_PER_DEGREE_LON_EQUATOR *
    Math.cos((midLat * Math.PI) / 180)
  const spanLatMeters = (north - south) * METERS_PER_DEGREE_LAT
  const requested = options.cellSize ?? radius / 4
  const cellSize = Math.max(
    requested > 0 ? requested : 1,
    spanLonMeters / maxGridSize,
    spanLatMeters / maxGridSize,
    1,
  )
  const width = Math.max(1, Math.ceil(spanLonMeters / cellSize))
  const height = Math.max(1, Math.ceil(spanLatMeters / cellSize))
  const values = new Float32Array(width * height)
  const centerLon = (west + east) / 2
  const metersPerLon =
    METERS_PER_DEGREE_LON_EQUATOR * Math.cos((midLat * Math.PI) / 180) || 1

  const localPoints = points.map((point) => ({
    east: (point.longitude - centerLon) * metersPerLon,
    north: (point.latitude - midLat) * METERS_PER_DEGREE_LAT,
    value: point.value,
  }))

  let maxValue = 0
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const lon = west + ((col + 0.5) / width) * (east - west)
      const lat = south + ((row + 0.5) / height) * (north - south)
      const cellEast = (lon - centerLon) * metersPerLon
      const cellNorth = (lat - midLat) * METERS_PER_DEGREE_LAT
      let sum = 0
      for (const point of localPoints) {
        const distance = Math.hypot(
          cellEast - point.east,
          cellNorth - point.north,
        )
        if (distance >= radius) continue
        const ratio = distance / radius
        const kernel = (1 - ratio * ratio) * (1 - ratio * ratio)
        sum += point.value * kernel
      }
      values[row * width + col] = sum
      if (sum > maxValue) maxValue = sum
    }
  }
  if (maxValue > 0) {
    for (let i = 0; i < values.length; i += 1) values[i] /= maxValue
  }
  return {
    width,
    height,
    extent: [west, south, east, north],
    values,
    maxValue,
  }
}

/**
 * 将网格值转换为 RGBA 像素数据。
 * @param grid - 热力图网格。
 * @param gradient - 渐变色标，默认使用经典配色。
 * @returns 长度为 `width * height * 4` 的 RGBA 像素数组。
 */
export function gridToRgba(
  grid: HeatmapGrid,
  gradient: GradientStop[] = DEFAULT_HEATMAP_GRADIENT,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(grid.width * grid.height * 4)
  for (let i = 0; i < grid.values.length; i += 1) {
    const [r, g, b, a] = sampleGradient(gradient, grid.values[i])
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = a
  }
  return data
}
