import { describe, expect, it } from "vitest"
import { Arc3DError } from "@arc3dlab/core"
import {
  PARTICLE_PRESETS,
  resolveParticlePreset,
  resolveParticleTexture,
} from "@arc3dlab/effects"

describe("particle presets", () => {
  it("returns the fire preset by default", () => {
    expect(resolveParticlePreset("fire")).toEqual(PARTICLE_PRESETS.fire)
  })

  it("overrides preset fields", () => {
    const preset = resolveParticlePreset("explosion", {
      emissionRate: 50,
      particleSize: 40,
      loop: true,
    })
    expect(preset.emissionRate).toBe(50)
    expect(preset.particleSize).toBe(40)
    expect(preset.loop).toBe(true)
    expect(preset.startColor).toBe(PARTICLE_PRESETS.explosion.startColor)
  })

  it("exposes a distinct preset per kind", () => {
    expect(PARTICLE_PRESETS.fire.emitter).toBe("cone")
    expect(PARTICLE_PRESETS.water.emitter).toBe("circle")
    expect(PARTICLE_PRESETS.explosion.loop).toBe(false)
  })
})

describe("resolveParticleTexture", () => {
  it("returns the explicit image when provided", () => {
    expect(resolveParticleTexture("data:image/png;base64,AAAA", "fire")).toBe(
      "data:image/png;base64,AAAA",
    )
  })

  it("throws without an image in a non-DOM environment", () => {
    expect(typeof document).toBe("undefined")
    expect(() => resolveParticleTexture(undefined, "water")).toThrow(Arc3DError)
  })
})
