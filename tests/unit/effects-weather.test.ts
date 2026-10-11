import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import {
  FOG_DEFAULTS,
  RAIN_DEFAULTS,
  SNOW_DEFAULTS,
  WeatherEffects,
  resolveFogOptions,
  resolveRainOptions,
  resolveSnowOptions,
} from "@arc3dlab/effects"

function weather(): { effects: WeatherEffects; stages: unknown[] } {
  const stages: unknown[] = []
  const postProcessStages = {
    add(stage: unknown) {
      stages.push(stage)
      return stage
    },
    remove(stage: unknown) {
      const index = stages.indexOf(stage)
      if (index >= 0) stages.splice(index, 1)
    },
  }
  const context = {
    lifecycle: new LifecycleManager(),
    engine: { native: { viewer: { scene: { postProcessStages } } } },
  } as Arc3DContext
  return { effects: new WeatherEffects(context), stages }
}

describe("weather option resolution", () => {
  it("merges rain options over defaults", () => {
    expect(resolveRainOptions()).toEqual(RAIN_DEFAULTS)
    expect(resolveRainOptions({ rainSpeed: 200 }).rainSpeed).toBe(200)
  })

  it("merges snow options over defaults", () => {
    expect(resolveSnowOptions()).toEqual(SNOW_DEFAULTS)
    expect(resolveSnowOptions({ snowSize: 0.01 }).snowSize).toBe(0.01)
  })

  it("merges fog options over defaults", () => {
    expect(resolveFogOptions()).toEqual(FOG_DEFAULTS)
    expect(resolveFogOptions({ far: 2000 }).far).toBe(2000)
  })
})

describe("WeatherEffects", () => {
  it("enables a weather stage", () => {
    const { effects, stages } = weather()
    effects.enable("rain")
    expect(effects.isEnabled("rain")).toBe(true)
    expect(effects.list()).toEqual(["rain"])
    expect(stages).toHaveLength(1)
  })

  it("is idempotent when enabling twice", () => {
    const { effects, stages } = weather()
    effects.enable("snow")
    effects.enable("snow")
    expect(stages).toHaveLength(1)
  })

  it("configures an enabled stage in place", () => {
    const { effects } = weather()
    effects.enable("rain", { rainSpeed: 150 })
    effects.configure("rain", { rainSpeed: 300 })
    expect(effects.isEnabled("rain")).toBe(true)
  })

  it("supports fog and lightning stages", () => {
    const { effects, stages } = weather()
    effects.enable("fog", { far: 2000 })
    effects.enable("lightning")
    expect(effects.list().sort()).toEqual(["fog", "lightning"])
    expect(stages).toHaveLength(2)
  })

  it("clears all stages", () => {
    const { effects, stages } = weather()
    effects.enable("rain")
    effects.enable("snow")
    effects.clear()
    expect(effects.list()).toEqual([])
    expect(stages).toHaveLength(0)
  })
})
