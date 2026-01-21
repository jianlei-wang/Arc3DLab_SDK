/**
 * @fileoverview 提供创建线要素的功能，支持Entity和Primitive两种形式
 */

import {
  Cartesian3,
  Entity,
  GroundPolylinePrimitive,
  PolylineColorAppearance,
  Primitive,
} from "cesium"
import { randomId } from "../../utils/Generate"
import PolylineGraphic, { PolylineOption } from "../graphics/PolylineGraphics"

/**
 * 使用Entity形式添加多条线
 * @function addLinesAsEntities
 * @param {Cartesian3[][]} positionsList 线位置数组的数组，每个元素是一个线的位置数组
 * @param {PolylineOption | PolylineOption[]} option 线参数，可以是单个对象或对象数组
 * @returns {Entity[]} 线对象数组，Entity类对象
 */
export function addLinesAsEntities(
  positionsList: Cartesian3[][],
  option: PolylineOption | PolylineOption[]
): Entity[] {
  const entities: Entity[] = []
  const isOptionArray = Array.isArray(option)

  for (let i = 0; i < positionsList.length; i++) {
    // 根据option是否为数组来确定当前线的配置
    const currentOption = isOptionArray
      ? { ...option[i], id: option[i].id || randomId() }
      : { ...option, id: option.ids ? option.ids[i] : randomId() }

    const lineGraphic = new PolylineGraphic(currentOption)
    const entity = lineGraphic.createEntity(positionsList[i])
    entities.push(entity)
  }

  return entities
}

/**
 * 使用Primitive形式添加多条线
 * @function addLinesAsPrimitives
 * @param {Cartesian3[][]} positionsList 线位置数组的数组，每个元素是一个线的位置数组
 * @param {PolylineOption | PolylineOption[]} option 线参数，可以是单个对象或对象数组
 * @returns {GroundPolylinePrimitive | PolylineCollection} 线集合对象，PolylineCollection类对象
 */
export function addLinesAsPrimitives(
  positionsList: Cartesian3[][],
  option: PolylineOption | PolylineOption[]
) {
  const isOptionArray = Array.isArray(option)
  const { onGround } = isOptionArray ? option[0] : option

  const polylineInstance = []
  for (let i = 0; i < positionsList.length; i++) {
    // 根据option是否为数组来确定当前线的配置
    const currentOption = isOptionArray
      ? { ...option[i], id: option[i].id || randomId() }
      : { ...option, id: option.ids ? option.ids[i] : randomId() }
    const lineGraphic = new PolylineGraphic(currentOption)
    const instance = lineGraphic.createPrimitive(positionsList[i])
    polylineInstance.push(instance)
  }
  const primitiveOpt = {
    geometryInstances: polylineInstance,
    appearance: new PolylineColorAppearance(),
  }
  const primitive = onGround
    ? new GroundPolylinePrimitive(primitiveOpt)
    : new Primitive(primitiveOpt)

  return primitive
}
