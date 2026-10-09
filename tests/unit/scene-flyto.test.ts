import { describe, expect, it } from "vitest"
import { Arc3DError } from "@arc3dlab/core"
import { createFlyToPromise } from "../../packages/scene/src/fly-to"

describe("createFlyToPromise", () => {
  it("resolves when the camera animation completes", async () => {
    await expect(
      createFlyToPromise((callbacks) => {
        callbacks.complete?.()
      }, () => false)
    ).resolves.toBeUndefined()
  })

  it("resolves when the camera animation is cancelled", async () => {
    await expect(
      createFlyToPromise((callbacks) => {
        callbacks.cancel?.()
      }, () => false)
    ).resolves.toBeUndefined()
  })

  it("rejects when the app is destroyed before settle", async () => {
    await expect(
      createFlyToPromise((callbacks) => {
        callbacks.complete?.()
      }, () => true)
    ).rejects.toMatchObject({ code: "APP_DESTROYED" })
  })

  it("rejects when flyTo throws before animation starts", async () => {
    await expect(
      createFlyToPromise(() => {
        throw new Arc3DError("ENGINE_FAILURE", "camera flyTo failed")
      }, () => false)
    ).rejects.toMatchObject({ code: "ENGINE_FAILURE" })
  })
})
