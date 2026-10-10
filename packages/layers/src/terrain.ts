import { Arc3DError, assertAlive, type Arc3DContext } from "@arc3dlab/core"
import {
  getCesiumViewer,
  readIonToken,
  withIonAccessToken,
} from "@arc3dlab/engine-cesium"
import {
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  NearFarScalar,
} from "cesium"
import type { TerrainSpec } from "./types"

export class TerrainManager {
  private _alpha = 1

  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use terrain")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  async set(spec: TerrainSpec): Promise<void> {
    const viewer = this.viewer()
    if (spec.type === "none") {
      viewer.terrainProvider = new EllipsoidTerrainProvider()
      return
    }
    if (spec.type === "url") {
      if (!spec.url)
        throw new Arc3DError("INVALID_ARGUMENT", "Terrain url is required")
      const provider = await CesiumTerrainProvider.fromUrl(spec.url)
      assertAlive(this.context.lifecycle, "set terrain")
      viewer.terrainProvider = provider
      return
    }
    if (spec.type === "ion") {
      if (spec.assetId === undefined) {
        throw new Arc3DError("INVALID_ARGUMENT", "Ion terrain requires assetId")
      }
      const token = readIonToken(this.context.config)
      if (!token) {
        throw new Arc3DError(
          "AUTH_FAILED",
          "Ion terrain requires a runtime ion token",
        )
      }
      const provider = await withIonAccessToken(token, () =>
        CesiumTerrainProvider.fromIonAssetId(spec.assetId as number),
      )
      assertAlive(this.context.lifecycle, "set terrain")
      viewer.terrainProvider = provider
      return
    }
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `Unsupported terrain type: ${String(spec.type)}`,
    )
  }

  get exaggeration(): number {
    return this.viewer().scene.verticalExaggeration
  }

  set exaggeration(value: number) {
    this.viewer().scene.verticalExaggeration = value
  }

  get alpha(): number {
    return this._alpha
  }

  set alpha(value: number) {
    this._alpha = value
    const distance =
      this.viewer().scene.globe.translucency.frontFaceAlphaByDistance
    distance.nearValue = value
    distance.farValue = value
  }

  set translucency(enabled: boolean) {
    const globe = this.viewer().scene.globe
    globe.translucency.frontFaceAlphaByDistance = new NearFarScalar(
      1.5e2,
      0.5,
      8.0e6,
      1.0,
    )
    globe.translucency.enabled = enabled
    this.alpha = this._alpha
  }

  get translucency(): boolean {
    return this.viewer().scene.globe.translucency.enabled
  }

  set enableUnderground(enabled: boolean) {
    this.viewer().scene.screenSpaceCameraController.enableCollisionDetection =
      !enabled
  }

  get enableUnderground(): boolean {
    return !this.viewer().scene.screenSpaceCameraController
      .enableCollisionDetection
  }
}
