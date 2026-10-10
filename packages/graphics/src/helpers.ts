import {
  Arc3DError,
  parsePosition,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import { Color } from "cesium"

/**
 * 将 CSS 颜色字符串解析为 Cesium 颜色对象。
 * @param value - 待解析的 CSS 颜色字符串。
 * @param fallback - value 为空时使用的回退颜色字符串。
 * @returns 解析得到的 Cesium 颜色对象。
 * @throws {Arc3DError} 当颜色字符串无法解析时抛出。
 */
export function parseColor(value: string | undefined, fallback: string): Color {
  const parsed = Color.fromCssColorString(value ?? fallback)
  if (!parsed) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `Invalid color: ${value ?? fallback}`,
    )
  }
  return parsed
}

/**
 * 将单个坐标或坐标数组统一规范为坐标数组。
 * @param positions - 单个坐标或坐标数组。
 * @returns 规范后的坐标数组。
 */
export function asList(
  positions: PositionInput | PositionInput[],
): PositionInput[] {
  if (
    Array.isArray(positions) &&
    positions.length > 0 &&
    (Array.isArray(positions[0]) ||
      typeof (positions[0] as PositionInput & { longitude?: number })
        .longitude === "number")
  ) {
    return positions as PositionInput[]
  }
  return [positions as PositionInput]
}

/**
 * 将坐标输入数组解析为经纬高对象数组。
 * @param inputs - 坐标输入数组。
 * @returns 解析后的经纬高对象数组。
 */
export function toLngLatHeights(inputs: PositionInput[]): LngLatHeight[] {
  return inputs.map((input) => parsePosition(input))
}
