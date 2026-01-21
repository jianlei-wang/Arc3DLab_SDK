/**
 * @fileoverview 折线图形类，扩展Cesium.PolylineGraphics，提供简化的参数接口
 */

import {
  Color,
  Entity,
  MaterialProperty,
  PolylineGraphics,
  Cartesian3,
  GeometryInstance,
  GroundPolylineGeometry,
  ColorGeometryInstanceAttribute,
  PolylineGeometry,
  PerInstanceColorAppearance,
} from "cesium"

/**
 * 折线选项接口
 * @interface PolylineOption
 * @extends {PolylineGraphics.ConstructorOptions}
 * @property {string|Color} [color="#ff0f40"] - 折线颜色
 * @property {number} [width=2] - 折线宽度
 * @property {boolean} [onGround=true] - 是否贴地显示
 * @property {boolean} [allowPick=true] - 是否允许拾取
 * @property {string} [id="default_polyline_id"] - 折线ID
 * @property {object} [featureAttribute={}] - 要素属性
 * @property {MaterialProperty|Color} [material] - 材质属性
 * @property {number} [zIndex=0] - Z轴索引
 * @property {string[]} [ids] - 多个折线的ID数组
 */
export interface PolylineOption extends PolylineGraphics.ConstructorOptions {
  color?: string | Color
  width?: number
  onGround?: boolean
  allowPick?: boolean
  id?: string
  featureAttribute?: object
  material?: MaterialProperty | Color
  zIndex?: number
  ids?: string[]
}

/**
 * 默认折线选项配置
 * @constant {PolylineOption} defaultOptions
 */
const defaultOptions: PolylineOption = {
  color: "#ff0f40",
  width: 2,
  onGround: true,
  allowPick: true,
  id: "default_polyline_id",
  featureAttribute: {},
  zIndex: 0,
  material: Color.WHITE,
  ids: [],
}

/**
 * 折线图形类
 * 扩展Cesium的PolylineGraphics类，提供更简化的参数接口
 */
class PolylineGraphic extends PolylineGraphics {
  /**
   * 折线选项配置
   * @type {PolylineOption}
   */
  options: PolylineOption
  
  /**
   * 构造函数
   * @param {PolylineOption} [options={}] 折线选项配置
   */
  constructor(options: PolylineOption = {}) {
    const processedOptions = PolylineGraphic.processOptions(options)
    super(processedOptions)
    this.options = processedOptions
  }

  /**
   * 处理折线选项配置
   * 将简化的参数转换为Cesium可识别的格式
   * @private
   * @static
   * @param {PolylineOption} options 用户提供的折线选项
   * @returns {PolylineOption} 处理后的折线选项
   */
  private static processOptions(options: PolylineOption): PolylineOption {
    const finalOptions = Object.assign({}, defaultOptions, options)
    if (finalOptions.color && typeof finalOptions.color === "string") {
      finalOptions.material = Color.fromCssColorString(finalOptions.color)
    } else {
      finalOptions.material = finalOptions.color as Color
    }

    finalOptions.clampToGround = finalOptions.onGround

    return finalOptions
  }
  /**
   * 创建Cesium实体
   * @param {Cartesian3[]} positions 折线的位置数组
   * @param {any} [properties] 实体的附加属性
   * @returns {Entity} Cesium实体对象
   */
  createEntity(positions: Cartesian3[], properties?: any): Entity {
    const entity = new Entity({
      polyline: {
        positions: positions,
        ...this.options,
      },
      properties: properties || this.options.featureAttribute,
      id: this.options.id,
    })
    return entity
  }

  /**
   * 创建折线图元
   * @param {Cartesian3[]} positions 折线的位置数组
   * @returns {any} 几何实例对象
   */
  createPrimitive(positions: Cartesian3[]) {
    const { clampToGround, material, width, id } = this.options
    const geoOtp = {
      positions,
      width,
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    }
    const lineGeo = clampToGround
      ? new GroundPolylineGeometry(geoOtp)
      : new PolylineGeometry(geoOtp)
    const instance = new GeometryInstance({
      geometry: lineGeo,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(material as Color),
      },
      id,
    })
    return instance
  }
}
export default PolylineGraphic
