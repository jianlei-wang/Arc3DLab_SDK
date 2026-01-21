/**
 * @fileoverview 提供创建点要素的功能，支持Entity和Primitive两种形式
 */

import { Cartesian3, Entity, PointPrimitiveCollection } from "cesium"
import { randomId } from "../../utils/Generate"
import { PointOption, default as PointGraphic } from "../graphics/PointGraphics"

/**
 * 使用Entity形式添加多个点
 * @function addPointsAsEntities
 * @param {Cartesian3[]} positions 点位置数组，笛卡尔坐标
 * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
 * @returns {Entity[]} 点对象数组，Entity类对象
 */
export function addPointsAsEntities(
  positions: Cartesian3[],
  option: PointOption | PointOption[]
): Entity[] {
  const entities: Entity[] = []
  const isOptionArray = Array.isArray(option)
  
  for (let i = 0; i < positions.length; i++) {
    // 根据option是否为数组来确定当前点的配置
    const currentOption = isOptionArray
      ? { ...option[i], id: option[i].id || randomId() }
      : { ...option, id: option.ids ? option.ids[i] : randomId() }

    const pointGraphic = new PointGraphic(currentOption)
    const entity = pointGraphic.createEntity(positions[i])
    entities.push(entity)
  }

  return entities
}

/**
 * 使用Primitive形式添加多个点
 * @function addPointsAsPrimitives
 * @param {Cartesian3[]} positions 点位置，笛卡尔坐标
 * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
 * @returns {PointPrimitiveCollection} 点集合对象，PointPrimitiveCollection类对象
 */
export function addPointsAsPrimitives(
  positions: Cartesian3[],
  option: PointOption | PointOption[]
): PointPrimitiveCollection {
  const pointPrimitiveCollection = new PointPrimitiveCollection()
  const isOptionArray = Array.isArray(option)
  
  for (let i = 0; i < positions.length; i++) {
    // 根据option是否为数组来确定当前点的配置
    const currentOption = isOptionArray
      ? { ...option[i], id: option[i].id || randomId() }
      : { ...option, id: option.ids ? option.ids[i] : randomId() }

    const pointGraphic = new PointGraphic(currentOption)
    const primitive = pointGraphic.createPointPrimitive(positions[i])
    pointPrimitiveCollection.add(primitive)
  }

  return pointPrimitiveCollection
}
