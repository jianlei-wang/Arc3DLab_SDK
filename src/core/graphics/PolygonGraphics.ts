/**
 * @fileoverview 面图形类，提供简化的参数接口来创建面要素
 */

import {
  Color,
  Cartesian3,
  Entity,
  PolygonHierarchy,
  PolygonGeometry,
  GeometryInstance,
  Primitive,
  PerInstanceColorAppearance,
  VertexFormat
} from "cesium";

/**
 * 面选项接口
 * @interface PolygonOption
 * @property {string} [pColor="#ff0000"] - 面的颜色
 * @property {string} [outlineColor="#ffffff"] - 面轮廓颜色
 * @property {number} [height=0] - 高度
 * @property {boolean} [show=true] - 是否显示
 * @property {string} [id] - 面的ID
 * @property {object} [featureAttribute={}] - 要素属性
 */
export interface PolygonOption {
  pColor?: string;
  outlineColor?: string;
  height?: number;
  show?: boolean;
  id?: string;
  featureAttribute?: object;
}

/**
 * 默认面选项配置
 * @constant {PolygonOption} defaultOptions
 */
const defaultOptions: PolygonOption = {
  pColor: "#ff0000",
  outlineColor: "#ffffff",
  height: 0,
  show: true,
  id: "default_polygon_id",
  featureAttribute: {},
};

/**
 * 面图形类
 * 提供更简化的参数接口来创建面要素
 */
class PolygonGraphic {
  /**
   * 面选项配置
   * @type {PolygonOption}
   */
  options: PolygonOption;

  /**
   * 构造函数
   * @param {PolygonOption} [options={}] 面选项配置
   */
  constructor(options: PolygonOption = {}) {
    const processedOptions = PolygonGraphic.processOptions(options);
    this.options = processedOptions;
  }

  /**
   * 处理面选项配置
   * 将简化的参数转换为Cesium可识别的格式
   * @private
   * @static
   * @param {PolygonOption} options 用户提供的面选项
   * @returns {PolygonOption} 处理后的面选项
   */
  private static processOptions(options: PolygonOption): PolygonOption {
    const finalOptions = Object.assign({}, defaultOptions, options);

    return finalOptions;
  }

  /**
   * 创建Cesium实体
   * @param {Cartesian3[]} positions 面的位置数组
   * @param {any} [properties] 实体的附加属性
   * @returns {Entity} Cesium实体对象
   */
  createEntity(positions: Cartesian3[], properties?: any): Entity {
    const entity = new Entity({
      polygon: {
        hierarchy: positions,
        material: Color.fromCssColorString(this.options.pColor || '#ff0000'),
        outline: true,
        outlineColor: Color.fromCssColorString(this.options.outlineColor || '#ffffff'),
        height: this.options.height,
        show: this.options.show,
      },
      properties: properties || this.options.featureAttribute,
      id: this.options.id,
    });

    return entity;
  }

  /**
   * 创建面图元
   * @param {Cartesian3[]} positions 面的位置数组
   * @returns {any} 面图元对象
   */
  createPolygonPrimitive(positions: Cartesian3[]) {
    // 返回用于创建 GeometryInstance 的配置信息
    return {
      hierarchy: new PolygonHierarchy(positions),
      material: Color.fromCssColorString(this.options.pColor || '#ff0000'),
      outline: true,
      outlineColor: Color.fromCssColorString(this.options.outlineColor || '#ffffff'),
      height: this.options.height,
      show: this.options.show,
      id: this.options.id,
    };
  }

  /**
   * 创建面几何体实例
   * @param {Cartesian3[]} positions 面的位置数组
   * @returns {GeometryInstance} 几何体实例
   */
  createPolygonGeometryInstance(positions: Cartesian3[]): GeometryInstance {
    return new GeometryInstance({
      geometry: new PolygonGeometry({
        polygonHierarchy: new PolygonHierarchy(positions),
        vertexFormat: this.options.height ? VertexFormat.POSITION_AND_NORMAL : VertexFormat.POSITION_ONLY,
      }),
      attributes: {
        color: Color.fromCssColorString(this.options.pColor || '#ff0000').withAlpha(0.5).toRgba(),
      },
      id: this.options.id,
    });
  }
}

export default PolygonGraphic;