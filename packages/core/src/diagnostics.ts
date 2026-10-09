import type { Arc3DContext } from "./context"
import type { LifecycleState } from "./lifecycle"

export interface RuntimeDiagnostics {
  lifecycle: LifecycleState
  resources: Record<string, number>
  disposerCount: number
  listenerCount: number
  trackedParents: number
}

export function getRuntimeDiagnostics(context: Arc3DContext): RuntimeDiagnostics {
  const resources: Record<string, number> = {}
  for (const item of context.registry.values()) {
    resources[item.type] = (resources[item.type] ?? 0) + 1
  }
  return {
    lifecycle: context.lifecycle.current,
    resources,
    disposerCount: context.disposers.size,
    listenerCount: context.events.listenerCount,
    trackedParents: context.tracker.size,
  }
}
