/**
 * @fileoverview 添加对象类，提供地图上各种对象的添加功能
 */

import {
  Cartesian3,
  Entity,
  PointPrimitive,
  PointPrimitiveCollection,
} from "cesium"
import Layers from "../Layers"
import { PointOption, default as PointGraphic } from "../graphics/PointGraphics"
import { Viewer } from "../Viewer"
import { addPointsAsEntities, addPointsAsPrimitives } from "./AddPoint"
import { randomId, safeCallback } from "src/utils/Generate"

/**
 * 点回调函数类型定义
 * @typedef {Function} PointCallback
 * @param {any[]} points 处理前的点对象数组
 * @returns {any[]} 处理后的点对象数组
 */
type PointCallback = (points: any[]) => any[]

/**
 * 添加对象类
 * 用于在地图场景中添加各种类型的对象，如点、线、面等
 */
class Add {
  public viewer: Viewer
  
  /**
   * 构造函数
   * @param {Layers} Layers 地图场景图层对象
   */
  constructor(private Layers: Layers) {
    this.viewer = Layers.viewer
  }


  /**
   * 添加点-支持Entity和Primitive两种形式
   * @method addPoints
   * @param {Cartesian3[]} positions 点位置数组，笛卡尔坐标
   * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
   * @param {boolean} usePrimitive 是否使用Primitive方式，默认为false（使用Entity方式）
   * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
   * @returns {any} 包含entities或primitives的对象
   */
  addPoints(
    positions: Cartesian3[],
    option: PointOption | PointOption[] = {},
    usePrimitive: boolean = false,
    callback?: PointCallback
  ): any {
    if (usePrimitive) {

      const primitives = addPointsAsPrimitives(positions, option)
      const addedPrimitives = this.Layers.PrimitiveManager.add(randomId(), primitives)
      console.log(addedPrimitives)
      if (callback) {
        return safeCallback<any[]>(callback, addedPrimitives)
      }
    } else {
      const entities = addPointsAsEntities(positions, option)
      const addedEntities = this.Layers.EntityManager.add(randomId(), entities)
      console.log(addedEntities)
      if (callback) {
        return safeCallback<Entity[]>(callback, addedEntities)
      }
    }
    // If callback is provided, allow user to modify the entities

  }
}

export default Add