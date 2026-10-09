export const WGS84_A = 6378137
export const WGS84_F = 1 / 298.257223563
export const WGS84_E2 = WGS84_F * (2 - WGS84_F)

export const ANALYSIS_UNITS = {
  length: "meters",
  area: "squareMeters",
  volume: "cubicMeters",
  angle: "degrees",
} as const

export type LengthUnit = typeof ANALYSIS_UNITS.length
export type AreaUnit = typeof ANALYSIS_UNITS.area
export type AngleUnit = typeof ANALYSIS_UNITS.angle
export type HeightDatum = "ellipsoid"
export type DistanceMode = "cartesian" | "geodesic"
export type AreaMode = "geodesic" | "planar"
export type HeadingReference = "north-clockwise"

export const MISSING_HEIGHT = 0

export interface LengthResult {
  meters: number
  units: LengthUnit
  mode: DistanceMode
  heightDatum: HeightDatum
}

export interface AreaResult {
  squareMeters: number
  units: AreaUnit
  mode: AreaMode
}

export interface AngleResult {
  degrees: number
  units: AngleUnit
  reference?: HeadingReference
}

export interface HeightResult {
  meters: number
  units: LengthUnit
  heightDatum: HeightDatum
}
