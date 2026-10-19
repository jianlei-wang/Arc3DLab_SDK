import {
  Arc3DError,
  assertFiniteNumber,
  assertValidLngLat,
} from "@arc3dlab/core"
import type { RectQuery } from "./geometry"

/**
 * 断言数值为有限正数。
 * @param value - 待校验数值。
 * @param name - 参数名称，用于错误提示。
 * @throws {Arc3DError} 数值非有限或不大于 0 时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertPositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `${name} must be a finite positive number: ${value}`,
    )
  }
}

/**
 * 断言数值为有限非负数。
 * @param value - 待校验数值。
 * @param name - 参数名称，用于错误提示。
 * @throws {Arc3DError} 数值非有限或小于 0 时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertNonNegativeNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `${name} must be a finite non-negative number: ${value}`,
    )
  }
}

/**
 * 校验矩形查询边界。
 * @param rect - 矩形范围。
 * @throws {Arc3DError} 边界非有限、经纬度越界或南边界大于北边界时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertRectQuery(rect: RectQuery): void {
  assertValidLngLat(rect.west, rect.south)
  assertValidLngLat(rect.east, rect.north)
  if (rect.south > rect.north) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `rectangle south cannot exceed north: ${rect.south} > ${rect.north}`,
    )
  }
}

/**
 * 校验距离阈值。
 * @param meters - 距离阈值，单位为米。
 * @throws {Arc3DError} 阈值非有限或为负数时抛出，错误码为 `INVALID_ARGUMENT`。
 */
export function assertDistanceThreshold(meters: number): void {
  assertFiniteNumber(meters, "meters")
  if (meters < 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `meters cannot be negative: ${meters}`,
    )
  }
}
