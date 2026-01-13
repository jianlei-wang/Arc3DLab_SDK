/**
 * @fileoverview 影像图层管理器，负责管理地图上的各种影像图层
 */

import { ImageryProvider } from "cesium"
import { Viewer } from "src/core/Viewer"

/**
 * 影像图层选项接口
 * @interface ImageryLayerOptions
 * @property {number} [index] - 图层索引位置
 * @property {number} [alpha] - 图层透明度 (0.0-1.0)
 * @property {number} [brightness] - 图层亮度
 * @property {number} [contrast] - 图层对比度
 * @property {boolean} [show] - 是否显示图层
 * @property {boolean} [isBaseLayer] - 是否为底图层
 */
interface ImageryLayerOptions {
  index?: number
  alpha?: number
  brightness?: number
  contrast?: number
  show?: boolean
  isBaseLayer?: boolean
}

/**
 * 影像图层管理器类
 * 提供对地图上各种影像图层的添加、删除、显示控制等功能
 */
class ImageryLayerManager {
  /** 存储影像图层信息的映射表 */
  imageryLayers: Map<any, any>

  /**
   * 构造函数
   * @param {Viewer} viewer 地图查看器实例
   */
  constructor(private viewer: Viewer) {
    this.imageryLayers = new Map()
  }

  /**
   * 添加影像图层
   * @param {string} name 图层名称
   * @param {ImageryProvider} provider 影像提供者
   * @param {ImageryLayerOptions} options 图层选项
   * @returns {Promise<any>} 返回添加的图层对象
   */
  async add(
    name: string,
    provider: ImageryProvider,
    options: ImageryLayerOptions = {}
  ) {
    const { index, alpha, brightness, contrast, show } = options
    const layer =
      index !== undefined
        ? this.viewer.imageryLayers.addImageryProvider(provider, index)
        : this.viewer.imageryLayers.addImageryProvider(provider)

    if (alpha !== undefined) layer.alpha = alpha
    if (brightness !== undefined) layer.brightness = brightness
    if (contrast !== undefined) layer.contrast = contrast
    if (show !== undefined) layer.show = show

    this.imageryLayers.set(name, { layer, provider, options })
    return layer
  }

  /**
   * 获取指定名称的影像图层
   * @param {string} name 图层名称
   * @returns {any} 影像图层对象，如果不存在则返回null
   */
  get(name: string) {
    const info = this.imageryLayers.get(name)
    return info ? info.layer : null
  }

  /**
   * 设置影像图层的可见性
   * @param {string} name 图层名称
   * @param {boolean} visible 是否可见
   */
  show(name: string, visible: boolean) {
    const layer = this.get(name)
    if (layer) layer.show = visible
  }

  /**
   * 设置影像图层的透明度
   * @param {string} name 图层名称
   * @param {number} alpha 透明度值 (0.0-1.0)
   */
  setAlpha(name: string, alpha: number) {
    const layer = this.get(name)
    if (layer) layer.alpha = alpha
  }

  /**
   * 移除指定名称的影像图层
   * @param {string} name 图层名称
   * @returns {boolean} 是否成功移除该图层，如果图层不存在则返回false，否则返回true
   */
  remove(name: string) {
    const info = this.imageryLayers.get(name)
    if (info) {
      this.viewer.imageryLayers.remove(info.layer, true)
      this.imageryLayers.delete(name)
      return true
    }
    return false
  }

  /**
   * 切换底图层
   * @param {string} name 要激活的底图层名称
   */
  switchBaseLayer(name: string) {
    // 检查目标图层是否存在
    const targetLayer = this.get(name)
    if (!targetLayer) {
      console.warn(`图层 ${name} 不存在`)
      return
    }

    // 将目标图层移动到底层（索引0），使其成为底图
    this.viewer.imageryLayers.lowerToBottom(targetLayer)

    // 确保只有标记为底图的图层处于最底层
    this.imageryLayers.forEach((info, layerName) => {
      if (info.options.isBaseLayer && layerName !== name) {
        // 将其他底图层移到目标图层之上
        this.viewer.imageryLayers.raise(info.layer)
      }
    })
  }

  /**
   * 清除所有影像图层
   */
  clear() {
    this.imageryLayers.forEach((info) => {
      this.viewer.imageryLayers.remove(info.layer, true)
    })
    this.imageryLayers.clear()
  }

  /**
   * 获取所有影像图层的名称列表
   * @returns {string[]} 影像图层名称数组
   */
  getIds() {
    return Array.from(this.imageryLayers.keys())
  }
}

export default ImageryLayerManager
