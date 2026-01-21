/**
 * @fileoverview 点图形类，扩展Cesium.PointGraphics，提供简化的参数接口
 */

import {
  PointGraphics,
  HeightReference,
  Color,
  Cartesian3,
  Entity,
  PointPrimitive,
  NearFarScalar,
} from "cesium"

/**
 * 点选项接口
 * @interface PointOption
 * @extends {PointGraphics.ConstructorOptions}
 * @property {string} [pColor="#ff0000"] - 点的颜色
 * @property {string} [pOutlineColor="#ffff00"] - 点轮廓颜色
 * @property {boolean} [onGround=true] - 是否贴地
 * @property {boolean} [allowPick=true] - 是否允许拾取
 * @property {string} [id="default_point_id"] - 点的ID
 * @property {object} [featureAttribute={}] - 要素属性
 * @property {number} [pixelSize=10] - 像素大小
 * @property {number} [outlineWidth=1] - 轮廓宽度
 * @property {number} [disableDepthTestDistance] - 禁用深度测试距离
 * @property {NearFarScalar} [scaleByDistance] - 基于距离缩放
 * @property {any} [pixelOffsetScaleByDistance] - 基于距离的像素偏移
 * @property {string} [image] - 图像路径
 * @property {string[]} [ids] - 多个点的ID数组
 */
export interface PointOption extends PointGraphics.ConstructorOptions {
  pColor?: string
  pOutlineColor?: string
  onGround?: boolean
  allowPick?: boolean
  id?: string
  featureAttribute?: object
  pixelSize?: number
  outlineWidth?: number
  disableDepthTestDistance?: number
  scaleByDistance?: NearFarScalar
  pixelOffsetScaleByDistance?: any
  image?: string
  ids?: string[]
}

/**
 * 默认点选项配置
 * @constant {PointOption} defaultOptions
 */
const defaultOptions: PointOption = {
  pColor: "#ff0000",
  pOutlineColor: "#ffff00",
  onGround: true,
  allowPick: true,
  pixelSize: 10,
  outlineWidth: 1,
  id: "default_point_id",
  featureAttribute: {},
}

/**
 * 点图形类
 * 扩展Cesium的PointGraphics类，提供更简化的参数接口
 */
class PointGraphic extends PointGraphics {
  /**
   * 点选项配置
   * @type {PointOption}
   */
  options: PointOption

  /**
   * 构造函数
   * @param {PointOption} [options={}] 点选项配置
   */
  constructor(options: PointOption = {}) {
    const processedOptions = PointGraphic.processOptions(options)
    super(processedOptions)
    this.options = processedOptions
  }

  /**
   * 处理点选项配置
   * 将简化的参数转换为Cesium可识别的格式
   * @private
   * @static
   * @param {PointOption} options 用户提供的点选项
   * @returns {PointOption} 处理后的点选项
   */
  private static processOptions(options: PointOption): PointOption {
    const finalOptions = Object.assign({}, defaultOptions, options)

    if (finalOptions.pColor && typeof finalOptions.pColor === "string") {
      finalOptions.color = Color.fromCssColorString(finalOptions.pColor)
    }

    if (
      finalOptions.pOutlineColor &&
      typeof finalOptions.pOutlineColor === "string"
    ) {
      finalOptions.outlineColor = Color.fromCssColorString(
        finalOptions.pOutlineColor
      )
    }

    if (finalOptions.onGround) {
      finalOptions.heightReference = HeightReference.CLAMP_TO_GROUND
    }

    return finalOptions
  }

  /**
   * 创建Cesium实体
   * @param {Cartesian3} position 点的位置
   * @param {any} [properties] 实体的附加属性
   * @returns {Entity} Cesium实体对象
   */
  createEntity(position: Cartesian3, properties?: any): Entity {
    const entity = new Entity({
      position: position,
      point: this,
      properties: properties || this.options.featureAttribute,
      id: this.options.id,
    })

    return entity
  }

  /**
   * 创建点图元
   * @param {Cartesian3} position 点的位置
   * @returns {PointPrimitive} 点图元对象
   */
  /**
   * 创建点图元
   * @param {Cartesian3} position 点的位置
   * @returns {PointPrimitive} 点图元对象
   */
  createPointPrimitive(position: Cartesian3): PointPrimitive {
    const pointPrimitive = {
      position: position,
      pixelSize: this.pixelSize?.getValue() || this.options.pixelSize,
      color: this.color?.getValue() || Color.RED,
      outlineColor: this.outlineColor?.getValue() || Color.YELLOW,
      outlineWidth: this.outlineWidth?.getValue() || this.options.outlineWidth,
      heightReference: this.options.onGround
        ? HeightReference.CLAMP_TO_GROUND
        : HeightReference.NONE,
      disableDepthTestDistance:
        this.disableDepthTestDistance?.getValue() ||
        this.options.disableDepthTestDistance,
      scaleByDistance:
        this.scaleByDistance?.getValue() || this.options.scaleByDistance,
      pixelOffsetScaleByDistance: this.options.pixelOffsetScaleByDistance,
      show: this.show?.getValue() || true,
      id: this.options.id,
    }

    return pointPrimitive as any
  }
}

export default PointGraphic
