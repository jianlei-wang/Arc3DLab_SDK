import { Arc3DError, createHandle, createId, type Arc3DContext, type ResourceHandle } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { CzmlDataSource, GeoJsonDataSource, KmlDataSource } from "cesium"

export type DataFormat = "geojson" | "kml" | "czml"

export interface DataSourceSpec {
  id?: string
  type: DataFormat
  url: string
}

export class DataManager {
  constructor(private readonly context: Arc3DContext) {}

  async add(spec: DataSourceSpec): Promise<ResourceHandle> {
    this.context.lifecycle.assertUsable("add data source")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = spec.id ?? createId(spec.type)
    if (this.context.registry.has(id)) this.context.registry.remove(id)

    let source
    if (spec.type === "geojson") source = await GeoJsonDataSource.load(spec.url)
    else if (spec.type === "kml") source = await KmlDataSource.load(spec.url)
    else if (spec.type === "czml") source = await CzmlDataSource.load(spec.url)
    else throw new Arc3DError("INVALID_ARGUMENT", `Unsupported data type: ${String(spec.type)}`)

    await viewer.dataSources.add(source)
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
        this.context.events.emit("layerRemoved", { id, type: spec.type })
      },
    })
    this.context.registry.add(handle)
    this.context.events.emit("layerAdded", { id, type: spec.type })
    return handle
  }

  addGeoJson(options: { id?: string; url: string }): Promise<ResourceHandle> {
    return this.add({ ...options, type: "geojson" })
  }
}
