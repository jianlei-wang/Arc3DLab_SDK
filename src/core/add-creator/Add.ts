/**
 * @fileoverview 添加对象类，提供地图上各种对象的添加功能
 */

import { Cartesian3, Entity, GroundPolylinePrimitive } from "cesium"
import Layers from "../Layers"
import { PointOption } from "../graphics/PointGraphics"
import { PolylineOption } from "../graphics/PolylineGraphics"
import { PolygonOption } from "../graphics/PolygonGraphics"
import { Viewer } from "../Viewer"
import { addPointsAsEntities, addPointsAsPrimitives } from "./AddPoint"
import { addLinesAsEntities, addLinesAsPrimitives } from "./AddLine"
import { addPolygonsAsEntities, addPolygonsAsPrimitives } from "./AddPolygon"
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
  /**
   * 查看器实例
   * @type {Viewer}
   */
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
      // 使用Primitive方式添加点
      const primitives = addPointsAsPrimitives(positions, option)
      const addedPrimitives = this.Layers.PrimitiveManager.add(
        randomId(),
        primitives
      )
      if (callback) {
        return safeCallback<any[]>(callback, addedPrimitives)
      }
    } else {
      // 使用Entity方式添加点
      const entities = addPointsAsEntities(positions, option)
      const addedEntities = this.Layers.EntityManager.add(randomId(), entities)
      if (callback) {
        return safeCallback<Entity[]>(callback, addedEntities)
      }
    }
  }

  /**
   * 添加线-支持Entity和Primitive两种形式
   * @method addLines
   * @param {Cartesian3[][]} positionsList 线位置数组的数组，每个元素是一个线的位置数组
   * @param {PolylineOption | PolylineOption[]} option 线参数，可以是单个对象或对象数组
   * @param {boolean} usePrimitive 是否使用Primitive方式，默认为false（使用Entity方式）
   * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
   * @returns {any} 包含entities或primitives的对象
   */
  addLines(
    positionsList: Cartesian3[][],
    option: PolylineOption | PolylineOption[] = {},
    usePrimitive: boolean = false,
    callback?: PointCallback
  ): any {
    if (usePrimitive) {
      const primitives = addLinesAsPrimitives(positionsList, option)
      let addedPrimitives
      const id = randomId()
      if (primitives instanceof GroundPolylinePrimitive) {
        addedPrimitives = this.Layers.GroundPrimitiveManager.add(id, primitives)
      } else {
        addedPrimitives = this.Layers.PrimitiveManager.add(id, primitives)
      }

      if (callback) {
        return safeCallback<any[]>(callback, addedPrimitives)
      }
      return addedPrimitives
    } else {
      const entities = addLinesAsEntities(positionsList, option)
      const addedEntities = this.Layers.EntityManager.add(randomId(), entities)

      if (callback) {
        return safeCallback<Entity[]>(callback, addedEntities)
      }

      return addedEntities
    }
  }

  /**
   * 添加面-支持Entity和Primitive两种形式
   * @method addPolygons
   * @param {Cartesian3[][]} positionsList 面位置数组的数组，每个元素是一个面的位置数组
   * @param {PolygonOption | PolygonOption[]} option 面参数，可以是单个对象或对象数组
   * @param {boolean} usePrimitive 是否使用Primitive方式，默认为false（使用Entity方式）
   * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
   * @returns {any} 包含entities或primitives的对象
   */
  addPolygons(
    positionsList: Cartesian3[][],
    option: PolygonOption | PolygonOption[] = {},
    usePrimitive: boolean = false,
    callback?: PointCallback
  ): any {
    if (usePrimitive) {
      const id = randomId()
      const { polygonPrimitive, polylinePrimitive } = addPolygonsAsPrimitives(
        positionsList,
        option
      )
      const polygonPrimitives = this.Layers.PrimitiveManager.add(
        id,
        polygonPrimitive
      )
      let polylinePrimitivevs
      if (polylinePrimitive) {
        polylinePrimitivevs =
          polylinePrimitive instanceof GroundPolylinePrimitive
            ? this.Layers.GroundPrimitiveManager.add(id, polylinePrimitive)
            : this.Layers.PrimitiveManager.add(id, polylinePrimitive)
      }
      if (callback) {
        return safeCallback<any[]>(callback, [
          polygonPrimitives,
          polylinePrimitivevs,
        ])
      }
      return [polygonPrimitives, polylinePrimitivevs]
    } else {
      const entities = addPolygonsAsEntities(positionsList, option)
      const addedEntities = this.Layers.EntityManager.add(randomId(), entities)

      if (callback) {
        return safeCallback<Entity[]>(callback, addedEntities)
      }

      return addedEntities
    }
  }
}

export default Add
