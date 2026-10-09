import {
  Arc3DError,
  assertAlive,
  assertNewResourceId,
  createHandle,
  createId,
  type Arc3DContext,
  type ResourceHandle,
} from "@arc3dlab/core"
import { getCesiumViewer, readIonToken, withIonAccessToken } from "@arc3dlab/engine-cesium"
import { createImageryProvider, DataManager, type ProviderSpec } from "@arc3dlab/data"
import {
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  ImageryLayer,
  NearFarScalar,
} from "cesium"

export interface Layer extends ResourceHandle {
  name?: string
  zIndex?: number
  group?: string
}

export type BasemapSpec = ProviderSpec

export interface TerrainSpec {
  type: "url" | "ion" | "none"
  url?: string
  assetId?: number
}

export class BasemapManager {
  private current: Layer | undefined

  constructor(private readonly context: Arc3DContext) {}

  async set(spec: BasemapSpec): Promise<Layer> {
    this.context.lifecycle.assertUsable("set basemap")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const provider = await createImageryProvider(spec, this.context.config.tokens?.tdt)
    assertAlive(this.context.lifecycle, "set basemap")
    if (this.current) {
      this.current.destroy()
      this.current = undefined
    }
    const imagery = viewer.imageryLayers.addImageryProvider(provider, 0)
    viewer.imageryLayers.lowerToBottom(imagery)
    try {
      const layer = this.wrap("basemap", imagery)
      this.current = layer
      this.context.events.emit("layerAdded", { id: layer.id, type: "basemap" })
      return layer
    } catch (error) {
      viewer.imageryLayers.remove(imagery, true)
      throw error
    }
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
    assertNewResourceId(this.context.registry, id)
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const provider = await createImageryProvider(spec, this.context.config.tokens?.tdt)
    assertAlive(this.context.lifecycle, "add imagery")
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
    try {
      this.context.registry.add(handle)
    } catch (error) {
      viewer.imageryLayers.remove(imagery, true)
      throw error
    }
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
        throw new Arc3DError("AUTH_FAILED", "Ion terrain requires a runtime ion token")
      }
      const provider = await withIonAccessToken(token, () =>
        CesiumTerrainProvider.fromIonAssetId(spec.assetId as number)
      )
      assertAlive(this.context.lifecycle, "set terrain")
      viewer.terrainProvider = provider
      return
    }
    throw new Arc3DError("INVALID_ARGUMENT", `Unsupported terrain type: ${String(spec.type)}`)
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

  async add(options: { id?: string; url?: string; assetId?: number }): Promise<Layer> {
    this.context.lifecycle.assertUsable("add tileset")
    const id = options.id ?? createId("tileset")
    assertNewResourceId(this.context.registry, id)
    const { Cesium3DTileset } = await import("cesium")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    let tileset
    if (options.assetId !== undefined) {
      tileset = await withIonAccessToken(readIonToken(this.context.config), () =>
        Cesium3DTileset.fromIonAssetId(options.assetId as number)
      )
    } else if (options.url) {
      tileset = await Cesium3DTileset.fromUrl(options.url)
    } else {
      throw new Arc3DError("INVALID_ARGUMENT", "Tileset requires url or assetId")
    }
    assertAlive(this.context.lifecycle, "add tileset", () => {
      tileset.destroy()
    })
    viewer.scene.primitives.add(tileset)
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
    try {
      this.context.registry.add(handle)
    } catch (error) {
      viewer.scene.primitives.remove(tileset)
      throw error
    }
    this.context.events.emit("layerAdded", { id, type: "tileset" })
    return handle
  }
}

export class LayerManager {
  readonly imagery: ImageryOverlayManager
  readonly tilesets: TilesetManager
  readonly data: DataManager

  constructor(context: Arc3DContext) {
    this.imagery = new ImageryOverlayManager(context)
    this.tilesets = new TilesetManager(context)
    this.data = new DataManager(context)
  }
}
