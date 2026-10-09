import { Arc3DError } from "./errors"
import type { GraphicStyle, PositionInput } from "./types"

export function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Arc3DError("INVALID_ARGUMENT", `${name} must be a finite number`)
  }
}

export function assertValidLngLat(longitude: number, latitude: number, height = 0): void {
  assertFiniteNumber(longitude, "longitude")
  assertFiniteNumber(latitude, "latitude")
  assertFiniteNumber(height, "height")
  if (longitude < -180 || longitude > 180) {
    throw new Arc3DError("INVALID_ARGUMENT", `longitude out of range: ${longitude}`)
  }
  if (latitude < -90 || latitude > 90) {
    throw new Arc3DError("INVALID_ARGUMENT", `latitude out of range: ${latitude}`)
  }
}

export function parsePosition(input: PositionInput): { longitude: number; latitude: number; height: number } {
  if (Array.isArray(input)) {
    if (input.length < 2) {
      throw new Arc3DError("INVALID_ARGUMENT", "position requires longitude and latitude")
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

export function assertPositions(positions: PositionInput[], min: number, kind: string): void {
  if (!positions.length) {
    throw new Arc3DError("INVALID_ARGUMENT", `${kind} positions cannot be empty`)
  }
  if (positions.length < min) {
    throw new Arc3DError("INVALID_ARGUMENT", `${kind} requires at least ${min} positions`)
  }
  for (const item of positions) parsePosition(item)
}

export function assertCssColor(value: string | undefined, name: string): void {
  if (value === undefined) return
  if (typeof value !== "string" || value.trim() === "") {
    throw new Arc3DError("INVALID_ARGUMENT", `${name} is not a valid color`)
  }
}

export function assertNonNegative(value: number | undefined, name: string): void {
  if (value === undefined) return
  assertFiniteNumber(value, name)
  if (value < 0) {
    throw new Arc3DError("INVALID_ARGUMENT", `${name} cannot be negative`)
  }
}

export function assertGraphicStyle(style: GraphicStyle | undefined): void {
  if (!style) return
  assertCssColor(style.fill, "fill")
  assertCssColor(style.outlineColor, "outlineColor")
  assertCssColor(style.color, "color")
  assertNonNegative(style.outlineWidth, "outlineWidth")
  assertNonNegative(style.pixelSize, "pixelSize")
  assertNonNegative(style.width, "width")
}

export function assertNewResourceId(registry: { has(id: string): boolean }, id: string): void {
  if (registry.has(id)) {
    throw new Arc3DError("DUPLICATE_RESOURCE", `Resource already exists: ${id}`)
  }
}
