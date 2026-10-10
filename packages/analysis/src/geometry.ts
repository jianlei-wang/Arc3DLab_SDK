import {
  parsePosition,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import {
  MISSING_HEIGHT,
  WGS84_A,
  WGS84_E2,
  type AreaMode,
  type DistanceMode,
} from "./units"

/** 经纬度坐标对，仅包含经度与纬度。 */
export interface LngLatLike {
  /** 经度，单位为度。 */
  longitude: number
  /** 纬度，单位为度。 */
  latitude: number
}

/** 矩形查询范围，使用西、南、东、北四个边界定义。 */
export interface RectQuery {
  /** 西边界经度。 */
  west: number
  /** 南边界纬度。 */
  south: number
  /** 东边界经度。 */
  east: number
  /** 北边界纬度。 */
  north: number
}

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

function deltaLonRad(from: LngLatLike, to: LngLatLike): number {
  let dLon = to.longitude - from.longitude
  while (dLon > 180) dLon -= 360
  while (dLon < -180) dLon += 360
  return dLon * DEG
}

/**
 * 将多种位置输入解析并归一化为测量点，缺失高度时使用占位值。
 * @param input - 位置输入，可为多种坐标形式。
 * @returns 归一化后的经纬高测量点。
 */
export function toMeasurePoint(input: PositionInput): LngLatHeight {
  const point = parsePosition(input)
  return {
    ...point,
    height: Number.isFinite(point.height) ? point.height : MISSING_HEIGHT,
  }
}

/**
 * 关闭环形边界，若首尾点不重合则补上起始点。
 * @param ring - 环形边界点列表。
 * @returns 闭合后的环形边界点列表。
 */
export function closeRing(ring: LngLatLike[]): LngLatLike[] {
  if (ring.length === 0) return []
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first.longitude === last.longitude && first.latitude === last.latitude)
    return ring.slice()
  return [...ring, { longitude: first.longitude, latitude: first.latitude }]
}

/**
 * 展开环形边界经度，消除跨越 180 度经线造成的跳变。
 * @param ring - 环形边界点列表。
 * @returns 经度连续化后的环形边界点列表。
 */
export function unwrapRing(ring: LngLatLike[]): LngLatLike[] {
  if (ring.length === 0) return []
  const out: LngLatLike[] = [
    { longitude: ring[0].longitude, latitude: ring[0].latitude },
  ]
  for (let i = 1; i < ring.length; i += 1) {
    let lon = ring[i].longitude
    const prev = out[i - 1].longitude
    while (lon - prev > 180) lon -= 360
    while (lon - prev < -180) lon += 360
    out.push({ longitude: lon, latitude: ring[i].latitude })
  }
  return out
}

/**
 * 在跨越 180 度经线时将矩形查询范围拆分为两部分。
 * @param rect - 待拆分的矩形范围。
 * @returns 拆分后的矩形范围列表。
 */
export function splitRectAtAntimeridian(rect: RectQuery): RectQuery[] {
  if (rect.west <= rect.east) return [rect]
  return [
    { west: rect.west, south: rect.south, east: 180, north: rect.north },
    { west: -180, south: rect.south, east: rect.east, north: rect.north },
  ]
}

/**
 * 将经纬高坐标转换为地心直角坐标。
 * @param point - 包含经度、纬度及可选高度的坐标点。
 * @returns 地心直角坐标三元组。
 */
export function toEcef(
  point: LngLatLike & { height?: number },
): [number, number, number] {
  const lon = point.longitude * DEG
  const lat = point.latitude * DEG
  const height = point.height ?? MISSING_HEIGHT
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat)
  return [
    (n + height) * cosLat * Math.cos(lon),
    (n + height) * cosLat * Math.sin(lon),
    (n * (1 - WGS84_E2) + height) * sinLat,
  ]
}

/**
 * 计算两点之间的笛卡尔直线距离。
 * @param from - 起点坐标。
 * @param to - 终点坐标。
 * @returns 距离，单位为米。
 */
export function cartesianDistanceMeters(
  from: LngLatLike & { height?: number },
  to: LngLatLike & { height?: number },
): number {
  const a = toEcef(from)
  const b = toEcef(to)
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

/**
 * 计算两点之间的测地线距离。
 * @param from - 起点坐标。
 * @param to - 终点坐标。
 * @returns 测地线距离，单位为米。
 */
export function geodesicDistanceMeters(
  from: LngLatLike,
  to: LngLatLike,
): number {
  const lat1 = from.latitude * DEG
  const lat2 = to.latitude * DEG
  const dLat = lat2 - lat1
  const dLon = deltaLonRad(from, to)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * WGS84_A * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/**
 * 计算折线路径的总长度。
 * @param positions - 路径顶点列表。
 * @param mode - 距离计算模式。
 * @returns 路径总长度，单位为米。
 */
export function pathLengthMeters(
  positions: Array<LngLatLike & { height?: number }>,
  mode: DistanceMode,
): number {
  if (positions.length < 2) return 0
  let meters = 0
  for (let i = 1; i < positions.length; i += 1) {
    meters +=
      mode === "geodesic"
        ? geodesicDistanceMeters(positions[i - 1], positions[i])
        : cartesianDistanceMeters(positions[i - 1], positions[i])
  }
  return meters
}

/**
 * 计算两点之间的椭球高差绝对值。
 * @param from - 起点坐标。
 * @param to - 终点坐标。
 * @returns 高度差的绝对值，单位为米。
 */
export function ellipsoidHeightDelta(
  from: LngLatLike & { height?: number },
  to: LngLatLike & { height?: number },
): number {
  return Math.abs(
    (to.height ?? MISSING_HEIGHT) - (from.height ?? MISSING_HEIGHT),
  )
}

/**
 * 计算从起点指向终点的方位角。
 * @param from - 起点坐标。
 * @param to - 终点坐标。
 * @returns 方位角，单位为度，以正北为起点顺时针。
 */
export function headingDegrees(from: LngLatLike, to: LngLatLike): number {
  if (from.longitude === to.longitude && from.latitude === to.latitude) return 0
  const lat1 = from.latitude * DEG
  const lat2 = to.latitude * DEG
  const dLon = deltaLonRad(from, to)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const degrees = Math.atan2(y, x) * RAD
  return (degrees + 360) % 360
}

/**
 * 计算以中间点为顶点、由起点与终点构成的空间角。
 * @param from - 起点坐标。
 * @param via - 顶点坐标。
 * @param to - 终点坐标。
 * @returns 空间角，单位为度。
 */
export function spaceAngleDegrees(
  from: LngLatLike & { height?: number },
  via: LngLatLike & { height?: number },
  to: LngLatLike & { height?: number },
): number {
  const origin = toEcef(via)
  const a = toEcef(from)
  const b = toEcef(to)
  const va = [a[0] - origin[0], a[1] - origin[1], a[2] - origin[2]] as const
  const vb = [b[0] - origin[0], b[1] - origin[1], b[2] - origin[2]] as const
  const magA = Math.hypot(va[0], va[1], va[2])
  const magB = Math.hypot(vb[0], vb[1], vb[2])
  if (magA === 0 || magB === 0) return 0
  const cos = (va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]) / (magA * magB)
  return Math.acos(Math.min(1, Math.max(-1, cos))) * RAD
}

function toEastNorth(
  origin: LngLatLike,
  point: LngLatLike,
): { east: number; north: number } {
  const lat = origin.latitude * DEG
  return {
    east: (point.longitude - origin.longitude) * DEG * WGS84_A * Math.cos(lat),
    north: (point.latitude - origin.latitude) * DEG * WGS84_A,
  }
}

/**
 * 以指定原点将经纬度投影为局部东向与北向米制坐标。
 * @param origin - 投影原点坐标。
 * @param point - 待投影坐标。
 * @returns 局部东向与北向偏移，单位为米。
 */
export function toLocalMeters(
  origin: LngLatLike,
  point: LngLatLike,
): { east: number; north: number } {
  return toEastNorth(origin, point)
}

/**
 * 将局部东向与北向米制偏移还原为经纬度坐标。
 * @param origin - 投影原点坐标。
 * @param east - 东向偏移，单位为米。
 * @param north - 北向偏移，单位为米。
 * @returns 还原得到的经纬度坐标。
 */
export function fromLocalMeters(
  origin: LngLatLike,
  east: number,
  north: number,
): LngLatLike {
  const lat = origin.latitude * DEG
  const denom = WGS84_A * Math.cos(lat)
  return {
    longitude: origin.longitude + (denom === 0 ? 0 : (east / denom) * RAD),
    latitude: origin.latitude + (north / WGS84_A) * RAD,
  }
}

function shoelace(points: Array<{ east: number; north: number }>): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    sum += current.east * next.north - next.east * current.north
  }
  return Math.abs(sum) / 2
}

/**
 * 使用平面近似计算环形边界的面积。
 * @param ring - 环形边界点列表。
 * @returns 面积，单位为平方米。
 */
export function planarRingArea(ring: LngLatLike[]): number {
  const unwrapped = unwrapRing(ring)
  if (unwrapped.length < 3) return 0
  const origin = unwrapped[0]
  return shoelace(unwrapped.map((point) => toEastNorth(origin, point)))
}

/**
 * 使用测地线公式计算环形边界的面积。
 * @param ring - 环形边界点列表。
 * @returns 面积，单位为平方米。
 */
export function geodesicRingArea(ring: LngLatLike[]): number {
  const pts = closeRing(unwrapRing(ring))
  if (pts.length < 4) return 0
  let total = 0
  for (let i = 0; i < pts.length - 1; i += 1) {
    const lon1 = pts[i].longitude * DEG
    const lon2 = pts[i + 1].longitude * DEG
    const lat1 = pts[i].latitude * DEG
    const lat2 = pts[i + 1].latitude * DEG
    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs((total * WGS84_A * WGS84_A) / 2)
}

/**
 * 计算带孔洞多边形的面积。
 * @param outer - 外环边界点列表。
 * @param holes - 孔洞边界点列表，默认为空。
 * @param mode - 面积计算模式，默认为测地线。
 * @returns 面积，单位为平方米。
 */
export function polygonAreaSquareMeters(
  outer: LngLatLike[],
  holes: LngLatLike[][] = [],
  mode: AreaMode = "geodesic",
): number {
  const areaOf = mode === "planar" ? planarRingArea : geodesicRingArea
  const outerArea = areaOf(outer)
  const holeArea = holes.reduce((sum, hole) => sum + areaOf(hole), 0)
  return Math.max(0, outerArea - holeArea)
}

/**
 * 判断点是否落在矩形范围内。
 * @param point - 待判断的点。
 * @param rect - 矩形范围。
 * @returns 点位于矩形内时返回 true。
 */
export function pointInRect(point: LngLatLike, rect: RectQuery): boolean {
  return splitRectAtAntimeridian(rect).some(
    (part) =>
      point.longitude >= part.west &&
      point.longitude <= part.east &&
      point.latitude >= part.south &&
      point.latitude <= part.north,
  )
}

/**
 * 判断点是否落在多边形边界内。
 * @param point - 待判断的点。
 * @param ring - 多边形边界点列表。
 * @returns 点位于多边形内时返回 true。
 */
export function pointInPolygon(point: LngLatLike, ring: LngLatLike[]): boolean {
  const pts = unwrapRing(ring)
  if (pts.length < 3) return false
  const origin = pts[0]
  let lon = point.longitude
  while (lon - origin.longitude > 180) lon -= 360
  while (lon - origin.longitude < -180) lon += 360
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const xi = pts[i].longitude
    const yi = pts[i].latitude
    const xj = pts[j].longitude
    const yj = pts[j].latitude
    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      lon <
        ((xj - xi) * (point.latitude - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function orientation(a: LngLatLike, b: LngLatLike, c: LngLatLike): number {
  return (
    (b.longitude - a.longitude) * (c.latitude - a.latitude) -
    (b.latitude - a.latitude) * (c.longitude - a.longitude)
  )
}

function onSegment(a: LngLatLike, b: LngLatLike, c: LngLatLike): boolean {
  return (
    Math.min(a.longitude, b.longitude) - 1e-12 <= c.longitude &&
    c.longitude <= Math.max(a.longitude, b.longitude) + 1e-12 &&
    Math.min(a.latitude, b.latitude) - 1e-12 <= c.latitude &&
    c.latitude <= Math.max(a.latitude, b.latitude) + 1e-12
  )
}

/**
 * 判断两条线段是否相交。
 * @param a - 第一条线段的起点。
 * @param b - 第一条线段的终点。
 * @param c - 第二条线段的起点。
 * @param d - 第二条线段的终点。
 * @returns 两条线段相交时返回 true。
 */
export function segmentsIntersect(
  a: LngLatLike,
  b: LngLatLike,
  c: LngLatLike,
  d: LngLatLike,
): boolean {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  if (o1 * o2 < 0 && o3 * o4 < 0) return true
  if (Math.abs(o1) < 1e-18 && onSegment(a, b, c)) return true
  if (Math.abs(o2) < 1e-18 && onSegment(a, b, d)) return true
  if (Math.abs(o3) < 1e-18 && onSegment(c, d, a)) return true
  if (Math.abs(o4) < 1e-18 && onSegment(c, d, b)) return true
  return false
}

function rectCorners(rect: RectQuery): LngLatLike[] {
  return [
    { longitude: rect.west, latitude: rect.south },
    { longitude: rect.east, latitude: rect.south },
    { longitude: rect.east, latitude: rect.north },
    { longitude: rect.west, latitude: rect.north },
  ]
}

function rectEdges(rect: RectQuery): Array<[LngLatLike, LngLatLike]> {
  const corners = rectCorners(rect)
  return [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ]
}

function pointInUnwrappedRect(point: LngLatLike, rect: RectQuery): boolean {
  return (
    point.longitude >= rect.west &&
    point.longitude <= rect.east &&
    point.latitude >= rect.south &&
    point.latitude <= rect.north
  )
}

function shiftRectToward(part: RectQuery, refLon: number): RectQuery {
  let west = part.west
  let east = part.east
  while (east < refLon - 180) {
    west += 360
    east += 360
  }
  while (west > refLon + 180) {
    west -= 360
    east -= 360
  }
  return { west, south: part.south, east, north: part.north }
}

/**
 * 判断线段是否与矩形相交。
 * @param a - 线段起点。
 * @param b - 线段终点。
 * @param rect - 矩形范围。
 * @returns 线段与矩形相交时返回 true。
 */
export function segmentIntersectsRect(
  a: LngLatLike,
  b: LngLatLike,
  rect: RectQuery,
): boolean {
  const unwrapped = unwrapRing([a, b])
  const ua = unwrapped[0]
  const ub = unwrapped[unwrapped.length - 1]
  return splitRectAtAntimeridian(rect).some((part) => {
    const shifted = shiftRectToward(part, ua.longitude)
    if (pointInUnwrappedRect(ua, shifted) || pointInUnwrappedRect(ub, shifted))
      return true
    return rectEdges(shifted).some(([c, d]) => segmentsIntersect(ua, ub, c, d))
  })
}

/**
 * 将环形边界转换为边列表。
 * @param ring - 环形边界点列表。
 * @returns 由相邻顶点组成的边列表。
 */
export function ringEdges(ring: LngLatLike[]): Array<[LngLatLike, LngLatLike]> {
  const pts = closeRing(unwrapRing(ring))
  const edges: Array<[LngLatLike, LngLatLike]> = []
  for (let i = 0; i < pts.length - 1; i += 1) edges.push([pts[i], pts[i + 1]])
  return edges
}

/**
 * 判断线段是否与多边形相交。
 * @param a - 线段起点。
 * @param b - 线段终点。
 * @param ring - 多边形边界点列表。
 * @returns 线段与多边形相交时返回 true。
 */
export function segmentIntersectsPolygon(
  a: LngLatLike,
  b: LngLatLike,
  ring: LngLatLike[],
): boolean {
  if (pointInPolygon(a, ring) || pointInPolygon(b, ring)) return true
  return ringEdges(ring).some(([c, d]) => segmentsIntersect(a, b, c, d))
}

/**
 * 判断多边形是否与矩形相交。
 * @param ring - 多边形边界点列表。
 * @param rect - 矩形范围。
 * @returns 多边形与矩形相交时返回 true。
 */
export function polygonIntersectsRect(
  ring: LngLatLike[],
  rect: RectQuery,
): boolean {
  return splitRectAtAntimeridian(rect).some((part) => {
    if (ring.some((point) => pointInRect(point, part))) return true
    if (rectCorners(part).some((corner) => pointInPolygon(corner, ring)))
      return true
    return ringEdges(ring).some(([a, b]) => segmentIntersectsRect(a, b, part))
  })
}

/**
 * 判断多边形是否完全包含矩形。
 * @param ring - 多边形边界点列表。
 * @param rect - 矩形范围。
 * @returns 多边形完全包含矩形时返回 true。
 */
export function polygonContainsRect(
  ring: LngLatLike[],
  rect: RectQuery,
): boolean {
  return splitRectAtAntimeridian(rect).every((part) => {
    if (!rectCorners(part).every((corner) => pointInPolygon(corner, ring)))
      return false
    return ringEdges(ring).every(([a, b]) => !segmentIntersectsRect(a, b, part))
  })
}

/**
 * 计算点到线段的最短距离。
 * @param point - 目标点。
 * @param a - 线段起点。
 * @param b - 线段终点。
 * @returns 最短距离，单位为米。
 */
export function distancePointToSegmentMeters(
  point: LngLatLike,
  a: LngLatLike,
  b: LngLatLike,
): number {
  const origin = a
  const p = toEastNorth(origin, point)
  const ab = toEastNorth(origin, b)
  const length2 = ab.east * ab.east + ab.north * ab.north
  if (length2 === 0) return geodesicDistanceMeters(point, a)
  let t = (p.east * ab.east + p.north * ab.north) / length2
  t = Math.max(0, Math.min(1, t))
  const closest = {
    longitude: a.longitude + (b.longitude - a.longitude) * t,
    latitude: a.latitude + (b.latitude - a.latitude) * t,
  }
  return geodesicDistanceMeters(point, closest)
}

/**
 * 计算点到多边形边界的最短距离。
 * @param point - 目标点。
 * @param ring - 多边形边界点列表。
 * @returns 最短距离，单位为米，点在内部时返回 0。
 */
export function distancePointToRingMeters(
  point: LngLatLike,
  ring: LngLatLike[],
): number {
  if (pointInPolygon(point, ring)) return 0
  const edges = ringEdges(ring)
  if (edges.length === 0) return Number.POSITIVE_INFINITY
  return Math.min(
    ...edges.map(([a, b]) => distancePointToSegmentMeters(point, a, b)),
  )
}

/**
 * 计算点到折线路径的最短距离。
 * @param point - 目标点。
 * @param positions - 折线路径顶点列表。
 * @returns 最短距离，单位为米。
 */
export function minDistanceToPositionsMeters(
  point: LngLatLike,
  positions: LngLatLike[],
): number {
  if (positions.length === 0) return Number.POSITIVE_INFINITY
  if (positions.length === 1) return geodesicDistanceMeters(point, positions[0])
  let min = Number.POSITIVE_INFINITY
  for (let i = 1; i < positions.length; i += 1) {
    min = Math.min(
      min,
      distancePointToSegmentMeters(point, positions[i - 1], positions[i]),
    )
  }
  return min
}

/** 几何图形与查询范围的空间关系，支持相交与包含两种。 */
export type QueryRelation = "intersect" | "within"

/**
 * 判断几何图形是否位于指定中心点的给定距离范围内。
 * @param type - 几何图形类型。
 * @param positions - 几何图形顶点列表。
 * @param center - 距离中心点。
 * @param meters - 距离阈值，单位为米。
 * @returns 图形位于距离范围内时返回 true。
 */
export function geometryMatchesDistance(
  type: string,
  positions: LngLatLike[],
  center: LngLatLike,
  meters: number,
): boolean {
  if (positions.length === 0) return false
  if (type === "polygon")
    return distancePointToRingMeters(center, positions) <= meters
  return minDistanceToPositionsMeters(center, positions) <= meters
}

/**
 * 判断几何图形是否与矩形满足指定空间关系。
 * @param type - 几何图形类型。
 * @param positions - 几何图形顶点列表。
 * @param rect - 矩形范围。
 * @param relation - 空间关系，相交或包含。
 * @returns 满足关系时返回 true。
 */
export function geometryMatchesRect(
  type: string,
  positions: LngLatLike[],
  rect: RectQuery,
  relation: QueryRelation,
): boolean {
  if (positions.length === 0) return false
  if (relation === "within") {
    return positions.every((point) => pointInRect(point, rect))
  }
  if (type === "polygon") return polygonIntersectsRect(positions, rect)
  if (positions.length === 1) return pointInRect(positions[0], rect)
  for (let i = 1; i < positions.length; i += 1) {
    if (segmentIntersectsRect(positions[i - 1], positions[i], rect)) return true
  }
  return positions.some((point) => pointInRect(point, rect))
}

/**
 * 判断几何图形是否与多边形满足指定空间关系。
 * @param type - 几何图形类型。
 * @param positions - 几何图形顶点列表。
 * @param ring - 多边形边界点列表。
 * @param relation - 空间关系，相交或包含。
 * @returns 满足关系时返回 true。
 */
export function geometryMatchesPolygon(
  type: string,
  positions: LngLatLike[],
  ring: LngLatLike[],
  relation: QueryRelation,
): boolean {
  if (positions.length === 0) return false
  if (relation === "within") {
    return positions.every((point) => pointInPolygon(point, ring))
  }
  if (type === "polygon") {
    if (polygonIntersectsRect(positions, boundsOf(ring))) {
      if (positions.some((point) => pointInPolygon(point, ring))) return true
      if (ring.some((point) => pointInPolygon(point, positions))) return true
      return ringEdges(positions).some(([a, b]) =>
        segmentIntersectsPolygon(a, b, ring),
      )
    }
    return false
  }
  if (positions.length === 1) return pointInPolygon(positions[0], ring)
  for (let i = 1; i < positions.length; i += 1) {
    if (segmentIntersectsPolygon(positions[i - 1], positions[i], ring))
      return true
  }
  return positions.some((point) => pointInPolygon(point, ring))
}

function boundsOf(ring: LngLatLike[]): RectQuery {
  const pts = unwrapRing(ring)
  const lons = pts.map((point) => point.longitude)
  const lats = pts.map((point) => point.latitude)
  const west = Math.min(...lons)
  const east = Math.max(...lons)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  if (east - west >= 360) return { west: -180, south, east: 180, north }
  if (east > 180) return { west, south, east: east - 360, north }
  if (west < -180) return { west: west + 360, south, east, north }
  return { west, south, east, north }
}
