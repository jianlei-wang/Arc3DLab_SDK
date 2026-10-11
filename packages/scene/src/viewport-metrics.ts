import {
  pointByHeadingDistance,
  type Extent,
  type LngLat,
} from "@arc3dlab/core"

/** 默认垂直视场角（弧度），约为 60 度。 */
export const DEFAULT_VERTICAL_FOV = Math.PI / 3

/**
 * 依据相机高度与垂直视场角估算地面分辨率。
 * @param cameraHeightMeters - 相机离地高度，单位为米。
 * @param viewportHeightPixels - 视口高度，单位为像素。
 * @param fovRadians - 垂直视场角，单位为弧度。
 * @returns 每像素对应的地面距离，单位为米。
 */
export function metersPerPixelAtHeight(
  cameraHeightMeters: number,
  viewportHeightPixels: number,
  fovRadians: number = DEFAULT_VERTICAL_FOV,
): number {
  if (!(cameraHeightMeters > 0) || !(viewportHeightPixels > 0)) return 0
  const groundHeight = 2 * cameraHeightMeters * Math.tan(fovRadians / 2)
  return groundHeight / viewportHeightPixels
}

/**
 * 依据中心点与东西、南北跨度计算地理范围。
 * @param center - 视域中心经纬度。
 * @param widthMeters - 东西向跨度，单位为米。
 * @param heightMeters - 南北向跨度，单位为米。
 * @returns 地理范围 `[west, south, east, north]`。
 */
export function extentFromCenter(
  center: LngLat,
  widthMeters: number,
  heightMeters: number,
): Extent {
  const halfWidth = Math.max(widthMeters, 0) / 2
  const halfHeight = Math.max(heightMeters, 0) / 2
  const west = pointByHeadingDistance(center, 270, halfWidth)
  const east = pointByHeadingDistance(center, 90, halfWidth)
  const south = pointByHeadingDistance(center, 180, halfHeight)
  const north = pointByHeadingDistance(center, 0, halfHeight)
  return [west.longitude, south.latitude, east.longitude, north.latitude]
}
