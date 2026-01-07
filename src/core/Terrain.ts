import { NearFarScalar } from "cesium"
import { Viewer } from "./Viewer"
import { boolTerrain } from "../utils/TerrainUtil"

class Terrain {
  private _alpha: number
  /**
   * 地形主类
   * @param viewer
   */
  constructor(private viewer: Viewer) {
    this.viewer = viewer
    this._alpha = 1.0
    this._updateTranslucency(false)
  }
  /**
   * 地形对象，参考Cesium的TerrainProvider类
   * @readonly
   * @type {TerrainProvider}
   */
  get provider() {
    return this.viewer.terrainProvider
  }

  /**
   * 地形夸张系数
   * @type {Number}
   */
  get exaggeration() {
    return this.viewer.scene.verticalExaggeration
  }
  set exaggeration(scale) {
    this.viewer.scene.verticalExaggeration = scale
  }

  /**
   * 是否显示地形（借助于地形夸张调整）
   * @param {boolean} bool
   */
  set show(bool: boolean) {
    const terrain = boolTerrain(this.viewer)
    if (!terrain) return
    this.exaggeration = bool ? 1 : 0
  }

  /**
   * 地表透明度，只有在开启碰撞检测的时候才能生效
   * @type {Number}
   */
  get alpha() {
    return this._alpha
  }
  set alpha(val) {
    this._updateAlpha(val)
    this._alpha = val
  }

  /**
   * 地表碰撞检测
   * @type {Boolean}
   */
  get translucency() {
    return this.viewer.scene.globe.translucency.enabled
  }
  set translucency(bool) {
    this._updateTranslucency(bool)
  }

  /**
   * 是否允许进入地下
   * @type {Boolean}
   */
  get enableUnderground() {
    return !this.viewer.scene.screenSpaceCameraController
      .enableCollisionDetection
  }
  set enableUnderground(bool) {
    this.viewer.scene.screenSpaceCameraController.enableCollisionDetection =
      !bool
  }

  _updateAlpha(val: number) {
    const frontFaceAlphaByDistance =
      this.viewer.scene.globe.translucency.frontFaceAlphaByDistance
    frontFaceAlphaByDistance.nearValue = val
    frontFaceAlphaByDistance.farValue = val
  }

  _updateTranslucency(bool: boolean) {
    this.viewer.scene.globe.translucency.frontFaceAlphaByDistance =
      new NearFarScalar(1.5e2, 0.5, 8.0e6, 1.0)
    this.viewer.scene.globe.translucency.enabled = bool //是否开启透明
    this._updateAlpha(this._alpha)
  }
}

export default Terrain
