import type { Unsubscribe } from "@arc3dlab/core"

/** 与 Cesium 事件对象兼容的最小可移除监听接口。 */
export interface RemovableEventListener {
  /**
   * 添加事件监听。
   * @param listener - 无参回调。
   */
  addEventListener(listener: () => void): void
  /**
   * 移除事件监听。
   * @param listener - 之前添加的回调。
   */
  removeEventListener(listener: () => void): void
}

/**
 * 渲染后回调控制器，用于在每帧渲染完成后执行自定义逻辑。
 */
export class PostRenderController {
  private readonly listeners = new Set<() => void>()

  /**
   * 创建渲染后回调控制器。
   * @param event - 场景的渲染后事件对象。
   */
  constructor(private readonly event: RemovableEventListener) {}

  /**
   * 注册渲染后回调。
   * @param listener - 无参回调。
   * @returns 用于取消订阅的函数。
   */
  on(listener: () => void): Unsubscribe {
    if (this.listeners.has(listener)) return () => this.off(listener)
    this.listeners.add(listener)
    this.event.addEventListener(listener)
    return () => this.off(listener)
  }

  /**
   * 移除渲染后回调。
   * @param listener - 之前注册的回调。
   */
  off(listener: () => void): void {
    if (!this.listeners.delete(listener)) return
    this.event.removeEventListener(listener)
  }

  /**
   * 销毁控制器并移除全部回调。
   */
  destroy(): void {
    for (const listener of this.listeners) {
      this.event.removeEventListener(listener)
    }
    this.listeners.clear()
  }
}
