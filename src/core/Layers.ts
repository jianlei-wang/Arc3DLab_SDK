import Add from "./add-creator/Add"
import { Viewer } from "./Viewer"

class Layers {
  /**
   * 添加图层
   */
  public Add: Add = new Add(this.viewer)

  /**
   * 图层管理类
   * @param {Viewer} viewer
   */
  constructor(private viewer: Viewer) {}
}
export default Layers
