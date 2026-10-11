import {
  geodesicDistanceMeters,
  polygonAreaSquareMeters,
  type LngLatLike,
} from "./geometry"

/** 带可选高度的经纬度坐标。 */
export type LngLatHeightLike = LngLatLike & { height?: number }

/**
 * 去除高度，将坐标投影到椭球面上。
 * @param point - 待投影的坐标。
 * @returns 仅保留经度与纬度的坐标。
 */
export function projectToEllipsoid(point: LngLatLike): LngLatLike {
  return { longitude: point.longitude, latitude: point.latitude }
}

/**
 * 计算两点在椭球面上的投影距离，忽略高度差。
 * @param from - 起点坐标。
 * @param to - 终点坐标。
 * @returns 投影距离，单位为米。
 */
export function projectedDistanceMeters(
  from: LngLatHeightLike,
  to: LngLatHeightLike,
): number {
  return geodesicDistanceMeters(
    projectToEllipsoid(from),
    projectToEllipsoid(to),
  )
}

/**
 * 计算折线的表面距离，沿椭球面累计各段长度。
 * @param positions - 折线顶点列表。
 * @returns 表面距离，单位为米。
 */
export function surfaceDistanceMeters(positions: LngLatHeightLike[]): number {
  if (positions.length < 2) return 0
  let total = 0
  for (let i = 1; i < positions.length; i += 1) {
    total += projectedDistanceMeters(positions[i - 1], positions[i])
  }
  return total
}

/**
 * 计算由起点指向终点的连线与水平面的夹角。
 * @param from - 起点坐标，包含可选高度。
 * @param to - 终点坐标，包含可选高度。
 * @returns 坡角，单位为度，正值表示抬升，负值表示下降。
 */
export function slopeAngleDegrees(
  from: LngLatHeightLike,
  to: LngLatHeightLike,
): number {
  const horizontal = projectedDistanceMeters(from, to)
  const vertical = (to.height ?? 0) - (from.height ?? 0)
  if (horizontal === 0) return vertical === 0 ? 0 : 90 * Math.sign(vertical)
  return (Math.atan2(vertical, horizontal) * 180) / Math.PI
}

/**
 * 计算由三个顶点构成的三角形面积。
 * @param a - 第一个顶点。
 * @param b - 第二个顶点。
 * @param c - 第三个顶点。
 * @returns 面积，单位为平方米。
 */
export function triangleAreaSquareMeters(
  a: LngLatLike,
  b: LngLatLike,
  c: LngLatLike,
): number {
  return polygonAreaSquareMeters([a, b, c])
}
