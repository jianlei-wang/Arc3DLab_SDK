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

/**
 * 地形管理器，用于设置地形数据源并控制夸张、透明度与地下穿行等效果。
 */
export class TerrainManager {
  private _alpha = 1

  /**
   * 创建地形管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use terrain")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  /**
   * 设置地形数据源。
   * @param spec - 地形数据源配置。
   * @returns 地形设置完成后兑现的 Promise。
   */
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

  /**
   * 地形的垂直夸张系数。
   */
  get exaggeration(): number {
    return this.viewer().scene.verticalExaggeration
  }

  set exaggeration(value: number) {
    this.viewer().scene.verticalExaggeration = value
  }

  /**
   * 地形表面透明度，取值 0 到 1。
   */
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

  /**
   * 是否启用地形半透明效果。
   */
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

  /**
   * 是否允许相机进入地表以下。
   */
  set enableUnderground(enabled: boolean) {
    this.viewer().scene.screenSpaceCameraController.enableCollisionDetection =
      !enabled
  }

  get enableUnderground(): boolean {
    return !this.viewer().scene.screenSpaceCameraController
      .enableCollisionDetection
  }
}
