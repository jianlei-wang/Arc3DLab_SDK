import {
  ImageryLayer,
  SingleTileImageryProvider,
  ArcGisMapServerImageryProvider,
  WebMapTileServiceImageryProvider,
  createWorldTerrainAsync,
  Terrain,
  CesiumTerrainProvider,
} from "cesium"
import globeImg from "src/static/globe-img"
import { getTdtOption } from "src/utils/imagery/ImageryOption"

/**
 * 基础图层类，包括影像底图和地形底图
 */
const BaseLayer = {
  /**
   * 默认单图像底图
   * @readonly
   * @type {ImageryLayer}
   */
  get DefaultSingleImg() {
    return ImageryLayer.fromProviderAsync(
      SingleTileImageryProvider.fromUrl(globeImg),
      {}
    )
  },
  /**
   * 默认arcgis底图
   * @readonly
   * @type {ImageryLayer}
   */
  get DefaultArcgisImg() {
    return ImageryLayer.fromProviderAsync(
      ArcGisMapServerImageryProvider.fromUrl(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer"
      ),
      {}
    )
  },

  /**
   * 默认天地图影像地图
   * @readonly
   * @type {ImageryLayer}
   */
  get DefaultTdtImg() {
    const option = getTdtOption("img")
    return ImageryLayer.fromProviderAsync(
      Promise.resolve(new WebMapTileServiceImageryProvider(option)),
      {}
    )
  },

  /**
   * 默认天地图矢量地图
   * @readonly
   * @type {ImageryLayer}
   */
  get DefaultTdtVec() {
    const option = getTdtOption("vec")
    return ImageryLayer.fromProviderAsync(
      Promise.resolve(new WebMapTileServiceImageryProvider(option)),
      {}
    )
  },

  /**
   * 默认全球地形
   * @readonly
   * @type {Terrain}
   */
  get DefaultTerrain() {
    const terrainProvider = createWorldTerrainAsync({
      requestWaterMask: true,
      requestVertexNormals: true,
    })
    return new Terrain(terrainProvider)
  },

  /**
   * 获取tms格式地形
   * @param {String} url - 地形文件路径，如：http://localhost:80/terrain/
   * @returns {Terrain} - tms格式地形对象
   */
  getTerrain(url: string): Terrain {
    return new Terrain(CesiumTerrainProvider.fromUrl(url))
  },
}
export default BaseLayer
