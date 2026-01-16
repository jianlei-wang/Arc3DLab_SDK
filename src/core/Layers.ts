/**
 * @fileoverview 图层管理类，负责管理地图上的各种图层和对象
 */

import Add from "./add-creator/Add"
import DataSourceManager from "./layers/layer-manager/DataSourceManager"
import EntityManager from "./layers/layer-manager/EntityManager"
import GroundPrimitiveManager from "./layers/layer-manager/GroundPrimitiveManager"
import ImageryLayerManager from "./layers/layer-manager/ImageryLayerManager"
import PrimitiveManager from "./layers/layer-manager/PrimitiveManager"
import { Viewer } from "./Viewer"

/**
 * 图层管理类
 * 提供对地图上各种图层和对象的统一管理功能
 */
class Layers {
  /** 实体管理器，负责管理地图上的实体对象 */
  public EntityManager: EntityManager = new EntityManager(this.viewer)

  /** 图元管理器，负责管理地图上的图元对象 */
  public PrimitiveManager: PrimitiveManager = new PrimitiveManager(this.viewer)

  /** 贴地面图元管理器，负责管理地图上的地面图元对象 */
  public GroundPrimitiveManager: GroundPrimitiveManager =
    new GroundPrimitiveManager(this.viewer)

  /** 数据源管理器，负责管理地图上的各种数据源 */
  public DataSourceManager: DataSourceManager = new DataSourceManager(
    this.viewer
  )

  /** 影像图层管理器，负责管理地图上的影像图层 */
  public ImageryLayerManager: ImageryLayerManager = new ImageryLayerManager(
    this.viewer
  )

  /** 添加对象类，提供向地图添加各种对象的方法 */
  public Add: Add = new Add(this)

  /**
   * 构造函数
   * @param {Viewer} viewer 地图查看器实例
   */
  constructor(public viewer: Viewer) {}

  /**
   * 获取指定名称的对象
   * @param {string} name 名称
   * @returns {any} 对象实例
   */
  get(name: string) {
    // 尝试从各个管理器中获取
    let obj = this.EntityManager.get(name)
    if (obj) return obj

    obj = this.PrimitiveManager.get(name)
    if (obj) return obj

    obj = this.GroundPrimitiveManager.get(name)
    if (obj) return obj

    obj = this.DataSourceManager.get(name)
    if (obj) return obj

    obj = this.ImageryLayerManager.get(name)
    if (obj) return obj

    return null
  }

  /**
   * 删除指定名称的对象
   * @param {string} name 名称
   * @returns {boolean} 是否删除成功
   */
  remove(name: string) {
    // 尝试从各个管理器中删除
    if (this.EntityManager.remove(name)) return true
    if (this.PrimitiveManager.remove(name)) return true
    if (this.GroundPrimitiveManager.remove(name)) return true
    if (this.DataSourceManager.remove(name)) return true
    if (this.ImageryLayerManager.remove(name)) return true

    return false
  }

  /**
   * 获取所有对象的ID列表
   * @returns {string[]} ID列表
   */
  getIds(): string[] {
    // 合并所有管理器的ID列表
    const ids = []
    ids.push(...this.EntityManager.getIds())
    ids.push(...this.PrimitiveManager.getIds())
    ids.push(...this.GroundPrimitiveManager.getIds())
    ids.push(...this.DataSourceManager.getIds())
    ids.push(...this.ImageryLayerManager.getIds())

    return ids
  }

  /**
   * 设置指定对象的可见性
   * @param {string} name 对象名称
   * @param {boolean} visible 是否可见
   * @returns {boolean} 是否设置成功
   */
  show(name: string, visible: boolean) {
    // 尝试在各个管理器中设置可见性
    try {
      this.EntityManager.show(name, visible)
      return true
    } catch (e) {}

    try {
      this.PrimitiveManager.show(name, visible)
      return true
    } catch (e) {}

    try {
      this.GroundPrimitiveManager.show(name, visible)
      return true
    } catch (e) {}

    try {
      this.DataSourceManager.show(name, visible)
      return true
    } catch (e) {}

    try {
      this.ImageryLayerManager.show(name, visible)
      return true
    } catch (e) {}

    return false
  }

  /**
   * 清除所有管理器中的对象
   * @returns {void}
   */
  clear() {
    this.EntityManager.clear()
    this.PrimitiveManager.clear()
    this.GroundPrimitiveManager.clear()
    this.DataSourceManager.clear()
    this.ImageryLayerManager.clear()
  }
}
export default Layers
