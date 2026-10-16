import { describe, expect, it } from "vitest"
import {
  RenderModeCoordinator,
  type RenderModeScene,
} from "../../packages/engine-cesium/src/render-mode"

function makeScene(): { scene: RenderModeScene; renders: () => number } {
  let requestCount = 0
  const scene: RenderModeScene = {
    requestRenderMode: false,
    maximumRenderTimeChange: 0,
    requestRender(): void {
      requestCount += 1
    },
  }
  return { scene, renders: () => requestCount }
}

describe("RenderModeCoordinator", () => {
  it("enables on-demand rendering and suppresses time-driven renders by default", () => {
    const { scene, renders } = makeScene()
    new RenderModeCoordinator(scene)
    expect(scene.requestRenderMode).toBe(true)
    expect(scene.maximumRenderTimeChange).toBe(Infinity)
    expect(renders()).toBeGreaterThan(0)
  })

  it("forces continuous rendering while a demand is active", () => {
    const { scene } = makeScene()
    const coordinator = new RenderModeCoordinator(scene)
    const release = coordinator.acquire("weather:rain")
    expect(coordinator.requestRenderMode).toBe(false)
    expect(scene.requestRenderMode).toBe(false)
    expect(coordinator.activeDemandCount).toBe(1)
    release()
    expect(scene.requestRenderMode).toBe(true)
    expect(coordinator.activeDemandCount).toBe(0)
  })

  it("keeps rendering until every demand is released", () => {
    const { scene } = makeScene()
    const coordinator = new RenderModeCoordinator(scene)
    const releaseA = coordinator.acquire("a")
    const releaseB = coordinator.acquire("b")
    releaseA()
    expect(scene.requestRenderMode).toBe(false)
    releaseB()
    expect(scene.requestRenderMode).toBe(true)
  })

  it("ignores duplicate releases of the same demand", () => {
    const { scene } = makeScene()
    const coordinator = new RenderModeCoordinator(scene)
    const release = coordinator.acquire("a")
    release()
    release()
    expect(scene.requestRenderMode).toBe(true)
    expect(coordinator.activeDemandCount).toBe(0)
  })

  it("honours an explicit continuous baseline even without demands", () => {
    const { scene } = makeScene()
    const coordinator = new RenderModeCoordinator(scene)
    coordinator.setEnabled(false)
    expect(scene.requestRenderMode).toBe(false)
    const release = coordinator.acquire("a")
    release()
    expect(scene.requestRenderMode).toBe(false)
  })

  it("clears demands on dispose", () => {
    const { scene } = makeScene()
    const coordinator = new RenderModeCoordinator(scene)
    coordinator.acquire("a")
    coordinator.dispose()
    expect(coordinator.activeDemandCount).toBe(0)
    expect(scene.requestRenderMode).toBe(true)
  })
})
