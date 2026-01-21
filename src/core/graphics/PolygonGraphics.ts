/**
 * @fileoverview 面图形类，扩展Cesium.PolygonGraphics，提供简化的参数接口
 */

import {
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  Entity,
  GeometryInstance,
  HeightReference,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonGraphics,
  PolygonHierarchy,
} from "cesium"

/**
 * 面选项接口
 * @interface PolygonOption
 * @extends {Omit<PolygonGraphics.ConstructorOptions, "outlineColor" | "outline">}
 * @property {string} [color="#ff0000"] - 面的颜色
 * @property {boolean} [onGround=true] - 是否贴地显示
 * @property {boolean} [outline=true] - 是否显示轮廓
 * @property {number} [outlineWidth=1] - 轮廓宽度
 * @property {string|Color} [outlineColor="#00ff00"] - 轮廓颜色
 * @property {string} [id="default_polygon_id"] - 面的ID
 * @property {object} [featureAttribute={}] - 要素属性
 * @property {number} [zIndex=0] - Z轴索引
 * @property {string[]} [ids] - 多个面的ID数组
 */
export interface PolygonOption
  extends Omit<PolygonGraphics.ConstructorOptions, "outlineColor" | "outline"> {
  color?: string
  onGround?: boolean
  outline?: boolean
  outlineWidth?: number
  outlineColor?: string | Color
  id?: string
  featureAttribute?: object
  zIndex?: number
  ids?: string[]
}

/**
 * 默认面选项配置
 * @constant {PolygonOption} defaultOptions
 */
const defaultOptions: PolygonOption = {
  color: "#ff0000",
  onGround: true,
  outline: true,
  outlineWidth: 1,
  outlineColor: "#00ff00",
  id: "default_polygon_id",
  featureAttribute: {},
  zIndex: 0,
  ids: [],
}

/**
 * 面图形类
 * 扩展Cesium的PolygonGraphics类，提供更简化的参数接口
 */
class PolygonGraphic extends PolygonGraphics {
  /**
   * 面选项配置
   * @type {PolygonOption}
   */
  options: PolygonOption
  
  /**
   * 构造函数
   * @param {PolygonOption} [options={}] 面选项配置
   */
  constructor(options: PolygonOption = {}) {
    const processedOptions = PolygonGraphic.processOptions(options)
    super(processedOptions)
    //@ts-ignore
    this.options = processedOptions
  }

  /**
   * 处理面选项配置
   * 将简化的参数转换为Cesium可识别的格式
   * @private
   * @static
   * @param {PolygonOption} options 用户提供的面选项
   * @returns {PolygonGraphics.ConstructorOptions} 处理后的面选项
   */
  private static processOptions(
    options: PolygonOption
  ): PolygonGraphics.ConstructorOptions {
    // First merge with defaults
    const mergedOptions = Object.assign({}, defaultOptions, options)


    // Create a new object for Cesium constructor that conforms to ConstructorOptions
    const cesiumOptions: any = {}

    // Copy all properties
    Object.keys(mergedOptions).forEach((key) => {
      if (key !== "color" && key !== "outlineColor" && key !== "onGround") {
        ;(cesiumOptions as any)[key] = (mergedOptions as any)[key]
      }
    })

    // Convert color from string to material
    if (mergedOptions.color && typeof mergedOptions.color === "string") {
      cesiumOptions.material = Color.fromCssColorString(mergedOptions.color)
    }

    // Convert outlineColor from string to Color
    if (
      mergedOptions.outlineColor &&
      typeof mergedOptions.outlineColor === "string"
    ) {
      cesiumOptions.outlineColor = Color.fromCssColorString(
        mergedOptions.outlineColor
      )
    }

    cesiumOptions.heightReference = mergedOptions.onGround
      ? HeightReference.CLAMP_TO_GROUND
      : HeightReference.NONE

    return cesiumOptions
  }

  /**
   * 创建Cesium实体
   * @param {Cartesian3[]} positions 面的位置数组
   * @param {any} [properties] 实体的附加属性
   * @returns {Entity} Cesium实体对象
   */
  createEntity(positions: Cartesian3[], properties?: any): Entity {
    const {
      outline,
      material,
      outlineColor,
      outlineWidth,
      featureAttribute,
      id,
      heightReference,
    } = this.options
    const entity = new Entity({
      polygon: {
        hierarchy: positions,
        material: material,
        heightReference: heightReference,
      },
      polyline: {
        show: outline,
        positions: positions,
        width: outlineWidth || 1,
        material: (outlineColor as Color) || Color.RED,
        clampToGround: heightReference === HeightReference.CLAMP_TO_GROUND,
      },
      properties: properties || featureAttribute,
      id: id,
    })

    return entity
  }

  /**
   * 创建面图元
   * @param {Cartesian3[]} positions 面的位置数组
   * @returns {any} 几何实例对象
   */
  createPolygonPrimitive(positions: Cartesian3[]): any {
    const { material, id } = this.options
    const polygonGeo = new PolygonGeometry({
      polygonHierarchy: new PolygonHierarchy(positions),
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    })
    const instance = new GeometryInstance({
      geometry: polygonGeo,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(material as Color),
      },
      id,
    })
    return instance
  }
}
export default PolygonGraphic
