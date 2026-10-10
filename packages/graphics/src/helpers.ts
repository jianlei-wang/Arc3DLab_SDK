import {
  Arc3DError,
  parsePosition,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import { Color } from "cesium"

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

export function toLngLatHeights(inputs: PositionInput[]): LngLatHeight[] {
  return inputs.map((input) => parsePosition(input))
}
