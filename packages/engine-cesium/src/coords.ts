import type { CameraPose, LngLatHeight, PositionInput } from "@arc3dlab/core"
import { Cartesian3, Cartographic, Math as CesiumMath } from "cesium"

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

export function toCartesian3Array(inputs: PositionInput[]): Cartesian3[] {
  return inputs.map(toCartesian3)
}

export function fromCartesian3(position: Cartesian3): LngLatHeight {
  const carto = Cartographic.fromCartesian(position)
  return {
    longitude: CesiumMath.toDegrees(carto.longitude),
    latitude: CesiumMath.toDegrees(carto.latitude),
    height: carto.height,
  }
}

export function toRadians(value: number, unit: CameraPose["unit"]): number {
  return unit === "radians" ? value : CesiumMath.toRadians(value)
}

export function toDegrees(value: number, unit: CameraPose["unit"]): number {
  return unit === "degrees" ? value : CesiumMath.toDegrees(value)
}
