import { describe, expect, it } from "vitest"
import {
  applyPositionUpdates,
  createPositionPool,
  diffPositions,
} from "../../packages/graphics/src/pool"

describe("createPositionPool", () => {
  it("reuses released buffers", () => {
    const pool = createPositionPool(2)
    const first = pool.acquire(3)
    expect(first).toHaveLength(3)
    pool.release(first)
    expect(pool.available()).toBe(1)
    const second = pool.acquire(1)
    expect(second).toBe(first)
    expect(second).toHaveLength(1)
  })
})

describe("diffPositions", () => {
  it("patches a small number of changed points", () => {
    const previous = [
      { longitude: 104, latitude: 30.5, height: 0 },
      { longitude: 104.1, latitude: 30.5, height: 0 },
    ]
    const patch = diffPositions(previous, [
      [104, 30.5, 0],
      [104.2, 30.5, 10],
    ])
    expect(patch.mode).toBe("patch")
    expect(patch.changes).toEqual([
      { index: 1, position: { longitude: 104.2, latitude: 30.5, height: 10 } },
    ])
  })

  it("replaces when length changes or most points move", () => {
    expect(
      diffPositions(
        [{ longitude: 104, latitude: 30.5, height: 0 }],
        [
          [104, 30.5],
          [104.1, 30.6],
        ],
      ).mode,
    ).toBe("replace")
    expect(
      diffPositions(
        [
          { longitude: 104, latitude: 30.5, height: 0 },
          { longitude: 104.1, latitude: 30.5, height: 0 },
        ],
        [
          [104.2, 30.6],
          [104.3, 30.7],
        ],
      ).mode,
    ).toBe("replace")
  })
})

describe("applyPositionUpdates", () => {
  it("updates known graphics and skips missing ids", () => {
    const calls: Array<{ id: string; positions: unknown }> = []
    const updated = applyPositionUpdates(
      (id) => {
        if (id === "missing") return undefined
        return {
          setPositions(positions) {
            calls.push({ id, positions })
          },
        }
      },
      [
        { id: "a", positions: [104, 30.5] },
        { id: "missing", positions: [104.1, 30.6] },
      ],
    )
    expect(updated).toBe(1)
    expect(calls).toEqual([{ id: "a", positions: [104, 30.5] }])
  })
})
