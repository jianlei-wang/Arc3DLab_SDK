import { describe, expect, it } from "vitest"
import * as Cesium from "cesium"
import {
  SerialIonTokenScope,
  withIonAccessToken,
} from "@arc3dlab/engine-cesium"

describe("SerialIonTokenScope", () => {
  it("serializes token sections and restores the global value", async () => {
    const scope = new SerialIonTokenScope()
    const original = Cesium.Ion.defaultAccessToken
    const events: string[] = []

    const taskA = scope.run("token-a", async () => {
      events.push(`a1:${Cesium.Ion.defaultAccessToken}`)
      await new Promise((resolve) => setTimeout(resolve, 5))
      events.push(`a2:${Cesium.Ion.defaultAccessToken}`)
    })
    const taskB = scope.run("token-b", async () => {
      events.push(`b1:${Cesium.Ion.defaultAccessToken}`)
      await new Promise((resolve) => setTimeout(resolve, 5))
      events.push(`b2:${Cesium.Ion.defaultAccessToken}`)
    })

    await Promise.all([taskA, taskB])

    expect(events).toEqual([
      "a1:token-a",
      "a2:token-a",
      "b1:token-b",
      "b2:token-b",
    ])
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })

  it("passes through when no token is provided", async () => {
    const scope = new SerialIonTokenScope()
    const original = Cesium.Ion.defaultAccessToken
    let observed: string | undefined
    await scope.run(undefined, async () => {
      observed = Cesium.Ion.defaultAccessToken
    })
    expect(observed).toBe(original)
  })

  it("restores the global value when work rejects", async () => {
    const scope = new SerialIonTokenScope()
    const original = Cesium.Ion.defaultAccessToken
    await expect(
      scope.run("token-c", async () => {
        throw new Error("boom")
      }),
    ).rejects.toThrow("boom")
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })
})

describe("withIonAccessToken", () => {
  it("uses the shared serial scope by default", async () => {
    const original = Cesium.Ion.defaultAccessToken
    const observed = await withIonAccessToken("shared-token", async () => {
      return Cesium.Ion.defaultAccessToken
    })
    expect(observed).toBe("shared-token")
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })
})
