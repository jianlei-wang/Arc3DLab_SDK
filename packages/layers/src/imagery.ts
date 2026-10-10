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

/**
 * 影像叠加图层管理器，用于添加、显示与移除影像图层。
 */
export class ImageryOverlayManager {
  /**
   * 创建影像叠加图层管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 添加一个影像叠加图层。
   * @param spec - 影像数据源规格，可包含自定义 id 与名称。
   * @returns 新建的影像图层句柄。
   */
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

  /**
   * 设置指定影像图层的可见性。
   * @param id - 目标影像图层 ID。
   * @param visible - 是否可见。
   * @returns 图层存在且为影像类型时返回 true。
   */
  show(id: string, visible: boolean): boolean {
    const layer = this.context.registry.get(id)
    if (!layer || layer.type !== "imagery") return false
    layer.visible = visible
    return true
  }

  /**
   * 移除指定的影像图层。
   * @param id - 目标影像图层 ID。
   * @returns 图层存在且为影像类型时返回 true。
   */
  remove(id: string): boolean {
    const layer = this.context.registry.get(id)
    if (!layer || layer.type !== "imagery") return false
    return this.context.registry.remove(id)
  }
}
