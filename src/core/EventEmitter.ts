import { ScreenSpaceEventType, ScreenSpaceEventHandler, Viewer } from "cesium"

type Events = Map<EventType, Function[]>

/**
 * 事件发射器类，扩展了 Cesium 的 ScreenSpaceEventHandler 以支持多个回调函数。
 * 这允许为同一事件类型注册多个监听器。
 * 
 * @class CesiumEventEmitter
 * @example
 * ```typescript
 * import { CesiumEventEmitter } from "arc3dlab";
 * 
 * const eventEmitter = new CesiumEventEmitter(viewer);
 * eventEmitter.on('click', (movement) => {
 *   console.log('鼠标点击位置:', movement.position);
 * });
 * ```
 */
export class CesiumEventEmitter {
  /**
   * 创建新的 CesiumEventEmitter 实例
   * 
   * @param viewer - 要附加事件处理器的 Cesium 查看器实例
   */
  constructor(public viewer: Viewer) {}
  private handler = new ScreenSpaceEventHandler(this.viewer.canvas)
  
  /**
   * 存储事件类型及其关联的回调函数
   * @private
   */
  private events: Events = new Map()

  /**
   * 为特定事件类型注册事件监听器
   * 
   * @param eventName - 要监听的事件名称
   * @param callback - 事件发生时要调用的函数
   * @example
   * ```typescript
   * eventEmitter.on('click', (movement) => {
   *   console.log('鼠标点击位置:', movement.position);
   * });
   * ```
   */
  on(eventName: EventType, callback: Function): void {
    // 如果事件不存在，初始化一个空数组
    if (!this.events.has(eventName)) {
      this.events.set(eventName, [])
      this.handler.setInputAction((...args: any[]) => {
        const callbacks = this.events.get(eventName)
        callbacks?.forEach((callback) => {
          callback(...args)
        })
      }, eventNameMap[eventName])
    }
    // 将回调函数添加到事件列表中
    this.events.get(eventName)!.push(callback)
  }

  /**
   * 为特定事件类型移除事件监听器
   * 
   * @param eventName - 要移除监听器的事件名称
   * @param callback - 要移除的特定回调函数（可选，如果不提供，则移除该事件的所有回调）
   * @example
   * ```typescript
   * // 移除特定回调
   * eventEmitter.off('click', handleClick);
   * 
   * // 移除事件的所有回调
   * eventEmitter.off('click');
   * ```
   */
  off(eventName: EventType, callback?: Function): void {
    if (!this.events.has(eventName)) return

    if (callback) {
      // 移除指定的回调函数
      const callbacks = this.events.get(eventName)!
      const index = callbacks.indexOf(callback)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
    } else {
      // 移除所有回调函数
      this.events.delete(eventName)
    }
  }

  /**
   * 清除所有已注册的事件监听器
   * 
   * @example
   * ```typescript
   * eventEmitter.clear(); // 移除所有事件监听器
   * ```
   */
  clear(): void {
    this.events.clear()
  }
}

/**
 * 事件名称到 Cesium ScreenSpaceEventType 值的映射
 */
export const eventNameMap = {
  leftdown: ScreenSpaceEventType.LEFT_DOWN,
  leftup: ScreenSpaceEventType.LEFT_UP,
  click: ScreenSpaceEventType.LEFT_CLICK,
  dblclick: ScreenSpaceEventType.LEFT_DOUBLE_CLICK,

  rightdown: ScreenSpaceEventType.RIGHT_DOWN,
  rightup: ScreenSpaceEventType.RIGHT_UP,
  rightclick: ScreenSpaceEventType.RIGHT_CLICK,

  middledown: ScreenSpaceEventType.MIDDLE_DOWN,
  middleup: ScreenSpaceEventType.MIDDLE_UP,
  middleclick: ScreenSpaceEventType.MIDDLE_CLICK,

  mousemove: ScreenSpaceEventType.MOUSE_MOVE,
  wheel: ScreenSpaceEventType.WHEEL,

  pinchstart: ScreenSpaceEventType.PINCH_START,
  pinchend: ScreenSpaceEventType.PINCH_END,
  pinchmove: ScreenSpaceEventType.PINCH_MOVE,
}

/**
 * 表示所有可用事件类型的类型
 */
export type EventType = keyof typeof eventNameMap
