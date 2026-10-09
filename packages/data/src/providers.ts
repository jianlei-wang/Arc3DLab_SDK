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

export type ProviderType = "xyz" | "wms" | "wmts" | "tdt" | "arcgis" | "ion" | "single" | "tms"

export interface ProviderSpec {
  type: ProviderType
  url?: string
  urlTemplate?: string
  layers?: string
  token?: string
  credit?: string
  mode?: "img" | "vec" | "cva" | "cia"
  assetId?: number
  parameters?: Record<string, string | number | boolean>
  style?: string
  format?: string
  tileMatrixSetID?: string
}

export interface ProviderHandle {
  id: string
  type: ProviderType
  native: ImageryProvider
  spec: ProviderSpec
}

export function tdtUrl(mode: string, token: string): string {
  return `https://{s}.tianditu.gov.cn/${mode}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${mode}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={TileCol}&TILEROW={TileRow}&TILEMATRIX={TileMatrix}&tk=${token}`
}

export async function createImageryProvider(
  spec: ProviderSpec,
  fallbackToken?: string
): Promise<ImageryProvider> {
  try {
    return await createImageryProviderUnchecked(spec, fallbackToken)
  } catch (error) {
    throw classifyLoadError(error)
  }
}

async function createImageryProviderUnchecked(
  spec: ProviderSpec,
  fallbackToken?: string
): Promise<ImageryProvider> {
  const credit = spec.credit ? new Credit(spec.credit) : undefined
  if (spec.type === "xyz") {
    return new UrlTemplateImageryProvider({ url: spec.urlTemplate ?? spec.url ?? "", credit })
  }
  if (spec.type === "tms") {
    return TileMapServiceImageryProvider.fromUrl(spec.url ?? spec.urlTemplate ?? "", { credit })
  }
  if (spec.type === "wms") {
    return new WebMapServiceImageryProvider({
      url: spec.url ?? "",
      layers: spec.layers ?? "",
      parameters: { transparent: true, format: "image/png", ...spec.parameters },
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
      throw new Arc3DError("AUTH_FAILED", "Tianditu basemap requires a runtime token")
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
  throw new Arc3DError("INVALID_ARGUMENT", `Unsupported provider type: ${String((spec as ProviderSpec).type)}`)
}

export async function createProviderHandle(
  spec: ProviderSpec,
  fallbackToken?: string
): Promise<ProviderHandle> {
  const native = await createImageryProvider(spec, fallbackToken)
  return {
    id: createId("provider"),
    type: spec.type,
    native,
    spec,
  }
}
