import {
  Arc3DError,
  afterAwait,
  assertNewResourceId,
  classifyLoadError,
  createHandle,
  createId,
  type Arc3DContext,
  type ResourceHandle,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  CzmlDataSource,
  GeoJsonDataSource,
  KmlDataSource,
  type DataSource,
} from "cesium"
import {
  createProviderHandle,
  type ProviderHandle,
  type ProviderSpec,
} from "./providers"

export type DataFormat = "geojson" | "kml" | "czml"

export interface DataSourceSpec {
  id?: string
  type: DataFormat
  url: string
}

export class DataManager {
  constructor(private readonly context: Arc3DContext) {}

  async createProvider(spec: ProviderSpec): Promise<ProviderHandle> {
    this.context.lifecycle.assertUsable("create provider")
    return createProviderHandle(spec, this.context.config.tokens?.tdt)
  }

  load(spec: DataSourceSpec): Promise<ResourceHandle> {
    return this.add(spec)
  }

  async add(spec: DataSourceSpec): Promise<ResourceHandle> {
    this.context.lifecycle.assertUsable("add data source")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = spec.id ?? createId(spec.type)
    assertNewResourceId(this.context.registry, id)
    this.context.catalog.registerAsset({ id, format: spec.type, uri: spec.url })
    this.context.catalog.registerLayer({
      id,
      kind: "data",
      assetId: id,
      visible: true,
      loadState: "loading",
    })

    let source: DataSource
    try {
      if (spec.type === "geojson")
        source = await GeoJsonDataSource.load(spec.url)
      else if (spec.type === "kml") source = await KmlDataSource.load(spec.url)
      else if (spec.type === "czml")
        source = await CzmlDataSource.load(spec.url)
      else
        throw new Arc3DError(
          "INVALID_ARGUMENT",
          `Unsupported data type: ${String(spec.type)}`,
        )
    } catch (error) {
      const classified = classifyLoadError(error)
      this.context.catalog.updateLayer(id, {
        loadState: "failed",
        error: { code: classified.code, message: classified.message },
      })
      throw classified
    }

    await afterAwait(this.context.lifecycle, "add data source", source)
    await viewer.dataSources.add(source)
    await afterAwait(this.context.lifecycle, "add data source", source, () => {
      viewer.dataSources.remove(source, true)
    })
    const handle = createHandle({
      id,
      type: spec.type,
      native: source,
      onVisible: (visible) => {
        source.show = visible
      },
      onDestroy: () => {
        viewer.dataSources.remove(source, true)
        this.context.registry.unregister(id)
        this.context.catalog.unregisterLayer(id)
        this.context.events.emit("layerRemoved", { id, type: spec.type })
      },
    })
    try {
      this.context.registry.add(handle)
    } catch (error) {
      viewer.dataSources.remove(source, true)
      this.context.catalog.unregisterLayer(id)
      throw error
    }
    this.context.catalog.updateLayer(id, { loadState: "ready" })
    this.context.events.emit("layerAdded", { id, type: spec.type })
    return handle
  }

  addGeoJson(options: { id?: string; url: string }): Promise<ResourceHandle> {
    return this.add({ ...options, type: "geojson" })
  }

  addKml(options: { id?: string; url: string }): Promise<ResourceHandle> {
    return this.add({ ...options, type: "kml" })
  }

  addCzml(options: { id?: string; url: string }): Promise<ResourceHandle> {
    return this.add({ ...options, type: "czml" })
  }
}

export {
  createImageryProvider,
  createProviderHandle,
  tdtUrl,
  type ProviderHandle,
  type ProviderSpec,
  type ProviderType,
} from "./providers"
