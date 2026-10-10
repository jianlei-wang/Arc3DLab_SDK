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

/**
 * 底图管理器，用于设置替换底图并管理其生命周期。
 */
export class BasemapManager {
  private current: Layer | undefined

  /**
   * 创建底图管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 设置底图，替换现有底图并返回新的图层句柄。
   * @param spec - 底图数据源规格。
   * @returns 新建的底图图层句柄。
   */
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

  /**
   * 获取当前底图图层。
   * @returns 当前底图图层，未设置时返回 undefined。
   */
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
