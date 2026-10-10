/** 取消事件订阅的回调函数。 */
export type Unsubscribe = () => void

/** 基于事件名分发负载的泛型事件总线。 */
export class EventBus<TEvents extends object> {
  private handlers = new Map<keyof TEvents, Set<(payload: never) => void>>()

  /**
   * 创建事件总线。
   *
   * @param options - 可选配置，包含处理函数出错时的回调。
   */
  constructor(
    private readonly options?: {
      onHandlerError?: (error: unknown, event: PropertyKey) => void
    },
  ) {}

  /**
   * 订阅指定事件。
   *
   * @param event - 事件名称。
   * @param handler - 事件处理函数。
   * @returns 取消该订阅的函数。
   */
  on<K extends keyof TEvents>(
    event: K,
    handler: (payload: TEvents[K]) => void,
  ): Unsubscribe {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as (payload: never) => void)
    return () => this.off(event, handler)
  }

  /**
   * 取消事件的订阅。
   *
   * @param event - 事件名称。
   * @param handler - 要移除的处理函数；省略时清除该事件的全部监听器。
   */
  off<K extends keyof TEvents>(
    event: K,
    handler?: (payload: TEvents[K]) => void,
  ): void {
    if (!handler) {
      this.handlers.delete(event)
      return
    }
    const set = this.handlers.get(event)
    set?.delete(handler as (payload: never) => void)
    if (set && set.size === 0) this.handlers.delete(event)
  }

  /**
   * 向指定事件的所有订阅者分发负载。
   *
   * @param event - 事件名称。
   * @param payload - 事件负载。
   */
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of Array.from(set)) {
      try {
        handler(payload as never)
      } catch (error) {
        this.options?.onHandlerError?.(error, event)
        if (event !== "error") this.emitError(error)
      }
    }
  }

  /** 清除全部事件监听器。 */
  clear(): void {
    this.handlers.clear()
  }

  /** 当前注册的事件监听器总数。 */
  get listenerCount(): number {
    let count = 0
    for (const set of this.handlers.values()) count += set.size
    return count
  }

  private emitError(error: unknown): void {
    const set = this.handlers.get("error" as keyof TEvents)
    if (!set) return
    const payload = {
      message: error instanceof Error ? error.message : String(error),
    }
    for (const handler of Array.from(set)) {
      try {
        handler(payload as never)
      } catch (nested) {
        this.options?.onHandlerError?.(nested, "error")
      }
    }
  }
}
