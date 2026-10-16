import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { ParticleManager } from "@arc3dlab/effects"
import { Matrix4 } from "cesium"

class FakeEvent {
  private listeners = new Set<() => void>()

  addEventListener(listener: () => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(listener: () => void): void {
    this.listeners.delete(listener)
  }

  get size(): number {
    return this.listeners.size
  }
}

function fakeRuntime() {
  const preUpdate = new FakeEvent()
  const removed: unknown[] = []
  const viewer = {
    clock: { shouldAnimate: false, currentTime: 0 },
    entities: {
      add: () => ({
        id: "particle-entity",
        computeModelMatrix: () => new Matrix4(),
      }),
      removeById: () => {},
    },
    scene: {
      primitives: {
        add: (value: unknown) => value,
        remove: (value: unknown) => removed.push(value),
      },
      preUpdate,
    },
  }
  const lifecycle = new LifecycleManager()
  lifecycle.transition("initializing")
  lifecycle.transition("ready")
  let demands = 0
  const engineViewer = {
    acquireContinuousRender: () => {
      demands += 1
      return () => {
        demands -= 1
      }
    },
  }
  const context = {
    lifecycle,
    engine: { native: { viewer }, viewer: engineViewer },
    logger: { error: () => {} },
  } as unknown as Arc3DContext
  return {
    context,
    viewer,
    preUpdate,
    removed,
    demandCount: () => demands,
  }
}

describe("ParticleManager", () => {
  it("creates, toggles and destroys a fire particle", () => {
    const { context, preUpdate, removed, demandCount } = fakeRuntime()
    const particles = new ParticleManager(context)
    const handle = particles.fire(
      { longitude: 116.39, latitude: 39.9, height: 10 },
      { image: "data:image/png;base64,AAAA" },
    )
    expect(preUpdate.size).toBe(1)
    expect(demandCount()).toBe(1)
    expect(handle.visible).toBe(true)
    handle.setVisible(false)
    expect(handle.visible).toBe(false)
    handle.destroy()
    handle.destroy()
    expect(removed).toHaveLength(1)
    expect(preUpdate.size).toBe(0)
    expect(demandCount()).toBe(0)
  })

  it("creates an explosion particle", () => {
    const { context } = fakeRuntime()
    const particles = new ParticleManager(context)
    const handle = particles.explosion(
      { longitude: 116.4, latitude: 39.9 },
      { image: "data:image/png;base64,AAAA" },
    )
    expect(handle.visible).toBe(true)
    handle.destroy()
  })

  it("creates a water gun particle aimed at a target", () => {
    const { context } = fakeRuntime()
    const particles = new ParticleManager(context)
    const handle = particles.waterGun(
      { longitude: 116.39, latitude: 39.9, height: 5 },
      { longitude: 116.4, latitude: 39.9, height: 5 },
      { image: "data:image/png;base64,AAAA" },
    )
    expect(handle.visible).toBe(true)
    handle.destroy()
  })

  it("tracks every handle and releases them all on destroy", () => {
    const { context, removed, preUpdate, demandCount } = fakeRuntime()
    const particles = new ParticleManager(context)
    const image = { image: "data:image/png;base64,AAAA" }
    particles.fire({ longitude: 116.39, latitude: 39.9 }, image)
    particles.explosion({ longitude: 116.4, latitude: 39.9 }, image)
    expect(particles.size).toBe(2)
    particles.destroy()
    expect(particles.size).toBe(0)
    expect(removed).toHaveLength(2)
    expect(preUpdate.size).toBe(0)
    expect(demandCount()).toBe(0)
  })

  it("does not double-release a handle already destroyed", () => {
    const { context, removed } = fakeRuntime()
    const particles = new ParticleManager(context)
    const handle = particles.explosion(
      { longitude: 116.4, latitude: 39.9 },
      { image: "data:image/png;base64,AAAA" },
    )
    handle.destroy()
    particles.destroy()
    expect(removed).toHaveLength(1)
  })

  it("overrides and restores clock.shouldAnimate by reference count", () => {
    const { context, viewer } = fakeRuntime()
    const particles = new ParticleManager(context)
    const image = { image: "data:image/png;base64,AAAA" }
    expect(viewer.clock.shouldAnimate).toBe(false)
    const first = particles.fire({ longitude: 116.39, latitude: 39.9 }, image)
    expect(viewer.clock.shouldAnimate).toBe(true)
    particles.explosion({ longitude: 116.4, latitude: 39.9 }, image)
    expect(viewer.clock.shouldAnimate).toBe(true)
    first.destroy()
    expect(viewer.clock.shouldAnimate).toBe(true)
    particles.destroy()
    expect(viewer.clock.shouldAnimate).toBe(false)
  })
})
