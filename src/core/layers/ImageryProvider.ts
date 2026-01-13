import {
  ArcGisMapServerImageryProvider,
  BingMapsImageryProvider,
  OpenStreetMapImageryProvider,
  TileMapServiceImageryProvider,
  GoogleEarthEnterpriseImageryProvider,
  GoogleEarthEnterpriseMapsProvider,
  GridImageryProvider,
  IonImageryProvider,
  MapboxImageryProvider,
  MapboxStyleImageryProvider,
  SingleTileImageryProvider,
  TileCoordinatesImageryProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  ImageryProvider,
  GeographicTilingScheme,
} from "cesium"

export {
  ArcGisMapServerImageryProvider,
  BingMapsImageryProvider,
  OpenStreetMapImageryProvider,
  TileMapServiceImageryProvider,
  GoogleEarthEnterpriseImageryProvider,
  GoogleEarthEnterpriseMapsProvider,
  GridImageryProvider,
  IonImageryProvider,
  MapboxImageryProvider,
  MapboxStyleImageryProvider,
  SingleTileImageryProvider,
  TileCoordinatesImageryProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
}

/**
 * 创建基于GeoServer的影像提供者
 * 支持WMS和WMTS服务
 *
 * @param {Object} options 配置选项
 * @param {string} options.url GeoServer服务地址
 * @param {string} options.layer 图层名称
 * @param {string} [options.serviceType='WMS'] 服务类型，'WMS' 或 'WMTS'
 * @param {string} [options.version='1.3.0'] 服务版本
 * @param {string} [options.format='image/png'] 图片格式
 * @param {string} [options.style=''] 图层样式
 * @param {string} [options.tileMatrixSetID='EPSG:4326'] WMTS瓦片矩阵集
 * @param {string} [options.parameters={}] WMS请求参数
 * @param {Object} [options.wmtsOptions] WMTS特有配置
 * @returns {Promise<Cesium.ImageryProvider>} 影像提供者实例
 */
export function GeoserverImageryProvider(options: {
  url: string
  layer: string
  serviceType?: "WMS" | "WMTS"
  format?: string
  style?: string
  tileMatrixSetID?: string
  parameters?: Record<string, any>
  wmtsOptions?: any
}) {
  const {
    url,
    layer,
    serviceType = "WMS",
    format = "image/png",
    parameters = {},
    wmtsOptions = {},
    style = "",
    tileMatrixSetID = "EPSG:4326",
  } = options

  if (serviceType.toUpperCase() === "WMS") {
    return new WebMapServiceImageryProvider({
      url: url,
      layers: layer,
      parameters: {
        transparent: true,
        format: format,
        ...parameters,
      },
      enablePickFeatures: false,
    })
  } else if (serviceType.toUpperCase() === "WMTS") {
    const _url = `${url}/${layer}/{style}/{TileMatrixSet}/{TileMatrixSet}:{TileMatrix}/{TileRow}/{TileCol}?format=${format}`

    if (tileMatrixSetID === "EPSG:4326") {
      wmtsOptions.tilingScheme = new GeographicTilingScheme()
    }
    return new WebMapTileServiceImageryProvider({
      url: _url,
      layer: layer,
      style: style,
      format: format,
      tileMatrixSetID: tileMatrixSetID,
      ...wmtsOptions,
    })
  } else {
    throw new Error("不支持的服务类型，仅支持 WMS 和 WMTS")
  }
}
