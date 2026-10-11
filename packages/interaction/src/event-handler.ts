import type { Arc3DContext, Unsubscribe } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from "cesium"
import type { ScreenEventName } from "./event-names"

/** 屏幕坐标点。 */
export interface ScreenPoint {
  /** 水平像素坐标。 */
  x: number
  /** 垂直像素坐标。 */
  y: number
}

/** 屏幕事件负载，按事件类型携带位置信息。 */
export interface ScreenEventPayload {
  /** 点击或滚轮事件的屏幕位置。 */
  position?: ScreenPoint
  /** 拖拽或捏合事件的起始位置。 */
  startPosition?: ScreenPoint
  /** 拖拽或捏合事件的结束位置。 */
  endPosition?: ScreenPoint
}

/** 屏幕事件处理函数。 */
export type ScreenEventHandler = (payload: ScreenEventPayload) => void

const EVENT_TYPES: Record<ScreenEventName, ScreenSpaceEventType> = {
  leftDown: ScreenSpaceEventType.LEFT_DOWN,
  leftUp: ScreenSpaceEventType.LEFT_UP,
  leftClick: ScreenSpaceEventType.LEFT_CLICK,
  leftDoubleClick: ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  rightDown: ScreenSpaceEventType.RIGHT_DOWN,
  rightUp: ScreenSpaceEventType.RIGHT_UP,
  rightClick: ScreenSpaceEventType.RIGHT_CLICK,
  middleDown: ScreenSpaceEventType.MIDDLE_DOWN,
  middleUp: ScreenSpaceEventType.MIDDLE_UP,
  middleClick: ScreenSpaceEventType.MIDDLE_CLICK,
  wheel: ScreenSpaceEventType.WHEEL,
  mouseMove: ScreenSpaceEventType.MOUSE_MOVE,
  pinchStart: ScreenSpaceEventType.PINCH_START,
  pinchMove: ScreenSpaceEventType.PINCH_MOVE,
  pinchEnd: ScreenSpaceEventType.PINCH_END,
}

/**
 * 屏幕事件控制器，按语义化事件名注册画布输入监听。
 */
export class ScreenEventController {
  private readonly handler: ScreenSpaceEventHandler
  private readonly listeners = new Map<
    ScreenEventName,
    Set<ScreenEventHandler>
  >()

  /**
   * 创建屏幕事件控制器并绑定画布。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {
    const viewer = getCesiumViewer(context.engine.native.viewer)
    this.handler = new ScreenSpaceEventHandler(viewer.canvas)
  }

  /**
   * 注册屏幕事件监听。
   * @param name - 语义化事件名称。
   * @param listener - 事件处理函数。
   * @returns 用于取消订阅的函数。
   */
  on(name: ScreenEventName, listener: ScreenEventHandler): Unsubscribe {
    this.context.lifecycle.assertUsable("register screen event")
    let set = this.listeners.get(name)
    if (!set) {
      set = new Set()
      this.listeners.set(name, set)
      this.handler.setInputAction(
        (movement: unknown) => this.dispatch(name, movement),
        EVENT_TYPES[name],
      )
    }
    set.add(listener)
    return () => this.off(name, listener)
  }

  /**
   * 移除屏幕事件监听，未提供处理函数时移除该事件的全部监听。
   * @param name - 语义化事件名称。
   * @param listener - 可选的事件处理函数。
   */
  off(name: ScreenEventName, listener?: ScreenEventHandler): void {
    const set = this.listeners.get(name)
    if (!set) return
    if (listener) {
      set.delete(listener)
      if (set.size > 0) return
    } else {
      set.clear()
    }
    this.listeners.delete(name)
    if (!this.handler.isDestroyed()) {
      this.handler.removeInputAction(EVENT_TYPES[name])
    }
  }

  /**
   * 销毁控制器，移除全部输入动作并释放画布句柄。
   */
  destroy(): void {
    if (!this.handler.isDestroyed()) this.handler.destroy()
    this.listeners.clear()
  }

  private dispatch(name: ScreenEventName, movement: unknown): void {
    const set = this.listeners.get(name)
    if (!set || set.size === 0) return
    const payload = normalizeMovement(movement)
    for (const listener of Array.from(set)) listener(payload)
  }
}

function normalizeMovement(movement: unknown): ScreenEventPayload {
  if (!movement || typeof movement !== "object") return {}
  const source = movement as Record<string, unknown>
  return {
    position: toScreenPoint(source.position),
    startPosition: toScreenPoint(source.startPosition),
    endPosition: toScreenPoint(source.endPosition),
  }
}

function toScreenPoint(value: unknown): ScreenPoint | undefined {
  if (!value || typeof value !== "object") return undefined
  const point = value as { x?: unknown; y?: unknown }
  if (typeof point.x !== "number" || typeof point.y !== "number")
    return undefined
  return { x: point.x, y: point.y }
}
