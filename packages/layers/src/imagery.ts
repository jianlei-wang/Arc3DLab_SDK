import {
  assertAlive,
  assertNewResourceId,
  createHandle,
  createId,
  type Arc3DContext,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { createImageryProvider } from "@arc3dlab/data"
import type { BasemapSpec, Layer } from "./types"

export class ImageryOverlayManager {
  constructor(private readonly context: Arc3DContext) {}

  async add(
    spec: BasemapSpec & { id?: string; name?: string },
  ): Promise<Layer> {
    this.context.lifecycle.assertUsable("add imagery")
    const id = spec.id ?? createId("imagery")
    assertNewResourceId(this.context.registry, id)
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const provider = await createImageryProvider(
      spec,
      this.context.config.tokens?.tdt,
    )
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
        this.context.catalog.unregisterLayer(id)
        this.context.events.emit("layerRemoved", { id, type: "imagery" })
      },
    })
    try {
      this.context.registry.add(handle)
    } catch (error) {
      viewer.imageryLayers.remove(imagery, true)
      throw error
    }
    this.context.catalog.registerLayer({
      id,
      kind: "imagery",
      visible: true,
      loadState: "ready",
    })
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
