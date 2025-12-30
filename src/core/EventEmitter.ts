import { ScreenSpaceEventHandler, Viewer } from "cesium"
import { Events, EventType } from "src/types"
import { EventNameMap } from "../utils/DefineObject"

class EventEmitter {
  /**
   * 创建事件处理器实例
   * @param {Viewer} viewer - Cesium 的视图器对象
   * @description
   * 基于 Cesium 的屏幕空间事件处理器扩展类，支持多回调函数管理
   * @example
   * const emitter = new EventEmitter(viewer);
   * emitter.on('leftClick', (event) => console.log('Clicked:', event.position));
   */
  constructor(public viewer: Viewer) {}

  /** @private 原生的 Cesium 屏幕空间事件处理器 */
  private handler = new ScreenSpaceEventHandler(this.viewer.canvas)

  /** @private 存储事件及其回调函数的映射表 */
  private events: Events = new Map()

  /**
   * 绑定指定事件类型的回调函数
   * @param {EventType} eventName - 要监听的事件名称（参见 eventNameMap 的键名）
   * @param {Function} callback - 事件触发时的回调函数
   * @throws {Error} 当 eventName 不是有效的事件类型时
   */
  on(eventName: EventType, callback: Function): void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, [])
      this.handler.setInputAction((...args: any[]) => {
        const callbacks = this.events.get(eventName)
        callbacks?.forEach((callback) => {
          callback(...args)
        })
      }, EventNameMap[eventName])
    }
    this.events.get(eventName)!.push(callback)
  }

  /**
   * 移除指定事件类型的回调函数
   * @param {EventType} eventName - 要移除的事件名称
   * @param {Function} [callback] - 要移除的特定回调函数（不传则移除该事件所有回调）
   */
  off(eventName: EventType, callback?: Function): void {
    if (!this.events.has(eventName)) return

    if (callback) {
      const callbacks = this.events.get(eventName)!
      const index = callbacks.indexOf(callback)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
    } else {
      this.events.delete(eventName)
    }
  }

  /**
   * 移除事件类型集
   * @param {Array<EventType>} eventNames 要移除的事件名称集合
   */
  offEvents(eventNames: EventType[] = []) {
    for (let index = 0; index < eventNames.length; index++) {
      const eventName = eventNames[index]
      this.events.has(eventName) && this.events.delete(eventName)
    }
  }

  /**
   * 清空所有已注册的事件和回调
   */
  clear(): void {
    this.events.clear()
  }
}

export default EventEmitter
