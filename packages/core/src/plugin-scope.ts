import { Arc3DError } from "./errors"
import type { Disposer } from "./disposer"

export type PluginState =
  "installing" | "installed" | "uninstalling" | "failed" | "disposed"

export interface PluginScope {
  readonly owner: string
  readonly state: PluginState
  track(disposer: Disposer): () => void
  readonly size: number
  dispose(): Promise<unknown[]>
}

class PluginScopeImpl implements PluginScope {
  private items: Disposer[] = []
  private current: PluginState = "installing"

  constructor(readonly owner: string) {}

  get state(): PluginState {
    return this.current
  }

  setState(state: PluginState): void {
    this.current = state
  }

  track(disposer: Disposer): () => void {
    this.items.push(disposer)
    return () => {
      const index = this.items.lastIndexOf(disposer)
      if (index >= 0) this.items.splice(index, 1)
    }
  }

  get size(): number {
    return this.items.length
  }

  async dispose(): Promise<unknown[]> {
    const pending = this.items.splice(0, this.items.length).reverse()
    const errors: unknown[] = []
    for (const disposer of pending) {
      try {
        await disposer()
      } catch (error) {
        errors.push(error)
      }
    }
    return errors
  }
}

export class PluginScopeManager {
  private scopes = new Map<string, PluginScopeImpl>()
  private activeOwner: string | undefined

  open(owner: string): PluginScope {
    if (owner === "core" || owner === "arc3dlab") {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Reserved plugin scope: ${owner}`,
      )
    }
    const scope = new PluginScopeImpl(owner)
    this.scopes.set(owner, scope)
    return scope
  }

  get(owner: string): PluginScope | undefined {
    return this.scopes.get(owner)
  }

  get owner(): string | undefined {
    return this.activeOwner
  }

  setActive(owner: string | undefined): void {
    this.activeOwner = owner
  }

  setState(owner: string, state: PluginState): void {
    this.scopes.get(owner)?.setState(state)
  }

  async close(owner: string): Promise<unknown[]> {
    const scope = this.scopes.get(owner)
    if (!scope) return []
    const errors = await scope.dispose()
    this.scopes.delete(owner)
    return errors
  }

  list(): string[] {
    return Array.from(this.scopes.keys())
  }
}

export function isPluginScope(
  value: PluginScope | undefined,
): value is PluginScope {
  return Boolean(value && typeof value.track === "function")
}
