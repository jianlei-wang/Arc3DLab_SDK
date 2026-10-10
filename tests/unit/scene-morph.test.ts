import { afterEach, describe, expect, it, vi } from "vitest"
import { scheduleSceneRestore } from "../../packages/scene/src/morph"

describe("scheduleSceneRestore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("restores after the fallback timeout", () => {
    vi.useFakeTimers()
    let restored = 0
    scheduleSceneRestore(() => {
      restored += 1
    })
    vi.advanceTimersByTime(1100)
    expect(restored).toBe(1)
  })

  it("cancels a pending timeout restore", () => {
    vi.useFakeTimers()
    let restored = 0
    const cancel = scheduleSceneRestore(() => {
      restored += 1
    })
    cancel()
    vi.advanceTimersByTime(2000)
    expect(restored).toBe(0)
  })

  it("uses morphComplete when available and can cancel it", () => {
    let restored = 0
    let removed = false
    let fire: () => void = () => undefined
    const cancel = scheduleSceneRestore(
      () => {
        restored += 1
      },
      {
        addEventListener(callback) {
          fire = callback
          return () => {
            removed = true
          }
        },
      },
    )
    cancel()
    fire()
    expect(restored).toBe(0)
    expect(removed).toBe(true)
  })
})
