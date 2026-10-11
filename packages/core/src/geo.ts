import { Arc3DError } from "./errors"
import type { LngLat } from "./types"
import { assertFiniteNumber } from "./validate"

/**
 * 地理范围，按 `[west, south, east, north]` 排列，单位为度。
 */
export type Extent = [west: number, south: number, east: number, north: number]

/** WGS84 椭球长半轴，单位为米。 */
export const WGS84_SEMI_MAJOR_AXIS = 6378137

/**
 * 将角度由度转换为弧度。
 * @param degrees - 以度为单位的角值。
 * @returns 以弧度表示的角值。
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * 将角度由弧度转换为度。
 * @param radians - 以弧度表示的角值。
 * @returns 以度为单位的角值。
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * 将方位角归一化到 `[0, 360)` 区间。
 * @param headingDegrees - 方位角，单位为度。
 * @returns 归一化后的方位角。
 */
export function normalizeHeading(headingDegrees: number): number {
  const value = headingDegrees % 360
  return value < 0 ? value + 360 : value
}

/**
 * 计算两个方位角之间的最小夹角。
 * @param a - 第一个方位角，单位为度。
 * @param b - 第二个方位角，单位为度。
 * @returns 最小夹角，取值位于 `[0, 180]`。
 */
export function angleBetweenHeadings(a: number, b: number): number {
  const diff = Math.abs(normalizeHeading(a) - normalizeHeading(b))
  return diff > 180 ? 360 - diff : diff
}

/**
 * 根据起点、方位角与距离推算目标经纬度（球面近似）。
 * @param origin - 起点经纬度。
 * @param headingDegrees - 方位角，单位为度，正北为 0，顺时针为正。
 * @param distanceMeters - 距离，单位为米。
 * @returns 目标点的经纬度坐标。
 * @throws {Arc3DError} 当参数非有限数时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function pointByHeadingDistance(
  origin: LngLat,
  headingDegrees: number,
  distanceMeters: number,
): LngLat {
  assertFiniteNumber(origin.longitude, "origin.longitude")
  assertFiniteNumber(origin.latitude, "origin.latitude")
  assertFiniteNumber(headingDegrees, "headingDegrees")
  assertFiniteNumber(distanceMeters, "distanceMeters")
  const lat1 = degreesToRadians(origin.latitude)
  const lon1 = degreesToRadians(origin.longitude)
  const brng = degreesToRadians(headingDegrees)
  const angular = distanceMeters / WGS84_SEMI_MAJOR_AXIS
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
    longitude: radiansToDegrees(lon2),
    latitude: radiansToDegrees(lat2),
  }
}

/**
 * 计算两点之间的大圆距离。
 * @param from - 起点经纬度。
 * @param to - 终点经纬度。
 * @returns 距离，单位为米。
 */
export function greatCircleDistanceMeters(from: LngLat, to: LngLat): number {
  const lat1 = degreesToRadians(from.latitude)
  const lat2 = degreesToRadians(to.latitude)
  const dLat = lat2 - lat1
  const dLon = degreesToRadians(to.longitude - from.longitude)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * WGS84_SEMI_MAJOR_AXIS
}

/**
 * 在两端点之间按比例线性插值经纬度。
 * @param from - 起点经纬度。
 * @param to - 终点经纬度。
 * @param t - 插值比例，取值位于 `[0, 1]`。
 * @returns 插值得到的经纬度坐标。
 */
export function interpolateLngLat(from: LngLat, to: LngLat, t: number): LngLat {
  return {
    longitude: from.longitude + (to.longitude - from.longitude) * t,
    latitude: from.latitude + (to.latitude - from.latitude) * t,
  }
}

/**
 * 沿折线按给定步长插值，返回包含首尾顶点的加密点集合。
 * @param points - 折线顶点集合，至少包含一个顶点。
 * @param stepMeters - 插值步长，单位为米，取值必须大于 0。
 * @returns 加密后的经纬度点集合，首尾顶点与输入一致。
 * @throws {Arc3DError} 当顶点为空或步长非正时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function interpolatePolyline(
  points: LngLat[],
  stepMeters: number,
): LngLat[] {
  if (points.length === 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "interpolatePolyline requires at least one point",
    )
  }
  if (!(stepMeters > 0)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "interpolatePolyline requires a positive step",
    )
  }
  if (points.length === 1) return [{ ...points[0] }]
  const result: LngLat[] = [{ ...points[0] }]
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1]
    const end = points[i]
    const segment = greatCircleDistanceMeters(start, end)
    if (segment <= 0) continue
    const divisions = Math.max(1, Math.round(segment / stepMeters))
    for (let d = 1; d <= divisions; d += 1) {
      result.push(interpolateLngLat(start, end, d / divisions))
    }
  }
  return result
}

/**
 * 计算多边形环的形心（平面近似，按有向面积加权）。
 * @param ring - 多边形顶点集合，至少包含三个顶点。
 * @returns 多边形的形心经纬度。
 * @throws {Arc3DError} 当顶点数量少于三个时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function polygonCentroid(ring: LngLat[]): LngLat {
  if (ring.length < 3) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "polygonCentroid requires at least three points",
    )
  }
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i]
    const next = ring[(i + 1) % ring.length]
    const cross =
      current.longitude * next.latitude - next.longitude * current.latitude
    area += cross
    cx += (current.longitude + next.longitude) * cross
    cy += (current.latitude + next.latitude) * cross
  }
  area *= 0.5
  if (Math.abs(area) < 1e-12) {
    return averageLngLat(ring)
  }
  const factor = 1 / (6 * area)
  return { longitude: cx * factor, latitude: cy * factor }
}

/**
 * 计算点集的地理范围。
 * @param points - 经纬度点集合，不能为空。
 * @returns 地理范围 `[west, south, east, north]`。
 * @throws {Arc3DError} 当点集为空时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function extentOf(points: LngLat[]): Extent {
  if (points.length === 0) {
    throw new Arc3DError("INVALID_ARGUMENT", "extentOf requires points")
  }
  let west = points[0].longitude
  let east = points[0].longitude
  let south = points[0].latitude
  let north = points[0].latitude
  for (const point of points) {
    if (point.longitude < west) west = point.longitude
    if (point.longitude > east) east = point.longitude
    if (point.latitude < south) south = point.latitude
    if (point.latitude > north) north = point.latitude
  }
  return [west, south, east, north]
}

function averageLngLat(points: LngLat[]): LngLat {
  let longitude = 0
  let latitude = 0
  for (const point of points) {
    longitude += point.longitude
    latitude += point.latitude
  }
  return {
    longitude: longitude / points.length,
    latitude: latitude / points.length,
  }
}
