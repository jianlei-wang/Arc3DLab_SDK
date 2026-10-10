import {
  assertAlive,
  createHandle,
  createId,
  type Arc3DContext,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { createImageryProvider } from "@arc3dlab/data"
import { ImageryLayer } from "cesium"
import type { BasemapSpec, Layer } from "./types"

export class BasemapManager {
  private current: Layer | undefined

  constructor(private readonly context: Arc3DContext) {}

  async set(spec: BasemapSpec): Promise<Layer> {
    this.context.lifecycle.assertUsable("set basemap")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const provider = await createImageryProvider(
      spec,
      this.context.config.tokens?.tdt,
    )
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
        this.context.catalog.unregisterLayer(id)
        this.context.events.emit("layerRemoved", { id, type })
      },
    })
    this.context.registry.add(handle)
    this.context.catalog.registerLayer({
      id,
      kind: "basemap",
      visible: true,
      loadState: "ready",
    })
    return handle
  }
}
