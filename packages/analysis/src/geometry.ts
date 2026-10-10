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

export interface LngLatLike {
  longitude: number
  latitude: number
}

export interface RectQuery {
  west: number
  south: number
  east: number
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

export function toMeasurePoint(input: PositionInput): LngLatHeight {
  const point = parsePosition(input)
  return {
    ...point,
    height: Number.isFinite(point.height) ? point.height : MISSING_HEIGHT,
  }
}

export function closeRing(ring: LngLatLike[]): LngLatLike[] {
  if (ring.length === 0) return []
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first.longitude === last.longitude && first.latitude === last.latitude)
    return ring.slice()
  return [...ring, { longitude: first.longitude, latitude: first.latitude }]
}

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

export function splitRectAtAntimeridian(rect: RectQuery): RectQuery[] {
  if (rect.west <= rect.east) return [rect]
  return [
    { west: rect.west, south: rect.south, east: 180, north: rect.north },
    { west: -180, south: rect.south, east: rect.east, north: rect.north },
  ]
}

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

export function cartesianDistanceMeters(
  from: LngLatLike & { height?: number },
  to: LngLatLike & { height?: number },
): number {
  const a = toEcef(from)
  const b = toEcef(to)
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

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

export function ellipsoidHeightDelta(
  from: LngLatLike & { height?: number },
  to: LngLatLike & { height?: number },
): number {
  return Math.abs(
    (to.height ?? MISSING_HEIGHT) - (from.height ?? MISSING_HEIGHT),
  )
}

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

export function toLocalMeters(
  origin: LngLatLike,
  point: LngLatLike,
): { east: number; north: number } {
  return toEastNorth(origin, point)
}

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

export function planarRingArea(ring: LngLatLike[]): number {
  const unwrapped = unwrapRing(ring)
  if (unwrapped.length < 3) return 0
  const origin = unwrapped[0]
  return shoelace(unwrapped.map((point) => toEastNorth(origin, point)))
}

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

export function pointInRect(point: LngLatLike, rect: RectQuery): boolean {
  return splitRectAtAntimeridian(rect).some(
    (part) =>
      point.longitude >= part.west &&
      point.longitude <= part.east &&
      point.latitude >= part.south &&
      point.latitude <= part.north,
  )
}

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

export function ringEdges(ring: LngLatLike[]): Array<[LngLatLike, LngLatLike]> {
  const pts = closeRing(unwrapRing(ring))
  const edges: Array<[LngLatLike, LngLatLike]> = []
  for (let i = 0; i < pts.length - 1; i += 1) edges.push([pts[i], pts[i + 1]])
  return edges
}

export function segmentIntersectsPolygon(
  a: LngLatLike,
  b: LngLatLike,
  ring: LngLatLike[],
): boolean {
  if (pointInPolygon(a, ring) || pointInPolygon(b, ring)) return true
  return ringEdges(ring).some(([c, d]) => segmentsIntersect(a, b, c, d))
}

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

export type QueryRelation = "intersect" | "within"

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
