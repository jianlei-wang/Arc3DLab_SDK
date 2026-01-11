import Add from "./add-creator/Add"
import EntityManager from "./layers/layer-manager/EntityManager"
import PrimitiveManager from "./layers/layer-manager/PrimitiveManager"
import { Viewer } from "./Viewer"

class Layers {
  public EntityManager: EntityManager = new EntityManager(this.viewer)

  public PrimitiveManager: PrimitiveManager = new PrimitiveManager(this.viewer)

  /**
   * 添加图层
   */
  public Add: Add = new Add(this)

  /**
   * 图层管理类
   * @param {Viewer} viewer
   */
  constructor(public viewer: Viewer) {
  }
}
export default Layers
