/**
 * @fileoverview 提供创建点要素的功能，支持Entity和Primitive两种形式
 */

import {
    Cartesian3,
    Entity,
    PointPrimitive,
    PointPrimitiveCollection,
} from "cesium"
import { randomId, safeCallback } from "../../utils/Generate"
import { PointOption, default as PointGraphic } from "../graphics/PointGraphics"

/**
 * 点回调函数类型定义
 * @typedef {Function} PointCallback
 * @param {any[]} points 处理前的点对象数组
 * @returns {any[]} 处理后的点对象数组
 */
type PointCallback = (points: any[]) => any[]

/**
 * 添加点-Entity形式
 * @function addPointsAsEntities
 * @param {Cartesian3[]} positions 点位置数组，笛卡尔坐标
 * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
 * @returns {Entity[]} 点对象数组，Entity类对象
 */
export function addPointsAsEntities(
    positions: Cartesian3[],
    option: PointOption | PointOption[],
): Entity[] {
    const entities: Entity[] = []

    // Check if option is an array or single object
    const isOptionArray = Array.isArray(option)

    for (let i = 0; i < positions.length; i++) {
        // Get the option for this specific point
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
 * 添加点-Primitive形式
 * @function addPointsAsPrimitives
 * @param {Cartesian3[]} positions 点位置，笛卡尔坐标
 * @param {PointOption | PointOption[]} option 点参数，可以是单个对象或对象数组
 * @returns {PointPrimitiveCollection} 点集合对象，PointPrimitiveCollection类对象
 */
export function addPointsAsPrimitives(
    positions: Cartesian3[],
    option: PointOption | PointOption[],
): PointPrimitiveCollection {
    const pointPrimitiveCollection = new PointPrimitiveCollection()


    // Check if option is an array or single object
    const isOptionArray = Array.isArray(option)

    for (let i = 0; i < positions.length; i++) {
        // Get the option for this specific point
        const currentOption = isOptionArray
            ? { ...option[i], id: option[i].id || randomId() }
            : { ...option, id: option.ids ? option.ids[i] : randomId() }

        const pointGraphic = new PointGraphic(currentOption)
        const primitive = pointGraphic.createPointPrimitive(positions[i])
        pointPrimitiveCollection.add(primitive)
    }

    return pointPrimitiveCollection
}