import type { CameraPose, LngLatHeight, PositionInput } from "@arc3dlab/core"
import { Cartesian3, Cartographic, Math as CesiumMath } from "cesium"

/**
 * 将经纬度高度位置转换为 Cesium 笛卡尔坐标。
 * @param input - 位置输入，可为数组或带字段的对象。
 * @returns Cesium 笛卡尔坐标。
 */
export function toCartesian3(input: PositionInput): Cartesian3 {
  if (Array.isArray(input)) {
    return Cartesian3.fromDegrees(input[0], input[1], input[2] ?? 0)
  }
  return Cartesian3.fromDegrees(
    input.longitude,
    input.latitude,
    "height" in input ? input.height : 0,
  )
}

/**
 * 批量将经纬度高度位置转换为 Cesium 笛卡尔坐标。
 * @param inputs - 位置输入数组。
 * @returns Cesium 笛卡尔坐标数组。
 */
export function toCartesian3Array(inputs: PositionInput[]): Cartesian3[] {
  return inputs.map(toCartesian3)
}

/**
 * 将 Cesium 笛卡尔坐标转换为经纬度高度。
 * @param position - Cesium 笛卡尔坐标。
 * @returns 经纬度高度对象。
 */
export function fromCartesian3(position: Cartesian3): LngLatHeight {
  const carto = Cartographic.fromCartesian(position)
  return {
    longitude: CesiumMath.toDegrees(carto.longitude),
    latitude: CesiumMath.toDegrees(carto.latitude),
    height: carto.height,
  }
}

/**
 * 将角度值按指定单位转换为弧度。
 * @param value - 角度数值。
 * @param unit - 数值的原始单位。
 * @returns 弧度值。
 */
export function toRadians(value: number, unit: CameraPose["unit"]): number {
  return unit === "radians" ? value : CesiumMath.toRadians(value)
}

/**
 * 将角度值按指定单位转换为度。
 * @param value - 角度数值。
 * @param unit - 数值的原始单位。
 * @returns 度数值。
 */
export function toDegrees(value: number, unit: CameraPose["unit"]): number {
  return unit === "degrees" ? value : CesiumMath.toDegrees(value)
}
