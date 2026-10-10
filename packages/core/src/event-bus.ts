export type Unsubscribe = () => void

export class EventBus<TEvents extends object> {
  private handlers = new Map<keyof TEvents, Set<(payload: never) => void>>()

  constructor(
    private readonly options?: {
      onHandlerError?: (error: unknown, event: PropertyKey) => void
    },
  ) {}

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

  clear(): void {
    this.handlers.clear()
  }

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
