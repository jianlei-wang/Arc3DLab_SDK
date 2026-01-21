/**
 * @fileoverview 提供创建面要素的功能，支持Entity和Primitive两种形式
 */

import {
  Cartesian3,
  Entity,
  GroundPrimitive,
  PerInstanceColorAppearance,
  Primitive,
} from "cesium"
import { randomId } from "../../utils/Generate"
import {
  PolygonOption,
  default as PolygonGraphic,
} from "../graphics/PolygonGraphics"
import { addLinesAsPrimitives } from "./AddLine"

/**
 * 使用Entity形式添加多个面
 * @function addPolygonsAsEntities
 * @param {Cartesian3[][]} positionsList 面位置数组的数组，每个元素是一个面的位置数组
 * @param {PolygonOption | PolygonOption[]} option 面参数，可以是单个对象或对象数组
 * @returns {Entity[]} 面对象数组，Entity类对象
 */
export function addPolygonsAsEntities(
  positionsList: Cartesian3[][],
  option: PolygonOption | PolygonOption[]
): Entity[] {
  const entities: Entity[] = []
  const isOptionArray = Array.isArray(option)

  for (let i = 0; i < positionsList.length; i++) {
    // 根据option是否为数组来确定当前面的配置
    const currentOption = isOptionArray
      ? { ...option[i], id: option[i].id || randomId() }
      : { ...option, id: option.ids ? option.ids[i] : randomId() }

    const polygonGraphic = new PolygonGraphic(currentOption)
    const entity = polygonGraphic.createEntity(positionsList[i])
    entities.push(entity)
  }

  return entities
}

/**
 * 使用Primitive形式添加多个面
 * @function addPolygonsAsPrimitives
 * @param {Cartesian3[][]} positionsList 面位置数组的数组，每个元素是一个面的位置数组
 * @param {PolygonOption | PolygonOption[]} option 面参数，可以是单个对象或对象数组
 * @returns {any} 面集合对象
 */
export function addPolygonsAsPrimitives(
  positionsList: Cartesian3[][],
  option: PolygonOption | PolygonOption[]
): any {
  // 实际上，对于Polygon Primitive，我们通常需要使用Primitive和GeometryInstance
  // 这里返回一个包含必要信息的对象，供外部使用
  const polygonInstance = []
  // const polylineInstance = []
  const isOptionArray = Array.isArray(option)
  const { outline } = isOptionArray ? option[0] : option
  let boolTerrain = true
  for (let i = 0; i < positionsList.length; i++) {
    // 根据option是否为数组来确定当前面的配置
    const currentOption = isOptionArray
      ? { ...option[i], id: option[i].id || randomId() }
      : { ...option, id: option.ids ? option.ids[i] : randomId() }

    const polygonGraphic = new PolygonGraphic(currentOption)
    const config = polygonGraphic.createPolygonPrimitive(positionsList[i])
    polygonInstance.push(config)
  }
  const polygonPrimitiveOpt = {
    geometryInstances: polygonInstance,
    appearance: new PerInstanceColorAppearance({
      translucent: true,
      flat: true,
    }),
  }
  const polygonPrimitive = boolTerrain
    ? new GroundPrimitive(polygonPrimitiveOpt)
    : new Primitive(polygonPrimitiveOpt)

  let polylinePrimitive
  if (outline) {
    const lineOption = isOptionArray
      ? option.map((opt) => {
          return Object.assign({}, opt, {
            color: opt.outlineColor,
            width: opt.outlineWidth,
          })
        })
      : Object.assign({}, option, {
          color: option.outlineColor,
          width: option.outlineWidth,
        })
    polylinePrimitive = addLinesAsPrimitives(positionsList, lineOption)
  }

  return { polygonPrimitive, polylinePrimitive }
}
