import { describe, expect, it } from "vitest"
import type { SceneReadyResult } from "@arc3dlab/core"
import { SceneController } from "../../packages/scene/src/scene-controller"
import { createTestContext } from "../fixtures/fake-context"

describe("SceneController.whenSceneReady", () => {
  it("delegates to the engine viewer, forwards options and emits sceneReady", async () => {
    const { context, engine } = createTestContext()
    const scene = new SceneController(context)
    const expected: SceneReadyResult = {
      ready: true,
      remainingTiles: 0,
      timedOut: false,
      destroyed: false,
      defaultBaseLayer: "ready",
    }
    engine.viewer!.sceneReadyResult = expected
    const emitted: SceneReadyResult[] = []
    context.events.on("sceneReady", (result) => emitted.push(result))

    const result = await scene.whenSceneReady({ timeoutMs: 1234 })

    expect(result).toBe(expected)
    expect(engine.viewer!.readyCalls).toBe(1)
    expect(engine.viewer!.lastReadyOptions).toEqual({ timeoutMs: 1234 })
    expect(emitted).toEqual([expected])
  })

  it("resolves with a fallback readiness when the engine has no scene hook", async () => {
    const { context, engine } = createTestContext()
    const scene = new SceneController(context)
    ;(engine.viewer as unknown as { whenSceneReady?: unknown }).whenSceneReady =
      undefined

    const result = await scene.whenSceneReady()

    expect(result.ready).toBe(true)
    expect(result.destroyed).toBe(false)
    expect(result.defaultBaseLayer).toBe("disabled")
  })

  it.each<SceneReadyResult["defaultBaseLayer"]>([
    "disabled",
    "ready",
    "failed",
  ])("reports default base layer state %s", async (state) => {
    const { context, engine } = createTestContext()
    const scene = new SceneController(context)
    engine.viewer!.sceneReadyResult = {
      ready: state !== "failed",
      remainingTiles: 0,
      timedOut: false,
      destroyed: false,
      defaultBaseLayer: state,
    }

    const result = await scene.whenSceneReady()

    expect(result.defaultBaseLayer).toBe(state)
  })

  it("resolves as destroyed without calling the engine after shutdown", async () => {
    const { context } = createTestContext()
    const scene = new SceneController(context)
    context.lifecycle.transition("destroying")

    const result = await scene.whenSceneReady()

    expect(result).toEqual({
      ready: false,
      remainingTiles: 0,
      timedOut: false,
      destroyed: true,
      defaultBaseLayer: "disabled",
    })
    expect(context.engine.viewer.whenSceneReady).toBeDefined()
  })
})
