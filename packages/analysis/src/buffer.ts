import {
  Arc3DError,
  parsePosition,
  type Arc3DContext,
  type PositionInput,
} from "@arc3dlab/core"
import {
  fromLocalMeters,
  geodesicDistanceMeters,
  toLocalMeters,
  type LngLatLike,
} from "./geometry"

/** 缓冲区构造选项。 */
export interface BufferOptions {
  /** 折线或环形边界每一段使用的插值步长，单位为米。 */
  stepMeters?: number
}

/** 默认的折线插值步长，单位为米。 */
const DEFAULT_STEP_METERS = 1000

/** 默认的圆形缓冲分段数量。 */
const DEFAULT_CIRCLE_SEGMENTS = 64

function assertPositiveDistance(distance: number): void {
  if (!Number.isFinite(distance) || distance <= 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `buffer distance must be a positive number: ${distance}`,
    )
  }
}

function toLngLat(input: PositionInput): LngLatLike {
  const point = parsePosition(input)
  return { longitude: point.longitude, latitude: point.latitude }
}

function closeRing(ring: LngLatLike[]): LngLatLike[] {
  if (ring.length === 0) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first.longitude === last.longitude && first.latitude === last.latitude) {
    return ring.slice()
  }
  return [...ring, { longitude: first.longitude, latitude: first.latitude }]
}

/**
 * 构造单点的圆形缓冲区边界。
 *
 * 采用局部东-北平面近似（`"local-planar"`），以圆心为原点固定经度缩放，
 * 仅适用于圆心附近、非极区的小半径缓冲；高纬与大半径会产生失真。
 * @param center - 圆心坐标。
 * @param distance - 缓冲半径，单位为米，取值必须大于 0。
 * @param segments - 圆周分段数量，默认 64。
 * @returns 闭合的缓冲区边界点列表。
 * @throws {Arc3DError} 当半径为非正数时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function bufferPoint(
  center: PositionInput,
  distance: number,
  segments: number = DEFAULT_CIRCLE_SEGMENTS,
): LngLatLike[] {
  assertPositiveDistance(distance)
  const origin = toLngLat(center)
  const count = Math.max(8, Math.floor(segments))
  const ring: LngLatLike[] = []
  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / count
    ring.push(
      fromLocalMeters(
        origin,
        distance * Math.cos(angle),
        distance * Math.sin(angle),
      ),
    )
  }
  return closeRing(ring)
}

/**
 * 构造折线的缓冲区边界。
 *
 * 采用局部东-北平面近似（`"local-planar"`），以首个顶点为原点固定经度缩放，
 * 仅适用于折线附近、非极区的小距离缓冲。
 * @param positions - 折线顶点列表，至少包含两个顶点。
 * @param distance - 缓冲距离，单位为米，取值必须大于 0。
 * @param options - 可选参数，包含插值步长。
 * @returns 闭合的缓冲区边界点列表。
 * @throws {Arc3DError} 当顶点不足或距离非正时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function bufferPolyline(
  positions: PositionInput[],
  distance: number,
  options: BufferOptions = {},
): LngLatLike[] {
  assertPositiveDistance(distance)
  if (positions.length < 2) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "bufferPolyline requires at least two positions",
    )
  }
  const densified = densify(
    positions,
    options.stepMeters ?? DEFAULT_STEP_METERS,
  )
  if (densified.length < 2) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "bufferPolyline requires at least two distinct positions",
    )
  }
  const origin = densified[0]
  const local = densified.map((point) => toLocalMeters(origin, point))
  const left: LngLatLike[] = []
  const right: LngLatLike[] = []
  for (let i = 0; i < local.length; i += 1) {
    const normal = vertexNormal(local, i)
    left.push(
      fromLocalMeters(
        origin,
        local[i].east + normal.east * distance,
        local[i].north + normal.north * distance,
      ),
    )
    right.push(
      fromLocalMeters(
        origin,
        local[i].east - normal.east * distance,
        local[i].north - normal.north * distance,
      ),
    )
  }
  return closeRing([...left, ...right.reverse()])
}

/**
 * 构造多边形环的缓冲区边界，支持外扩与内缩。
 *
 * 采用局部东-北平面近似（`"local-planar"`），以环首点为原点固定经度缩放，
 * 仅适用于多边形附近、非极区的小距离缓冲。
 * @param ring - 多边形环顶点列表，至少包含三个顶点。
 * @param distance - 缓冲距离，单位为米；正值外扩，负值内缩，取值不能为 0。
 * @returns 闭合的缓冲区边界点列表。
 * @throws {Arc3DError} 当顶点不足或距离为 0 时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function bufferPolygon(
  ring: PositionInput[],
  distance: number,
): LngLatLike[] {
  if (!Number.isFinite(distance) || distance === 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `polygon buffer distance must be non-zero: ${distance}`,
    )
  }
  if (ring.length < 3) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "bufferPolygon requires at least three positions",
    )
  }
  const points = ring.map(toLngLat)
  const origin = points[0]
  const local = points.map((point) => toLocalMeters(origin, point))
  const centroid = {
    east: local.reduce((sum, p) => sum + p.east, 0) / local.length,
    north: local.reduce((sum, p) => sum + p.north, 0) / local.length,
  }
  const offset = Math.abs(distance)
  const outward = distance > 0
  const result: LngLatLike[] = []
  for (let i = 0; i < local.length; i += 1) {
    const normal = vertexNormal(local, i, true)
    const towardOutside =
      (local[i].east - centroid.east) * normal.east +
        (local[i].north - centroid.north) * normal.north >=
      0
    const sign = towardOutside === outward ? 1 : -1
    result.push(
      fromLocalMeters(
        origin,
        local[i].east + normal.east * offset * sign,
        local[i].north + normal.north * offset * sign,
      ),
    )
  }
  return closeRing(result)
}

function densify(positions: PositionInput[], stepMeters: number): LngLatLike[] {
  const points = positions.map(toLngLat)
  if (!(stepMeters > 0)) return points
  const result: LngLatLike[] = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1]
    const end = points[i]
    const segment = geodesicDistanceMeters(start, end)
    if (segment <= 0) continue
    const divisions = Math.max(1, Math.round(segment / stepMeters))
    for (let d = 1; d <= divisions; d += 1) {
      const t = d / divisions
      result.push({
        longitude: start.longitude + (end.longitude - start.longitude) * t,
        latitude: start.latitude + (end.latitude - start.latitude) * t,
      })
    }
  }
  return result
}

function vertexNormal(
  local: Array<{ east: number; north: number }>,
  index: number,
  closed = false,
): { east: number; north: number } {
  const count = local.length
  let prev: { east: number; north: number }
  let next: { east: number; north: number }
  if (closed) {
    prev = local[(index - 1 + count) % count]
    next = local[(index + 1) % count]
  } else {
    prev = local[Math.max(0, index - 1)]
    next = local[Math.min(count - 1, index + 1)]
  }
  let dx = next.east - prev.east
  let dy = next.north - prev.north
  if (dx === 0 && dy === 0) {
    dx = 1
    dy = 0
  }
  const length = Math.hypot(dx, dy)
  return { east: -dy / length, north: dx / length }
}

/** 缓冲区分析服务，基于点、折线或多边形构造缓冲区边界。 */
export class BufferService {
  /**
   * 创建缓冲区分析服务。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 构造单点的圆形缓冲区边界。
   * @param center - 圆心坐标。
   * @param distance - 缓冲半径，单位为米。
   * @param segments - 圆周分段数量。
   * @returns 闭合的缓冲区边界点列表。
   */
  point(
    center: PositionInput,
    distance: number,
    segments?: number,
  ): LngLatLike[] {
    this.context.lifecycle.assertUsable("buffer point")
    return bufferPoint(center, distance, segments)
  }

  /**
   * 构造折线的缓冲区边界。
   * @param positions - 折线顶点列表。
   * @param distance - 缓冲距离，单位为米。
   * @param options - 可选参数，包含插值步长。
   * @returns 闭合的缓冲区边界点列表。
   */
  polyline(
    positions: PositionInput[],
    distance: number,
    options?: BufferOptions,
  ): LngLatLike[] {
    this.context.lifecycle.assertUsable("buffer polyline")
    return bufferPolyline(positions, distance, options)
  }

  /**
   * 构造多边形环的缓冲区边界。
   * @param ring - 多边形环顶点列表。
   * @param distance - 缓冲距离，单位为米；正值外扩，负值内缩。
   * @returns 闭合的缓冲区边界点列表。
   */
  polygon(ring: PositionInput[], distance: number): LngLatLike[] {
    this.context.lifecycle.assertUsable("buffer polygon")
    return bufferPolygon(ring, distance)
  }
}
