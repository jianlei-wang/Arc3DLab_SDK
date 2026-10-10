import { Arc3DError, classifyLoadError, createId } from "@arc3dlab/core"
import {
  ArcGisMapServerImageryProvider,
  Credit,
  IonImageryProvider,
  SingleTileImageryProvider,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  type ImageryProvider,
} from "cesium"

/**
 * 影像提供者类型，涵盖常见瓦片服务与专用服务。
 */
export type ProviderType =
  "xyz" | "wms" | "wmts" | "tdt" | "arcgis" | "ion" | "single" | "tms"

/**
 * 描述一个影像提供者的配置规格。
 */
export interface ProviderSpec {
  /** 影像提供者类型。 */
  type: ProviderType
  /** 服务地址。 */
  url?: string
  /** URL 模板。 */
  urlTemplate?: string
  /** 图层名称。 */
  layers?: string
  /** 服务访问令牌。 */
  token?: string
  /** 版权署名文本。 */
  credit?: string
  /** 天地图影像模式。 */
  mode?: "img" | "vec" | "cva" | "cia"
  /** Cesium Ion 资源编号。 */
  assetId?: number
  /** 附加请求参数。 */
  parameters?: Record<string, string | number | boolean>
  /** 样式名称。 */
  style?: string
  /** 瓦片格式。 */
  format?: string
  /** 瓦片矩阵集标识。 */
  tileMatrixSetID?: string
}

/**
 * 描述一个已创建的影像提供者句柄。
 */
export interface ProviderHandle {
  /** 提供者标识。 */
  id: string
  /** 提供者类型。 */
  type: ProviderType
  /** 原生影像提供者实例。 */
  native: ImageryProvider
  /** 创建该提供者时使用的原始规格。 */
  spec: ProviderSpec
}

/**
 * 根据模式与令牌构造天地图 WMTS 服务地址。
 * @param mode - 天地图影像模式。
 * @param token - 天地图服务令牌。
 * @returns 天地图 WMTS 服务地址。
 */
export function tdtUrl(mode: string, token: string): string {
  return `https://{s}.tianditu.gov.cn/${mode}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${mode}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={TileCol}&TILEROW={TileRow}&TILEMATRIX={TileMatrix}&tk=${token}`
}

/**
 * 根据规格创建对应的影像提供者，并统一处理加载错误。
 * @param spec - 影像提供者规格。
 * @param fallbackToken - 可选的备用令牌，用于规格未提供令牌的场景。
 * @returns 影像提供者的 Promise。
 * @throws {Arc3DError} 当提供者类型不受支持或加载失败时抛出。
 */
export async function createImageryProvider(
  spec: ProviderSpec,
  fallbackToken?: string,
): Promise<ImageryProvider> {
  try {
    return await createImageryProviderUnchecked(spec, fallbackToken)
  } catch (error) {
    throw classifyLoadError(error)
  }
}

async function createImageryProviderUnchecked(
  spec: ProviderSpec,
  fallbackToken?: string,
): Promise<ImageryProvider> {
  const credit = spec.credit ? new Credit(spec.credit) : undefined
  if (spec.type === "xyz") {
    return new UrlTemplateImageryProvider({
      url: spec.urlTemplate ?? spec.url ?? "",
      credit,
    })
  }
  if (spec.type === "tms") {
    return TileMapServiceImageryProvider.fromUrl(
      spec.url ?? spec.urlTemplate ?? "",
      { credit },
    )
  }
  if (spec.type === "wms") {
    return new WebMapServiceImageryProvider({
      url: spec.url ?? "",
      layers: spec.layers ?? "",
      parameters: {
        transparent: true,
        format: "image/png",
        ...spec.parameters,
      },
      credit,
    })
  }
  if (spec.type === "wmts") {
    return new WebMapTileServiceImageryProvider({
      url: spec.url ?? spec.urlTemplate ?? "",
      layer: spec.layers ?? "",
      style: spec.style ?? "default",
      format: spec.format ?? "tiles",
      tileMatrixSetID: spec.tileMatrixSetID ?? "w",
      credit,
    })
  }
  if (spec.type === "tdt") {
    const token = spec.token ?? fallbackToken ?? ""
    if (!token) {
      throw new Arc3DError(
        "AUTH_FAILED",
        "Tianditu basemap requires a runtime token",
      )
    }
    return new WebMapTileServiceImageryProvider({
      url: tdtUrl(spec.mode ?? "img", token),
      layer: spec.mode ?? "img",
      style: "default",
      format: "tiles",
      tileMatrixSetID: "w",
      subdomains: ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"],
      credit: credit ?? new Credit("天地图"),
    })
  }
  if (spec.type === "arcgis") {
    return ArcGisMapServerImageryProvider.fromUrl(spec.url ?? "")
  }
  if (spec.type === "ion") {
    if (spec.assetId === undefined) {
      throw new Arc3DError("INVALID_ARGUMENT", "Ion imagery requires assetId")
    }
    return IonImageryProvider.fromAssetId(spec.assetId)
  }
  if (spec.type === "single") {
    return SingleTileImageryProvider.fromUrl(spec.url ?? "")
  }
  throw new Arc3DError(
    "INVALID_ARGUMENT",
    `Unsupported provider type: ${String((spec as ProviderSpec).type)}`,
  )
}

/**
 * 创建影像提供者并封装为携带元数据的句柄。
 * @param spec - 影像提供者规格。
 * @param fallbackToken - 可选的备用令牌，用于规格未提供令牌的场景。
 * @returns 影像提供者句柄的 Promise。
 * @throws {Arc3DError} 当提供者类型不受支持或加载失败时抛出。
 */
export async function createProviderHandle(
  spec: ProviderSpec,
  fallbackToken?: string,
): Promise<ProviderHandle> {
  const native = await createImageryProvider(spec, fallbackToken)
  return {
    id: createId("provider"),
    type: spec.type,
    native,
    spec,
  }
}
