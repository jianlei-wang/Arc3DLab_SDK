import {
  Cartesian3,
  Entity,
  PointPrimitive,
  PointPrimitiveCollection,
} from "cesium"
import { Viewer } from "../Viewer"
import { PointOption, default as PointGraphic } from "../graphics/PointGraphics"
import { randomId, safeCallback } from "../../utils/Generate"

type PointCallback = (points: any[]) => any[]

class Add {
  /**
   * 图层-添加对象类
   * @param  {Viewer} viewer 地图场景对象
   */
  constructor(private viewer: Viewer) {}

  /**
   * 添加点-Entity形式
   * @method
   * @param {Cartesian3[]} positions 点位置数组，笛卡尔坐标
   * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
   * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
   * @returns {Cesium.Entity[]} 点对象数组，Entity类对象
   */
  addPointsAsEntities(
    positions: Cartesian3[],
    option: PointOption | PointOption[],
    callback?: PointCallback
  ): any[] {
    const entities: any[] = []

    // Check if option is an array or single object
    const isOptionArray = Array.isArray(option)

    for (let i = 0; i < positions.length; i++) {
      // Get the option for this specific point
      const currentOption = isOptionArray
        ? { ...option[i], id: option[i].id || randomId() }
        : { ...option, id: option.ids ? option.ids[i] : randomId() }

      const pointGraphic = new PointGraphic(currentOption)
      const entity = pointGraphic.createEntity(positions[i])
      this.viewer.entities.add(entity)
      entities.push(entity)
    }

    // If callback is provided, allow user to modify the entities
    if (callback) {
      return safeCallback<Entity[]>(callback, entities)
    }

    return entities
  }

  /**
   * 添加点-Primitive形式
   * @method
   * @param {Cartesian3[]} positions 点位置，笛卡尔坐标
   * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
   * @param {PointCallback} callback 可选回调函数，用于修改创建后的对象
   * @returns {Cesium.PointPrimitive[]} 点对象，PointPrimitive类对象，参照Cesium
   */
  addPointsAsPrimitives(
    positions: Cartesian3[],
    option: PointOption | PointOption[],
    callback?: PointCallback
  ): any[] {
    const primitives: any[] = []

    // Check if option is an array or single object
    const isOptionArray = Array.isArray(option)

    // Create a point primitive collection to hold all points
    const pointCollection = this.viewer.scene.primitives.add(
      new PointPrimitiveCollection()
    )

    for (let i = 0; i < positions.length; i++) {
      // Get the option for this specific point
      const currentOption = isOptionArray
        ? { ...option[i], id: option[i].id || randomId() }
        : { ...option, id: option.ids ? option.ids[i] : randomId() }

      const pointGraphic = new PointGraphic(currentOption)
      const primitive = pointGraphic.createPointPrimitive(
        positions[i],
        pointCollection
      )
      primitives.push(primitive)
    }

    // If callback is provided, allow user to modify the primitives
    if (callback) {
      return safeCallback<PointPrimitive[]>(callback, primitives)
    }

    return primitives
  }

  /**
   * 添加点-支持Entity和Primitive两种形式
   * @method
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
      const primitives = this.addPointsAsPrimitives(positions, option, callback)
      return primitives
    } else {
      const entities = this.addPointsAsEntities(positions, option, callback)
      return entities
    }
  }
}

export default Add
