import type { LngLatLike, RectQuery } from "./geometry"
import { geodesicDistanceMeters, pointInPolygon, pointInRect } from "./geometry"

/** 坡度采样结果，包含坡度与坡向。 */
export interface SlopeSample {
  /** 坡度，单位为度。 */
  slopeDegrees: number
  /** 坡向，单位为度。 */
  aspectDegrees: number
}

/** 通视采样的高程序对，用于判断视线是否被地形遮挡。 */
export interface SightSample {
  /** 视线在该位置的高度。 */
  lineHeight: number
  /** 地形在该位置的高度。 */
  terrainHeight: number
}

const EARTH_RADIUS = 6378137

export type { LngLatLike, RectQuery } from "./geometry"
export { pointInRect, pointInPolygon } from "./geometry"

/**
 * 在两端之间进行线性插值。
 * @param a - 起始值。
 * @param b - 结束值。
 * @param t - 插值比例，取值 0 到 1。
 * @returns 插值结果。
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * 根据中心、东侧与北侧的高程采样计算坡度与坡向。
 * @param hCenter - 中心点高程。
 * @param hEast - 东侧点高程。
 * @param hNorth - 北侧点高程。
 * @param sampleMeters - 采样间距，单位为米。
 * @returns 坡度与坡向。
 */
export function slopeFromHeights(
  hCenter: number,
  hEast: number,
  hNorth: number,
  sampleMeters: number,
): SlopeSample {
  const dx = sampleMeters > 0 ? sampleMeters : 1
  const dzdx = (hEast - hCenter) / dx
  const dzdy = (hNorth - hCenter) / dx
  const slopeDegrees = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
  let aspectDegrees = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI
  if (aspectDegrees < 0) aspectDegrees += 360
  return { slopeDegrees, aspectDegrees }
}

/**
 * 根据一组通视采样判断视线是否被遮挡。
 * @param samples - 通视采样列表。
 * @returns 包含可见标志及首个遮挡点索引的结果。
 */
export function lineOfSightFromSamples(samples: SightSample[]): {
  visible: boolean
  occludedIndex?: number
} {
  for (let i = 1; i < samples.length - 1; i += 1) {
    if (samples[i].terrainHeight > samples[i].lineHeight) {
      return { visible: false, occludedIndex: i }
    }
  }
  return { visible: true }
}

/**
 * 根据起点、方位角与距离推算目标经纬度。
 * @param longitude - 起点经度。
 * @param latitude - 起点纬度。
 * @param headingDegrees - 方位角，单位为度。
 * @param distanceMeters - 距离，单位为米。
 * @returns 目标点的经纬度坐标。
 */
export function destinationLngLat(
  longitude: number,
  latitude: number,
  headingDegrees: number,
  distanceMeters: number,
): { longitude: number; latitude: number } {
  const lat1 = (latitude * Math.PI) / 180
  const lon1 = (longitude * Math.PI) / 180
  const brng = (headingDegrees * Math.PI) / 180
  const angular = distanceMeters / EARTH_RADIUS
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brng),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  return {
    longitude: (lon2 * 180) / Math.PI,
    latitude: (lat2 * 180) / Math.PI,
  }
}

/**
 * 计算两点之间的测地线距离。
 * @param from - 起点坐标。
 * @param to - 终点坐标。
 * @returns 距离，单位为米。
 */
export function haversineMeters(from: LngLatLike, to: LngLatLike): number {
  return geodesicDistanceMeters(from, to)
}

/**
 * 判断折线顶点中是否存在位于矩形内的点。
 * @param positions - 折线顶点列表。
 * @param rect - 矩形范围。
 * @returns 存在位于矩形内的顶点时返回 true。
 */
export function anyVertexInRect(
  positions: LngLatLike[],
  rect: RectQuery,
): boolean {
  return positions.some((point) => pointInRect(point, rect))
}

/**
 * 判断折线顶点中是否存在位于多边形内的点。
 * @param positions - 折线顶点列表。
 * @param ring - 多边形边界点列表。
 * @returns 存在位于多边形内的顶点时返回 true。
 */
export function anyVertexInPolygon(
  positions: LngLatLike[],
  ring: LngLatLike[],
): boolean {
  return positions.some((point) => pointInPolygon(point, ring))
}

/**
 * 判断折线顶点中是否存在位于指定中心点给定距离内的点。
 * @param positions - 折线顶点列表。
 * @param center - 距离中心点。
 * @param meters - 距离阈值，单位为米。
 * @returns 存在位于范围内的顶点时返回 true。
 */
export function anyVertexWithinMeters(
  positions: LngLatLike[],
  center: LngLatLike,
  meters: number,
): boolean {
  return positions.some((point) => haversineMeters(center, point) <= meters)
}

/**
 * 根据遮挡采样索引计算射线的可见范围。
 * @param radius - 射线最大半径，单位为米。
 * @param sampleCount - 采样点总数。
 * @param occludedIndex - 首个遮挡点索引，未遮挡时省略。
 * @returns 可见范围，单位为米。
 */
export function rayRangeMeters(
  radius: number,
  sampleCount: number,
  occludedIndex?: number,
): number {
  if (occludedIndex === undefined) return radius
  if (sampleCount <= 1) return 0
  return (occludedIndex / (sampleCount - 1)) * radius
}

/**
 * 按单元面积累计挖方量与填方量。
 * @param deltas - 高差列表，正值表示挖方，负值表示填方。
 * @param cellArea - 单个单元的面积，单位为平方米。
 * @returns 累计得到的挖方量与填方量。
 */
export function accumulateCutFill(
  deltas: number[],
  cellArea: number,
): { cut: number; fill: number } {
  let cut = 0
  let fill = 0
  for (const delta of deltas) {
    if (delta > 0) cut += delta * cellArea
    else fill += -delta * cellArea
  }
  return { cut, fill }
}

/**
 * 根据各射线方向生成可视域外包络点。
 * @param longitude - 观察点经度。
 * @param latitude - 观察点纬度。
 * @param rays - 射线列表，包含方位角与可见范围。
 * @returns 可视域外包络的经纬度点列表。
 */
export function viewshedEnvelope(
  longitude: number,
  latitude: number,
  rays: Array<{ heading: number; rangeMeters: number }>,
): LngLatLike[] {
  return rays.map((ray) =>
    destinationLngLat(
      longitude,
      latitude,
      ray.heading,
      Math.max(ray.rangeMeters, 1),
    ),
  )
}
