import { ScreenSpaceEventType, ScreenSpaceEventHandler, Viewer } from "cesium"

type Events = Map<EventType, Function[]>

//基于Cesium的ScreenSpaceEventHandler拓展，使其支持回调列表；
export class CesiumEventEmitter {
  constructor(public viewer: Viewer) {}
  private handler = new ScreenSpaceEventHandler(this.viewer.canvas)
  // 用于存储事件及其回调函数的映射
  private events: Events = new Map()

  /**
   * 绑定事件
   * @param eventName 事件名称
   * @param callback 回调函数
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
   * 取消绑定事件
   * @param eventName 事件名称
   * @param callback 要移除的回调函数（可选）
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
   * 清空所有事件
   */
  clear(): void {
    this.events.clear()
  }
}

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

export type EventType = keyof typeof eventNameMap
