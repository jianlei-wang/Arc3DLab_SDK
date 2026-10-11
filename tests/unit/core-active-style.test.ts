import { describe, expect, it } from "vitest"
import {
  ActiveStyle,
  activeFrameValue,
  activePropertyKey,
  triangularWave,
  type ActiveStyleWriter,
} from "@arc3dlab/core"

function makeWriter(initial: Record<string, number> = {}): ActiveStyleWriter & {
  store: Record<string, number>
} {
  const store: Record<string, number> = { ...initial }
  return {
    store,
    read: (key) => store[key],
    write: (key, value) => {
      store[key] = value
    },
  }
}

describe("activePropertyKey", () => {
  it("maps blink to alpha on the matching channel", () => {
    expect(activePropertyKey("billboard", "blink")).toBe("colorAlpha")
    expect(activePropertyKey("point", "blink")).toBe("colorAlpha")
    expect(activePropertyKey("polyline", "blink")).toBe("materialAlpha")
    expect(activePropertyKey("polygon", "blink")).toBe("materialAlpha")
  })

  it("maps scaling and jump to their target keys", () => {
    expect(activePropertyKey("polyline", "scaling")).toBe("width")
    expect(activePropertyKey("billboard", "scaling")).toBe("scale")
    expect(activePropertyKey("point", "jump")).toBe("pixelOffsetY")
  })
})

describe("triangularWave", () => {
  it("stays within the configured bounds", () => {
    for (let tick = 0; tick < 200; tick++) {
      const value = triangularWave(tick, -10, 0, 0.2)
      expect(value).toBeGreaterThanOrEqual(-10)
      expect(value).toBeLessThanOrEqual(0)
    }
  })

  it("is periodic", () => {
    const span = 1 - 0.3
    const period = Math.round((span * 2) / 0.02)
    expect(triangularWave(5, 0.3, 1, 0.02)).toBeCloseTo(
      triangularWave(5 + period, 0.3, 1, 0.02),
      6,
    )
  })

  it("returns the lower bound for degenerate ranges", () => {
    expect(triangularWave(10, 5, 5, 0.1)).toBe(5)
    expect(triangularWave(10, 0, 1, 0)).toBe(0)
  })
})

describe("activeFrameValue", () => {
  it("keeps blink values independent from the base", () => {
    const frame = activeFrameValue(
      { type: "blink", geometry: "billboard" },
      0,
      0.42,
    )
    expect(frame.key).toBe("colorAlpha")
    expect(frame.value).toBeCloseTo(0.3, 6)
  })

  it("multiplies the base for scaling", () => {
    const frame = activeFrameValue(
      { type: "scaling", geometry: "polyline", min: 0.5, max: 1.5, step: 0.5 },
      0,
      4,
    )
    expect(frame.key).toBe("width")
    expect(frame.value).toBeCloseTo(2, 6)
  })

  it("offsets the base for jump", () => {
    const frame = activeFrameValue(
      { type: "jump", geometry: "billboard", min: -10, max: 0, step: 10 },
      0,
      3,
    )
    expect(frame.key).toBe("pixelOffsetY")
    expect(frame.value).toBeCloseTo(-7, 6)
  })

  it("applies the phase offset", () => {
    const a = activeFrameValue({ type: "blink", geometry: "point" }, 0)
    const b = activeFrameValue(
      { type: "blink", geometry: "point", phase: 5 },
      0,
    )
    expect(b.value).toBeCloseTo(
      activeFrameValue({ type: "blink", geometry: "point" }, 5).value,
      6,
    )
    expect(a.value).not.toBeCloseTo(b.value, 6)
  })
})

describe("ActiveStyle", () => {
  it("saves the base on first step and restores it on close", () => {
    const writer = makeWriter({ colorAlpha: 0.8 })
    const style = new ActiveStyle(writer, {
      type: "blink",
      geometry: "billboard",
    })
    expect(style.isActive).toBe(false)
    style.step(0)
    expect(style.isActive).toBe(true)
    expect(writer.store.colorAlpha).toBeCloseTo(0.3, 6)
    style.restore()
    expect(style.isActive).toBe(false)
    expect(writer.store.colorAlpha).toBe(0.8)
  })

  it("scales relative to the captured base", () => {
    const writer = makeWriter({ width: 10 })
    const style = new ActiveStyle(writer, {
      type: "scaling",
      geometry: "polyline",
      min: 0.5,
      max: 1.5,
      step: 0.5,
    })
    style.step(0)
    expect(writer.store.width).toBeCloseTo(5, 6)
    style.step(2)
    expect(writer.store.width).toBeCloseTo(15, 6)
    style.restore()
    expect(writer.store.width).toBe(10)
  })

  it("ignores restore when never applied", () => {
    const writer = makeWriter({ scale: 1 })
    const style = new ActiveStyle(writer, {
      type: "scaling",
      geometry: "billboard",
    })
    style.restore()
    expect(writer.store.scale).toBe(1)
    expect(style.isActive).toBe(false)
  })
})
