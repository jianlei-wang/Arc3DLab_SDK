export type Unsubscribe = () => void

export class EventBus<TEvents extends object> {
  private handlers = new Map<keyof TEvents, Set<(payload: never) => void>>()

  on<K extends keyof TEvents>(
    event: K,
    handler: (payload: TEvents[K]) => void
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
    handler?: (payload: TEvents[K]) => void
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
      handler(payload as never)
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}
