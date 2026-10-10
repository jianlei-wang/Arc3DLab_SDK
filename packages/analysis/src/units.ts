/** WGS84 椭球长半轴长度，单位为米。 */
export const WGS84_A = 6378137
/** WGS84 椭球扁率。 */
export const WGS84_F = 1 / 298.257223563
/** WGS84 椭球第一偏心率平方。 */
export const WGS84_E2 = WGS84_F * (2 - WGS84_F)

/** 分析结果使用的默认单位集合。 */
export const ANALYSIS_UNITS = {
  length: "meters",
  area: "squareMeters",
  volume: "cubicMeters",
  angle: "degrees",
} as const

/** 长度结果使用的单位标识。 */
export type LengthUnit = typeof ANALYSIS_UNITS.length
/** 面积结果使用的单位标识。 */
export type AreaUnit = typeof ANALYSIS_UNITS.area
/** 角度结果使用的单位标识。 */
export type AngleUnit = typeof ANALYSIS_UNITS.angle
/** 高度基准，目前仅支持椭球高。 */
export type HeightDatum = "ellipsoid"
/** 距离计算模式，支持笛卡尔三维空间与测地线两种。 */
export type DistanceMode = "cartesian" | "geodesic"
/** 面积计算模式，支持测地线与平面两种。 */
export type AreaMode = "geodesic" | "planar"
/** 方位角参考方式，以正北为起点的顺时针方向。 */
export type HeadingReference = "north-clockwise"

/** 缺失高度时使用的占位数值。 */
export const MISSING_HEIGHT = 0

/** 长度测量结果。 */
export interface LengthResult {
  /** 测量得到的长度，单位为米。 */
  meters: number
  /** 长度单位标识。 */
  units: LengthUnit
  /** 距离计算模式。 */
  mode: DistanceMode
  /** 高度基准。 */
  heightDatum: HeightDatum
}

/** 面积测量结果。 */
export interface AreaResult {
  /** 测量得到的面积，单位为平方米。 */
  squareMeters: number
  /** 面积单位标识。 */
  units: AreaUnit
  /** 面积计算模式。 */
  mode: AreaMode
}

/** 角度测量结果。 */
export interface AngleResult {
  /** 测量得到的角度，单位为度。 */
  degrees: number
  /** 角度单位标识。 */
  units: AngleUnit
  /** 方位角参考方式。 */
  reference?: HeadingReference
}

/** 高度测量结果。 */
export interface HeightResult {
  /** 测量得到的高度，单位为米。 */
  meters: number
  /** 高度单位标识。 */
  units: LengthUnit
  /** 高度基准。 */
  heightDatum: HeightDatum
}
