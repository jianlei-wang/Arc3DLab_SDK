import { Arc3DError } from "./errors"
import type { GraphicStyle, PositionInput } from "./types"

/**
 * 断言给定数值为有限数。
 *
 * @param value - 待校验的数值。
 * @param name - 参数名称，用于错误信息。
 * @throws {Arc3DError} 当数值非有限时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Arc3DError("INVALID_ARGUMENT", `${name} must be a finite number`)
  }
}

/**
 * 校验经纬度与高度是否合法。
 *
 * @param longitude - 经度，取值范围为 -180 到 180。
 * @param latitude - 纬度，取值范围为 -90 到 90。
 * @param height - 高度，默认为 0。
 * @throws {Arc3DError} 当数值非有限或经纬度越界时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertValidLngLat(
  longitude: number,
  latitude: number,
  height = 0,
): void {
  assertFiniteNumber(longitude, "longitude")
  assertFiniteNumber(latitude, "latitude")
  assertFiniteNumber(height, "height")
  if (longitude < -180 || longitude > 180) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `longitude out of range: ${longitude}`,
    )
  }
  if (latitude < -90 || latitude > 90) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `latitude out of range: ${latitude}`,
    )
  }
}

/**
 * 将位置输入归一化为经纬度与高度对象。
 *
 * @param input - 位置输入，可为数组或对象形式。
 * @returns 包含 `longitude`、`latitude`、`height` 的归一化结果。
 * @throws {Arc3DError} 当位置格式非法或坐标越界时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function parsePosition(input: PositionInput): {
  longitude: number
  latitude: number
  height: number
} {
  if (Array.isArray(input)) {
    if (input.length < 2) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        "position requires longitude and latitude",
      )
    }
    const longitude = input[0]
    const latitude = input[1]
    const height = input[2] ?? 0
    assertValidLngLat(longitude, latitude, height)
    return { longitude, latitude, height }
  }
  const height = "height" in input ? input.height : 0
  assertValidLngLat(input.longitude, input.latitude, height)
  return { longitude: input.longitude, latitude: input.latitude, height }
}

/**
 * 校验位置数组非空、数量达标且每个位置合法。
 *
 * @param positions - 待校验的位置数组。
 * @param min - 所需的最少位置数量。
 * @param kind - 几何类型名称，用于错误信息。
 * @throws {Arc3DError} 当数组为空、数量不足或位置非法时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertPositions(
  positions: PositionInput[],
  min: number,
  kind: string,
): void {
  if (!positions.length) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `${kind} positions cannot be empty`,
    )
  }
  if (positions.length < min) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `${kind} requires at least ${min} positions`,
    )
  }
  for (const item of positions) parsePosition(item)
}

/**
 * 校验 CSS 颜色字符串是否合法。
 *
 * @param value - 待校验的颜色值，undefined 时跳过校验。
 * @param name - 参数名称，用于错误信息。
 * @throws {Arc3DError} 当颜色不是非空字符串时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertCssColor(value: string | undefined, name: string): void {
  if (value === undefined) return
  if (typeof value !== "string" || value.trim() === "") {
    throw new Arc3DError("INVALID_ARGUMENT", `${name} is not a valid color`)
  }
}

/**
 * 校验数值为非负有限数。
 *
 * @param value - 待校验的数值，undefined 时跳过校验。
 * @param name - 参数名称，用于错误信息。
 * @throws {Arc3DError} 当数值非有限或为负数时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertNonNegative(
  value: number | undefined,
  name: string,
): void {
  if (value === undefined) return
  assertFiniteNumber(value, name)
  if (value < 0) {
    throw new Arc3DError("INVALID_ARGUMENT", `${name} cannot be negative`)
  }
}

/**
 * 校验图形样式中的颜色与非负数值字段。
 *
 * @param style - 待校验的图形样式，undefined 时跳过校验。
 * @throws {Arc3DError} 当任一样式字段非法时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertGraphicStyle(style: GraphicStyle | undefined): void {
  if (!style) return
  assertCssColor(style.fill, "fill")
  assertCssColor(style.outlineColor, "outlineColor")
  assertCssColor(style.color, "color")
  assertNonNegative(style.outlineWidth, "outlineWidth")
  assertNonNegative(style.pixelSize, "pixelSize")
  assertNonNegative(style.width, "width")
}

/**
 * 断言资源标识尚未被注册。
 *
 * @param registry - 提供 `has` 查询的资源注册表。
 * @param id - 待校验的资源标识。
 * @throws {Arc3DError} 当标识已存在时抛出，错误码为 `DUPLICATE_RESOURCE`。
 */
export function assertNewResourceId(
  registry: { has(id: string): boolean },
  id: string,
): void {
  if (registry.has(id)) {
    throw new Arc3DError("DUPLICATE_RESOURCE", `Resource already exists: ${id}`)
  }
}
