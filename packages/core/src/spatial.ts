import { Arc3DError } from "./errors"
import type { LngLatHeight } from "./types"

/**
 * Horizontal spatial reference metadata.
 *
 * The SDK never guesses a CRS: positions always carry (or inherit) a
 * `SpatialReference`. Coordinates expressed in a projected CRS are rejected by
 * `assertGeographicPosition` instead of being silently interpreted as
 * longitude/latitude.
 */
export type AxisOrder = "lng-lat" | "lat-lng"
export type AngularUnit = "degrees" | "radians"
export type LinearUnit = "meters" | "feet"
export type HorizontalCrs =
  "EPSG:4326" | "EPSG:4979" | "EPSG:3857" | (string & {})

export interface SpatialReference {
  readonly crs: HorizontalCrs
  readonly axisOrder?: AxisOrder
  readonly angularUnit?: AngularUnit
  readonly linearUnit?: LinearUnit
}

export type VerticalDatum = "ellipsoid" | "orthometric" | "terrain" | "design"

export interface VerticalReference {
  readonly datum: VerticalDatum
  readonly geoidModel?: string
  readonly linearUnit?: LinearUnit
}

export interface TimeRange {
  readonly start: string
  readonly end: string
}

export interface CoordinateTransform {
  readonly source: SpatialReference
  readonly target: SpatialReference
  forward(position: LngLatHeight): LngLatHeight
  inverse(position: LngLatHeight): LngLatHeight
}

export const WGS84: SpatialReference = {
  crs: "EPSG:4326",
  axisOrder: "lng-lat",
  angularUnit: "degrees",
  linearUnit: "meters",
}

export const WGS84_3D: SpatialReference = {
  crs: "EPSG:4979",
  axisOrder: "lng-lat",
  angularUnit: "degrees",
  linearUnit: "meters",
}

export const WEB_MERCATOR: SpatialReference = {
  crs: "EPSG:3857",
  axisOrder: "lng-lat",
  angularUnit: "degrees",
  linearUnit: "meters",
}

export const ELLIPSOID_VERTICAL: VerticalReference = {
  datum: "ellipsoid",
  linearUnit: "meters",
}

const GEOGRAPHIC_CRS = new Set(["EPSG:4326", "EPSG:4979", "CRS:84"])

export function resolveSpatialReference(
  input?: Partial<SpatialReference>,
): SpatialReference {
  if (!input?.crs) return WGS84
  return {
    crs: input.crs,
    axisOrder: input.axisOrder ?? "lng-lat",
    angularUnit: input.angularUnit ?? "degrees",
    linearUnit: input.linearUnit ?? "meters",
  }
}

export function resolveVerticalReference(
  input?: Partial<VerticalReference>,
): VerticalReference {
  if (!input?.datum) return ELLIPSOID_VERTICAL
  return {
    datum: input.datum,
    geoidModel: input.geoidModel,
    linearUnit: input.linearUnit ?? "meters",
  }
}

export function isGeographic(reference: SpatialReference): boolean {
  return GEOGRAPHIC_CRS.has(reference.crs)
}

export function sameSpatialReference(
  a: SpatialReference,
  b: SpatialReference,
): boolean {
  return (
    a.crs === b.crs &&
    (a.axisOrder ?? "lng-lat") === (b.axisOrder ?? "lng-lat") &&
    (a.angularUnit ?? "degrees") === (b.angularUnit ?? "degrees")
  )
}

/**
 * Guards that a position is expressed in a geographic CRS. Projected
 * coordinates must be transformed explicitly before analysis or rendering.
 */
export function assertGeographicPosition(
  reference: SpatialReference,
  action: string,
): void {
  if (!isGeographic(reference)) {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      `${action}: spatial reference ${reference.crs} is projected; transform to a geographic CRS first`,
    )
  }
}

export function identityTransform(
  reference: SpatialReference = WGS84,
): CoordinateTransform {
  return {
    source: reference,
    target: reference,
    forward: (position) => position,
    inverse: (position) => position,
  }
}

/**
 * Returns an identity transform when source and target match; returns
 * `undefined` when a real reprojection backend would be required. Callers must
 * handle `undefined` explicitly rather than assuming coordinates are compatible.
 */
export function tryCreateCoordinateTransform(
  source: SpatialReference,
  target: SpatialReference,
): CoordinateTransform | undefined {
  if (sameSpatialReference(source, target)) return identityTransform(source)
  return undefined
}

export function assertTimeRange(range: TimeRange, action: string): void {
  const start = Date.parse(range.start)
  const end = Date.parse(range.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `${action}: time range must use ISO 8601 instants`,
    )
  }
  if (end < start) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `${action}: time range end precedes start`,
    )
  }
}

/**
 * Documents the meaning of the shorthand `LngLat / LngLatHeight` inputs.
 */
export function describeDefaultShorthand(): string {
  return "LngLat/LngLatHeight default to WGS84 (EPSG:4326), degrees, longitude-latitude axis order, ellipsoidal height in meters"
}
