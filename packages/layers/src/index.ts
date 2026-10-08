import {
  Arc3DError,
  createHandle,
  createId,
  type Arc3DContext,
  type ResourceHandle,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  ArcGisMapServerImageryProvider,
  CesiumTerrainProvider,
  Credit,
  EllipsoidTerrainProvider,
  ImageryLayer,
  IonImageryProvider,
  NearFarScalar,
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
  type ImageryProvider,
} from "cesium"

export interface Layer extends ResourceHandle {
  name?: string
  zIndex?: number
  group?: string
}

export interface BasemapSpec {
  type: "xyz" | "wms" | "wmts" | "tdt" | "arcgis" | "ion" | "single"
  url?: string
  urlTemplate?: string
  layers?: string
  token?: string
  credit?: string
  mode?: "img" | "vec" | "cva" | "cia"
  assetId?: number
}

export interface TerrainSpec {
  type: "url" | "ion" | "none"
  url?: string
  assetId?: number
}

function tdtUrl(mode: string, token: string): string {
  return `https://{s}.tianditu.gov.cn/${mode}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${mode}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={TileCol}&TILEROW={TileRow}&TILEMATRIX={TileMatrix}&tk=${token}`
}

async function createProvider(spec: BasemapSpec, fallbackToken?: string): Promise<ImageryProvider> {
  const credit = spec.credit ? new Credit(spec.credit) : undefined
  if (spec.type === "xyz") {
    return new UrlTemplateImageryProvider({ url: spec.urlTemplate ?? spec.url ?? "", credit })
  }
  if (spec.type === "wms") {
    return new WebMapServiceImageryProvider({
      url: spec.url ?? "",
      layers: spec.layers ?? "",
      parameters: { transparent: true, format: "image/png" },
      credit,
    })
  }
  if (spec.type === "wmts") {
    return new WebMapTileServiceImageryProvider({
      url: spec.url ?? "",
      layer: spec.layers ?? "",
      style: "default",
      format: "tiles",
      tileMatrixSetID: "w",
      credit,
    })
  }
  if (spec.type === "tdt") {
    const token = spec.token ?? fallbackToken ?? ""
    if (!token) {
      throw new Arc3DError("INVALID_ARGUMENT", "Tianditu basemap requires a runtime token")
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
  return SingleTileImageryProvider.fromUrl(spec.url ?? "")
}

export class BasemapManager {
  private current: Layer | undefined

  constructor(private readonly context: Arc3DContext) {}

  async set(spec: BasemapSpec): Promise<Layer> {
    this.context.lifecycle.assertUsable("set basemap")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const provider = await createProvider(spec, this.context.config.tokens?.tdt)
    if (this.current) {
      this.current.destroy()
      this.current = undefined
    }
    const imagery = viewer.imageryLayers.addImageryProvider(provider, 0)
    viewer.imageryLayers.lowerToBottom(imagery)
    const layer = this.wrap("basemap", imagery)
    this.current = layer
    this.context.events.emit("layerAdded", { id: layer.id, type: "basemap" })
    return layer
  }

  get(): Layer | undefined {
    return this.current
  }

  private wrap(type: string, imagery: ImageryLayer): Layer {
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = createId(type)
    const handle = createHandle({
      id,
      type,
      native: imagery,
      onVisible: (visible) => {
        imagery.show = visible
      },
      onDestroy: () => {
        viewer.imageryLayers.remove(imagery, true)
        this.context.registry.unregister(id)
        this.context.events.emit("layerRemoved", { id, type })
      },
    })
    this.context.registry.add(handle)
    return handle
  }
}

export class ImageryOverlayManager {
  constructor(private readonly context: Arc3DContext) {}

  async add(spec: BasemapSpec & { id?: string; name?: string }): Promise<Layer> {
    this.context.lifecycle.assertUsable("add imagery")
    const id = spec.id ?? createId("imagery")
    if (this.context.registry.has(id)) {
      this.context.registry.remove(id)
    }
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const provider = await createProvider(spec, this.context.config.tokens?.tdt)
    const imagery = viewer.imageryLayers.addImageryProvider(provider)
    const handle = createHandle({
      id,
      type: "imagery",
      native: imagery,
      onVisible: (visible) => {
        imagery.show = visible
      },
      onDestroy: () => {
        viewer.imageryLayers.remove(imagery, true)
        this.context.registry.unregister(id)
        this.context.events.emit("layerRemoved", { id, type: "imagery" })
      },
    })
    this.context.registry.add(handle)
    this.context.events.emit("layerAdded", { id, type: "imagery" })
    return Object.assign(handle, { name: spec.name })
  }

  show(id: string, visible: boolean): boolean {
    const layer = this.context.registry.get(id)
    if (!layer || layer.type !== "imagery") return false
    layer.visible = visible
    return true
  }

  remove(id: string): boolean {
    const layer = this.context.registry.get(id)
    if (!layer || layer.type !== "imagery") return false
    return this.context.registry.remove(id)
  }
}

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
      if (!spec.url) throw new Arc3DError("INVALID_ARGUMENT", "Terrain url is required")
      viewer.terrainProvider = await CesiumTerrainProvider.fromUrl(spec.url)
      return
    }
    throw new Arc3DError("INVALID_ARGUMENT", "Ion terrain requires a runtime ion token and assetId")
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
    const distance = this.viewer().scene.globe.translucency.frontFaceAlphaByDistance
    distance.nearValue = value
    distance.farValue = value
  }

  set translucency(enabled: boolean) {
    const globe = this.viewer().scene.globe
    globe.translucency.frontFaceAlphaByDistance = new NearFarScalar(1.5e2, 0.5, 8.0e6, 1.0)
    globe.translucency.enabled = enabled
    this.alpha = this._alpha
  }

  get translucency(): boolean {
    return this.viewer().scene.globe.translucency.enabled
  }

  set enableUnderground(enabled: boolean) {
    this.viewer().scene.screenSpaceCameraController.enableCollisionDetection = !enabled
  }

  get enableUnderground(): boolean {
    return !this.viewer().scene.screenSpaceCameraController.enableCollisionDetection
  }
}

export class TilesetManager {
  constructor(private readonly context: Arc3DContext) {}

  async add(options: { id?: string; url: string }): Promise<Layer> {
    this.context.lifecycle.assertUsable("add tileset")
    const { Cesium3DTileset } = await import("cesium")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const tileset = await Cesium3DTileset.fromUrl(options.url)
    viewer.scene.primitives.add(tileset)
    const id = options.id ?? createId("tileset")
    const handle = createHandle({
      id,
      type: "tileset",
      native: tileset,
      onVisible: (visible) => {
        tileset.show = visible
      },
      onDestroy: () => {
        viewer.scene.primitives.remove(tileset)
        this.context.registry.unregister(id)
        this.context.events.emit("layerRemoved", { id, type: "tileset" })
      },
    })
    this.context.registry.add(handle)
    this.context.events.emit("layerAdded", { id, type: "tileset" })
    return handle
  }
}

export class LayerManager {
  readonly imagery: ImageryOverlayManager
  readonly tilesets: TilesetManager

  constructor(context: Arc3DContext) {
    this.imagery = new ImageryOverlayManager(context)
    this.tilesets = new TilesetManager(context)
  }
}
