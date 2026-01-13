/**
 * @fileoverview 数据源管理器，负责管理地图上的各种数据源（GeoJSON、CZML、KML等）
 */

import { CzmlDataSource, GeoJsonDataSource, KmlDataSource } from "cesium"
import { Viewer } from "src/core/Viewer"

/**
 * 数据源管理器类
 * 提供对地图上各种数据源的添加、删除、显示控制等功能
 */
class DataSourceManager {
  /** 存储数据源信息的映射表 */
  sources: Map<any, any>

  /**
   * 构造函数
   * @param {Viewer} viewer 地图查看器实例
   */
  constructor(private viewer: Viewer) {
    this.sources = new Map()
  }

  /**
   * 添加GeoJSON数据源
   * @param {string} name 数据源名称
   * @param {string} url GeoJSON文件的URL地址
   * @param {GeoJsonDataSource.LoadOptions} [options={}] 加载选项
   * @returns {Promise<GeoJsonDataSource>} 返回加载完成的数据源对象
   */
  async addGeoJson(
    name: string,
    url: string,
    options: GeoJsonDataSource.LoadOptions
  ): Promise<GeoJsonDataSource> {
    const ds = await GeoJsonDataSource.load(url, options)
    return this._register(name, "geojson", ds)
  }

  /**
   * 添加CZML数据源
   * @param {string} name 数据源名称
   * @param {string} url CZML文件的URL地址
   * @returns {Promise<CzmlDataSource>} 返回加载完成的数据源对象
   */
  async addCzml(name: string, url: string): Promise<CzmlDataSource> {
    const ds = await CzmlDataSource.load(url)
    return this._register(name, "czml", ds)
  }

  /**
   * 添加KML数据源
   * @param {string} name 数据源名称
   * @param {string} url KML文件的URL地址
   * @returns {Promise<KmlDataSource>} 返回加载完成的数据源对象
   */
  async addKml(name: string, url: string): Promise<KmlDataSource> {
    const ds = await KmlDataSource.load(url, {
      camera: this.viewer.camera,
      canvas: this.viewer.canvas,
    })
    return this._register(name, "kml", ds)
  }

  /**
   * 内部注册逻辑（自动去重 + 添加到 viewer）
   */
  private _register(name: string, type: string, ds: any): any {
    this.sources.has(name) && this.remove(name)
    ds.name = name
    this.viewer.dataSources.add(ds)
    this.sources.set(name, { type, dataSource: ds })
    return ds
  }

  /**
   * 获取指定名称的数据源
   * @param {string} name 数据源名称
   * @returns {any} 数据源对象，如果不存在则返回null
   */
  get(name: string) {
    const info = this.sources.get(name)
    return info ? info.dataSource : null
  }

  /**
   * 控制指定数据源的显示/隐藏
   * @param {string} name 数据源名称
   * @param {boolean} visible 是否显示
   */
  show(name: string, visible: boolean) {
    const ds = this.get(name)
    if (ds) ds.show = visible
  }

  /**
   * 移除指定名称的数据源
   * @param {string} name 数据源名称
   * @returns {boolean} 是否成功移除
   */
  remove(name: string) {
    const info = this.sources.get(name)
    if (info) {
      this.viewer.dataSources.remove(info.dataSource, true)
      this.sources.delete(name)
      return true
    }
    return false
  }

  /**
   * 飞行到指定数据源的位置
   * @param {string} name 数据源名称
   * @param {number} duration 飞行持续时间（秒）
   */
  flyTo(name: string, duration: number) {
    const ds = this.get(name)
    if (ds) this.viewer.flyTo(ds, { duration })
  }

  /**
   * 清空所有数据源
   */
  clear() {
    this.sources.forEach((info, name) => {
      this.viewer.dataSources.remove(info.dataSource, true)
    })
    this.sources.clear()
  }

  /**
   * 获取所有数据源的名称列表
   * @returns {string[]} 数据源名称数组
   */
  getIds() {
    return Array.from(this.sources.keys())
  }
}

export default DataSourceManager
