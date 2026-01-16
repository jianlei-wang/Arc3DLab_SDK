/**
 * @fileoverview 实体管理器，负责管理Cesium中的实体对象
 */

import { Viewer } from "src/core/Viewer"

/**
 * 实体管理器类
 * 用于管理Cesium中的实体对象，包括添加、获取、删除等操作
 */
class EntityManager {
  entities: Map<any, any>

  /**
   * 构造函数
   * @param {Viewer} viewer Cesium视图对象
   */
  constructor(private viewer: Viewer) {
    this.entities = new Map()
  }

  /**
   * 添加实体
   * @param {string} id 实体唯一标识符
   * @param {any} entity 要添加的实体对象，可以是单个实体或实体数组
   * @returns {any} 添加后的实体对象
   */
  add(id: string, entity: any) {
    if (this.entities.has(id)) {
      this.remove(id)
    }
    entity = Array.isArray(entity) ? entity : [entity]
    const vEntities = this.viewer.entities

    // 挂起事件，提高性能
    vEntities.suspendEvents()

    try {
      entity = entity.map((e: any) => this.viewer.entities.add(e))
      this.entities.set(id, entity)
    } finally {
      vEntities.resumeEvents()
    }
    return entity
  }

  /**
   * 获取实体
   * @param {string} id 实体唯一标识符
   * @returns {any} 对应的实体对象，如果不存在则返回undefined
   */
  get(id: string) {
    return this.entities.get(id)
  }

  /**
   * 删除实体
   * @param {string} id 实体唯一标识符
   * @returns {boolean} 删除成功返回true，否则返回false
   */
  remove(id: string) {
    const entity = this.entities.get(id)
    if (entity) {
      const _entities = Array.isArray(entity) ? entity : [entity]
      _entities.forEach((e) => this.viewer.entities.remove(e))
      this.entities.delete(id)
      return true
    }
    return false
  }

  /**
   * 设置实体显示状态
   * @param {string} id 实体唯一标识符
   * @param {boolean} visible 显示状态，true为显示，false为隐藏
   */
  show(id: string, visible: boolean) {
    const entity = this.entities.get(id)
    if (entity) {
      const _entities = Array.isArray(entity) ? entity : [entity]
      _entities.forEach((e) => (e.show = visible))
    }
  }

  /**
   * 飞行到指定实体
   * @param {string} id 实体唯一标识符
   * @param {number} duration 飞行时间，单位为秒
   */
  flyTo(id: string, duration: number) {
    const entity = this.entities.get(id)
    entity && this.viewer.flyTo(entity, { duration })
  }

  /**
   * 清空所有实体
   */
  clear() {
    this.entities.forEach((entity) => {
      const _entities = Array.isArray(entity) ? entity : [entity]
      _entities.forEach((e) => this.viewer.entities.remove(e))
    })
    this.entities.clear()
  }

  /**
   * 获取所有实体的ID列表
   * @returns {string[]} 所有实体的ID数组
   */
  getIds() {
    return Array.from(this.entities.keys())
  }
}
export default EntityManager
