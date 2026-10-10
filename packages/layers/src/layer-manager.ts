import type { Arc3DContext } from "@arc3dlab/core"
import { DataManager } from "@arc3dlab/data"
import { ImageryOverlayManager } from "./imagery"
import { TilesetManager } from "./tileset"

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
