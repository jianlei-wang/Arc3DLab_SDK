import type { LngLatHeight, PositionInput } from "@arc3dlab/core"
import { parsePosition } from "@arc3dlab/core"

export interface PositionPool {
  acquire(size: number): LngLatHeight[]
  release(buffer: LngLatHeight[]): void
  available(): number
}

export function createPositionPool(maxBuffers = 8): PositionPool {
  const free: LngLatHeight[][] = []
  return {
    acquire(size: number) {
      const buffer = free.pop() ?? []
      buffer.length = size
      return buffer
    },
    release(buffer: LngLatHeight[]) {
      buffer.length = 0
      if (free.length < maxBuffers) free.push(buffer)
    },
    available() {
      return free.length
    },
  }
}

export interface PositionPatch {
  mode: "replace" | "patch"
  changes: Array<{ index: number; position: LngLatHeight }>
}

function samePoint(left: LngLatHeight, right: LngLatHeight): boolean {
  return (
    left.longitude === right.longitude &&
    left.latitude === right.latitude &&
    left.height === right.height
  )
}

export function diffPositions(
  previous: LngLatHeight[],
  next: PositionInput[],
): PositionPatch {
  const parsed = next.map((item) => parsePosition(item))
  if (previous.length !== parsed.length) {
    return {
      mode: "replace",
      changes: parsed.map((position, index) => ({ index, position })),
    }
  }
  const changes: PositionPatch["changes"] = []
  for (let index = 0; index < parsed.length; index += 1) {
    if (!samePoint(previous[index], parsed[index])) {
      changes.push({ index, position: parsed[index] })
    }
  }
  if (changes.length > parsed.length / 2) {
    return { mode: "replace", changes }
  }
  return { mode: "patch", changes }
}

export function applyPositionUpdates(
  get: (
    id: string,
  ) =>
    | { setPositions: (positions: PositionInput | PositionInput[]) => void }
    | undefined,
  updates: Array<{ id: string; positions: PositionInput | PositionInput[] }>,
): number {
  let updated = 0
  for (const update of updates) {
    const graphic = get(update.id)
    if (!graphic) continue
    graphic.setPositions(update.positions)
    updated += 1
  }
  return updated
}
