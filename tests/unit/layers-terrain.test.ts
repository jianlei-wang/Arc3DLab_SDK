import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { TerrainManager } from "../../packages/layers/src/index"

function terrain(token?: string) {
  const lifecycle = new LifecycleManager()
  const context = {
    lifecycle,
    config: {
      container: "map",
      tokens: token ? { cesiumIon: token } : {},
    },
    engine: {
      native: {
        viewer: {
          terrainProvider: {},
          scene: {
            verticalExaggeration: 1,
            globe: {
              translucency: {
                enabled: false,
                frontFaceAlphaByDistance: { nearValue: 1, farValue: 1 },
              },
            },
            screenSpaceCameraController: { enableCollisionDetection: true },
          },
        },
      },
    },
  } as Arc3DContext
  return new TerrainManager(context)
}

describe("TerrainManager ion contract", () => {
  it("requires assetId for ion terrain", async () => {
    await expect(terrain("token").set({ type: "ion" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    })
  })

  it("requires a runtime token for ion terrain", async () => {
    await expect(
      terrain().set({ type: "ion", assetId: 1 }),
    ).rejects.toMatchObject({
      code: "AUTH_FAILED",
    })
  })
})
