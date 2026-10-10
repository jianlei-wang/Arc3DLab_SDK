import type { Arc3DContext } from "@arc3dlab/core"
import { DataManager } from "@arc3dlab/data"
import { ImageryOverlayManager } from "./imagery"
import { TilesetManager } from "./tileset"

/**
 * 图层管理器，聚合影像、3D Tiles 与数据图层等子管理器。
 */
export class LayerManager {
  /** 影像叠加图层管理器。 */
  readonly imagery: ImageryOverlayManager
  /** 3D Tiles 图层管理器。 */
  readonly tilesets: TilesetManager
  /** 数据图层管理器。 */
  readonly data: DataManager

  /**
   * 创建图层管理器并初始化各子管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(context: Arc3DContext) {
    this.imagery = new ImageryOverlayManager(context)
    this.tilesets = new TilesetManager(context)
    this.data = new DataManager(context)
  }
}
