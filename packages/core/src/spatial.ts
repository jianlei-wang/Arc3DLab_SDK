import { Arc3DError } from "./errors"
import type { LngLatHeight } from "./types"

/**
 * 水平空间参考元数据。
 *
 * SDK 不猜测 CRS：坐标始终携带（或继承）`SpatialReference`。投影坐标会被
 * `assertGeographicPosition` 拒绝，而不会被静默按经纬度解释。
 */

/** 坐标轴顺序。 */
export type AxisOrder = "lng-lat" | "lat-lng"
/** 角度单位。 */
export type AngularUnit = "degrees" | "radians"
/** 长度单位。 */
export type LinearUnit = "meters" | "feet"
/** 水平坐标参考系标识，支持 EPSG 以及自定义字符串。 */
export type HorizontalCrs =
  "EPSG:4326" | "EPSG:4979" | "EPSG:3857" | (string & {})

/** 水平空间参考。 */
export interface SpatialReference {
  /** 坐标参考系标识。 */
  readonly crs: HorizontalCrs
  /** 坐标轴顺序。 */
  readonly axisOrder?: AxisOrder
  /** 角度单位。 */
  readonly angularUnit?: AngularUnit
  /** 长度单位。 */
  readonly linearUnit?: LinearUnit
}

/** 高程基准。 */
export type VerticalDatum = "ellipsoid" | "orthometric" | "terrain" | "design"

/** 垂直参考。 */
export interface VerticalReference {
  /** 高程基准。 */
  readonly datum: VerticalDatum
  /** 大地水准面模型名称。 */
  readonly geoidModel?: string
  /** 长度单位。 */
  readonly linearUnit?: LinearUnit
}

/** 时间范围，使用 ISO 8601 时刻。 */
export interface TimeRange {
  /** 起始时刻。 */
  readonly start: string
  /** 结束时刻。 */
  readonly end: string
}

/** 坐标转换合同。 */
export interface CoordinateTransform {
  /** 源空间参考。 */
  readonly source: SpatialReference
  /** 目标空间参考。 */
  readonly target: SpatialReference
  /**
   * 正向转换。
   *
   * @param position - 源坐标。
   */
  forward(position: LngLatHeight): LngLatHeight
  /**
   * 逆向转换。
   *
   * @param position - 目标坐标。
   */
  inverse(position: LngLatHeight): LngLatHeight
}

/** WGS84 水平参考（EPSG:4326）。 */
export const WGS84: SpatialReference = {
  crs: "EPSG:4326",
  axisOrder: "lng-lat",
  angularUnit: "degrees",
  linearUnit: "meters",
}

/** WGS84 三维参考（EPSG:4979）。 */
export const WGS84_3D: SpatialReference = {
  crs: "EPSG:4979",
  axisOrder: "lng-lat",
  angularUnit: "degrees",
  linearUnit: "meters",
}

/** Web Mercator 水平参考（EPSG:3857）。 */
export const WEB_MERCATOR: SpatialReference = {
  crs: "EPSG:3857",
  axisOrder: "lng-lat",
  angularUnit: "degrees",
  linearUnit: "meters",
}

/** 椭球高程垂直参考。 */
export const ELLIPSOID_VERTICAL: VerticalReference = {
  datum: "ellipsoid",
  linearUnit: "meters",
}

const GEOGRAPHIC_CRS = new Set(["EPSG:4326", "EPSG:4979", "CRS:84"])

/**
 * 补全水平空间参考，缺省为 {@link WGS84}。
 *
 * @param input - 部分空间参考。
 */
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

/**
 * 补全垂直参考，缺省为 {@link ELLIPSOID_VERTICAL}。
 *
 * @param input - 部分垂直参考。
 */
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

/**
 * 判断空间参考是否为地理坐标系。
 *
 * @param reference - 空间参考。
 */
export function isGeographic(reference: SpatialReference): boolean {
  return GEOGRAPHIC_CRS.has(reference.crs)
}

/**
 * 判断两个空间参考是否等价（比较 CRS、轴序与角度单位）。
 *
 * @param a - 空间参考 A。
 * @param b - 空间参考 B。
 */
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
 * 断言位置使用地理坐标系；投影坐标必须在分析或渲染前显式转换。
 *
 * @param reference - 空间参考。
 * @param action - 触发断言的操作名，用于错误信息。
 * @throws {Arc3DError} 当空间参考为投影坐标系时抛出 `UNSUPPORTED_CAPABILITY`。
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

/**
 * 创建单位（恒等）坐标转换。
 *
 * @param reference - 空间参考，缺省为 {@link WGS84}。
 */
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
 * 当源与目标一致时返回恒等转换；需要真实重投影时返回 `undefined`。
 *
 * 调用方必须显式处理 `undefined`，而不要假定坐标兼容。
 *
 * @param source - 源空间参考。
 * @param target - 目标空间参考。
 */
export function tryCreateCoordinateTransform(
  source: SpatialReference,
  target: SpatialReference,
): CoordinateTransform | undefined {
  if (sameSpatialReference(source, target)) return identityTransform(source)
  return undefined
}

/**
 * 断言时间范围有效（ISO 8601 时刻且结束不早于开始）。
 *
 * @param range - 时间范围。
 * @param action - 触发断言的操作名，用于错误信息。
 * @throws {Arc3DError} 当时刻非法或结束早于开始时抛出 `INVALID_ARGUMENT`。
 */
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
 * 返回 {@link LngLat}/{@link LngLatHeight} 简写的默认语义说明。
 *
 * @returns 默认语义：WGS84（EPSG:4326）、度、经度-纬度轴序、椭球高（米）。
 */
export function describeDefaultShorthand(): string {
  return "LngLat/LngLatHeight default to WGS84 (EPSG:4326), degrees, longitude-latitude axis order, ellipsoidal height in meters"
}
