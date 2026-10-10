import {
  Arc3DError,
  assertAlive,
  assertNewResourceId,
  createHandle,
  createId,
  type Arc3DContext,
} from "@arc3dlab/core"
import {
  getCesiumViewer,
  readIonToken,
  withIonAccessToken,
} from "@arc3dlab/engine-cesium"
import type { Layer } from "./types"

/**
 * 3D Tiles 图层管理器，用于通过 URL 或 Cesium Ion 资源添加瓦片集图层。
 */
export class TilesetManager {
  /**
   * 创建 3D Tiles 图层管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 添加一个 3D Tiles 瓦片集图层。
   * @param options - 瓦片集创建选项，需提供 url 或 assetId。
   * @returns 新建的瓦片集图层句柄。
   */
  async add(options: {
    id?: string
    url?: string
    assetId?: number
  }): Promise<Layer> {
    this.context.lifecycle.assertUsable("add tileset")
    const id = options.id ?? createId("tileset")
    assertNewResourceId(this.context.registry, id)
    const { Cesium3DTileset } = await import("cesium")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    let tileset
    if (options.assetId !== undefined) {
      tileset = await withIonAccessToken(
        readIonToken(this.context.config),
        () => Cesium3DTileset.fromIonAssetId(options.assetId as number),
      )
    } else if (options.url) {
      tileset = await Cesium3DTileset.fromUrl(options.url)
    } else {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        "Tileset requires url or assetId",
      )
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
        this.context.catalog.unregisterLayer(id)
        this.context.events.emit("layerRemoved", { id, type: "tileset" })
      },
    })
    try {
      this.context.registry.add(handle)
    } catch (error) {
      viewer.scene.primitives.remove(tileset)
      throw error
    }
    this.context.catalog.registerLayer({
      id,
      kind: "tileset",
      visible: true,
      loadState: "ready",
    })
    this.context.events.emit("layerAdded", { id, type: "tileset" })
    return handle
  }
}
