import type { LngLat } from "./types"
import { assertFiniteNumber } from "./validate"

const PI = Math.PI
const GCJ_SEMI_MAJOR_AXIS = 6378245.0
const GCJ_ECCENTRICITY_SQUARED = 0.00669342162296594323
const BD_FACTOR = (PI * 3000.0) / 180.0

/**
 * 判断坐标是否位于中国境外。
 * @param longitude - 经度，单位为度。
 * @param latitude - 纬度，单位为度。
 * @returns 位于中国境外时返回 true。
 */
export function outOfChina(longitude: number, latitude: number): boolean {
  return (
    longitude < 72.004 ||
    longitude > 137.8347 ||
    latitude < 0.8293 ||
    latitude > 55.8271
  )
}

/**
 * 将 WGS84 坐标转换为 GCJ-02 坐标，境外坐标原样返回。
 * @param longitude - WGS84 经度，单位为度。
 * @param latitude - WGS84 纬度，单位为度。
 * @returns GCJ-02 经纬度坐标。
 */
export function wgs84ToGcj02(longitude: number, latitude: number): LngLat {
  assertFiniteNumber(longitude, "longitude")
  assertFiniteNumber(latitude, "latitude")
  if (outOfChina(longitude, latitude)) {
    return { longitude, latitude }
  }
  let dLat = transformLatitude(longitude - 105.0, latitude - 35.0)
  let dLng = transformLongitude(longitude - 105.0, latitude - 35.0)
  const radLat = (latitude / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - GCJ_ECCENTRICITY_SQUARED * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat =
    (dLat * 180.0) /
    (((GCJ_SEMI_MAJOR_AXIS * (1 - GCJ_ECCENTRICITY_SQUARED)) /
      (magic * sqrtMagic)) *
      PI)
  dLng =
    (dLng * 180.0) / ((GCJ_SEMI_MAJOR_AXIS / sqrtMagic) * Math.cos(radLat) * PI)
  return { longitude: longitude + dLng, latitude: latitude + dLat }
}

/**
 * 将 GCJ-02 坐标转换为 WGS84 坐标，境外坐标原样返回。
 * @param longitude - GCJ-02 经度，单位为度。
 * @param latitude - GCJ-02 纬度，单位为度。
 * @returns WGS84 经纬度坐标。
 */
export function gcj02ToWgs84(longitude: number, latitude: number): LngLat {
  assertFiniteNumber(longitude, "longitude")
  assertFiniteNumber(latitude, "latitude")
  if (outOfChina(longitude, latitude)) {
    return { longitude, latitude }
  }
  const shifted = wgs84ToGcj02(longitude, latitude)
  return {
    longitude: longitude - (shifted.longitude - longitude),
    latitude: latitude - (shifted.latitude - latitude),
  }
}

/**
 * 将 GCJ-02 坐标转换为 BD-09 坐标。
 * @param longitude - GCJ-02 经度，单位为度。
 * @param latitude - GCJ-02 纬度，单位为度。
 * @returns BD-09 经纬度坐标。
 */
export function gcj02ToBd09(longitude: number, latitude: number): LngLat {
  assertFiniteNumber(longitude, "longitude")
  assertFiniteNumber(latitude, "latitude")
  const z =
    Math.sqrt(longitude * longitude + latitude * latitude) +
    0.00002 * Math.sin(latitude * BD_FACTOR)
  const theta =
    Math.atan2(latitude, longitude) + 0.000003 * Math.cos(longitude * BD_FACTOR)
  return {
    longitude: z * Math.cos(theta) + 0.0065,
    latitude: z * Math.sin(theta) + 0.006,
  }
}

/**
 * 将 BD-09 坐标转换为 GCJ-02 坐标。
 * @param longitude - BD-09 经度，单位为度。
 * @param latitude - BD-09 纬度，单位为度。
 * @returns GCJ-02 经纬度坐标。
 */
export function bd09ToGcj02(longitude: number, latitude: number): LngLat {
  assertFiniteNumber(longitude, "longitude")
  assertFiniteNumber(latitude, "latitude")
  const x = longitude - 0.0065
  const y = latitude - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * BD_FACTOR)
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * BD_FACTOR)
  return {
    longitude: z * Math.cos(theta),
    latitude: z * Math.sin(theta),
  }
}

/**
 * 将 WGS84 坐标转换为 BD-09 坐标。
 * @param longitude - WGS84 经度，单位为度。
 * @param latitude - WGS84 纬度，单位为度。
 * @returns BD-09 经纬度坐标。
 */
export function wgs84ToBd09(longitude: number, latitude: number): LngLat {
  const gcj = wgs84ToGcj02(longitude, latitude)
  return gcj02ToBd09(gcj.longitude, gcj.latitude)
}

/**
 * 将 BD-09 坐标转换为 WGS84 坐标。
 * @param longitude - BD-09 经度，单位为度。
 * @param latitude - BD-09 纬度，单位为度。
 * @returns WGS84 经纬度坐标。
 */
export function bd09ToWgs84(longitude: number, latitude: number): LngLat {
  const gcj = bd09ToGcj02(longitude, latitude)
  return gcj02ToWgs84(gcj.longitude, gcj.latitude)
}

function transformLatitude(x: number, y: number): number {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x))
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0
  ret +=
    ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) *
      2.0) /
    3.0
  return ret
}

function transformLongitude(x: number, y: number): number {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x))
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0
  ret +=
    ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) *
      2.0) /
    3.0
  return ret
}
