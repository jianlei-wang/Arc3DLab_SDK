import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ion = vi.hoisted(() => ({
  created: 0,
  accessTokenAtCreate: undefined as string | undefined,
  lastAssetId: undefined as number | undefined,
}))

vi.mock("cesium", async (importOriginal) => {
  const actual = await importOriginal<typeof import("cesium")>()
  return {
    ...actual,
    IonImageryProvider: {
      fromAssetId: async (assetId: number) => {
        ion.created += 1
        ion.lastAssetId = assetId
        ion.accessTokenAtCreate = actual.Ion.defaultAccessToken
        return { kind: "ion", assetId }
      },
    },
  }
})

import * as Cesium from "cesium"
import { runWithIonToken, type Arc3DContext } from "@arc3dlab/core"
import { createImageryProvider } from "@arc3dlab/data"
import { createIonTokenRunner } from "@arc3dlab/engine-cesium"

const original = Cesium.Ion.defaultAccessToken

beforeEach(() => {
  ion.created = 0
  ion.accessTokenAtCreate = undefined
  ion.lastAssetId = undefined
})

afterEach(() => {
  Cesium.Ion.defaultAccessToken = original
})

describe("createIonTokenRunner", () => {
  it("applies the instance token during work and restores it", async () => {
    const run = createIonTokenRunner("instance-token")
    const observed = await run(async () => Cesium.Ion.defaultAccessToken)
    expect(observed).toBe("instance-token")
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })

  it("lets an override token win over the instance token", async () => {
    const run = createIonTokenRunner("instance-token")
    const observed = await run(
      async () => Cesium.Ion.defaultAccessToken,
      "override",
    )
    expect(observed).toBe("override")
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })

  it("passes through when no token is available", async () => {
    const run = createIonTokenRunner()
    const observed = await run(async () => Cesium.Ion.defaultAccessToken)
    expect(observed).toBe(original)
  })

  it("restores the global token when work rejects", async () => {
    const run = createIonTokenRunner("instance-token")
    await expect(
      run(async () => {
        throw new Error("boom")
      }),
    ).rejects.toThrow("boom")
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })
})

describe("createImageryProvider ion token path", () => {
  it("creates Ion imagery inside the provided token runner", async () => {
    const run = createIonTokenRunner("instance-token")
    const provider = await createImageryProvider(
      { type: "ion", assetId: 42 },
      { runWithIonToken: run },
    )
    expect(provider).toMatchObject({ kind: "ion", assetId: 42 })
    expect(ion.created).toBe(1)
    expect(ion.accessTokenAtCreate).toBe("instance-token")
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })

  it("passes spec.token as the override to the runner", async () => {
    const run = createIonTokenRunner("instance-token")
    await createImageryProvider(
      { type: "ion", assetId: 7, token: "spec-token" },
      { runWithIonToken: run },
    )
    expect(ion.accessTokenAtCreate).toBe("spec-token")
    expect(Cesium.Ion.defaultAccessToken).toBe(original)
  })

  it("creates without a runner when none is provided", async () => {
    await createImageryProvider({ type: "ion", assetId: 9 })
    expect(ion.created).toBe(1)
    expect(ion.accessTokenAtCreate).toBe(original)
  })

  it("still requires assetId", async () => {
    await expect(
      createImageryProvider(
        { type: "ion" },
        { runWithIonToken: createIonTokenRunner("t") },
      ),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
  })
})

describe("core runWithIonToken helper", () => {
  it("delegates to the engine runWithIonToken when present", async () => {
    const calls: Array<string | undefined> = []
    const context = {
      engine: {
        runWithIonToken: <T>(work: () => Promise<T>, token?: string) => {
          calls.push(token)
          return work()
        },
      },
    } as unknown as Pick<Arc3DContext, "engine">
    const result = await runWithIonToken(context, async () => "done", "t")
    expect(result).toBe("done")
    expect(calls).toEqual(["t"])
  })

  it("runs the work directly when the engine lacks the capability", async () => {
    const context = { engine: {} } as unknown as Pick<Arc3DContext, "engine">
    await expect(runWithIonToken(context, async () => 5)).resolves.toBe(5)
  })
})
