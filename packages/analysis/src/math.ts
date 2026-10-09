export interface SlopeSample {
  slopeDegrees: number
  aspectDegrees: number
}

export interface SightSample {
  lineHeight: number
  terrainHeight: number
}

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

const EARTH_RADIUS = 6378137

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function slopeFromHeights(
  hCenter: number,
  hEast: number,
  hNorth: number,
  sampleMeters: number
): SlopeSample {
  const dx = sampleMeters > 0 ? sampleMeters : 1
  const dzdx = (hEast - hCenter) / dx
  const dzdy = (hNorth - hCenter) / dx
  const slopeDegrees = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
  let aspectDegrees = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI
  if (aspectDegrees < 0) aspectDegrees += 360
  return { slopeDegrees, aspectDegrees }
}

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

export function destinationLngLat(
  longitude: number,
  latitude: number,
  headingDegrees: number,
  distanceMeters: number
): { longitude: number; latitude: number } {
  const lat1 = (latitude * Math.PI) / 180
  const lon1 = (longitude * Math.PI) / 180
  const brng = (headingDegrees * Math.PI) / 180
  const angular = distanceMeters / EARTH_RADIUS
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(brng)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    )
  return {
    longitude: (lon2 * 180) / Math.PI,
    latitude: (lat2 * 180) / Math.PI,
  }
}

export function pointInRect(point: LngLatLike, rect: RectQuery): boolean {
  return (
    point.longitude >= rect.west &&
    point.longitude <= rect.east &&
    point.latitude >= rect.south &&
    point.latitude <= rect.north
  )
}

export function pointInPolygon(point: LngLatLike, ring: LngLatLike[]): boolean {
  if (ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].longitude
    const yi = ring[i].latitude
    const xj = ring[j].longitude
    const yj = ring[j].latitude
    const intersect =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function haversineMeters(from: LngLatLike, to: LngLatLike): number {
  const lat1 = (from.latitude * Math.PI) / 180
  const lat2 = (to.latitude * Math.PI) / 180
  const dLat = lat2 - lat1
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function anyVertexInRect(positions: LngLatLike[], rect: RectQuery): boolean {
  return positions.some((point) => pointInRect(point, rect))
}

export function anyVertexInPolygon(positions: LngLatLike[], ring: LngLatLike[]): boolean {
  return positions.some((point) => pointInPolygon(point, ring))
}

export function anyVertexWithinMeters(
  positions: LngLatLike[],
  center: LngLatLike,
  meters: number
): boolean {
  return positions.some((point) => haversineMeters(center, point) <= meters)
}

export function rayRangeMeters(
  radius: number,
  sampleCount: number,
  occludedIndex?: number
): number {
  if (occludedIndex === undefined) return radius
  if (sampleCount <= 1) return 0
  return (occludedIndex / (sampleCount - 1)) * radius
}

export function accumulateCutFill(
  deltas: number[],
  cellArea: number
): { cut: number; fill: number } {
  let cut = 0
  let fill = 0
  for (const delta of deltas) {
    if (delta > 0) cut += delta * cellArea
    else fill += -delta * cellArea
  }
  return { cut, fill }
}

export function viewshedEnvelope(
  longitude: number,
  latitude: number,
  rays: Array<{ heading: number; rangeMeters: number }>
): LngLatLike[] {
  return rays.map((ray) =>
    destinationLngLat(longitude, latitude, ray.heading, Math.max(ray.rangeMeters, 1))
  )
}
