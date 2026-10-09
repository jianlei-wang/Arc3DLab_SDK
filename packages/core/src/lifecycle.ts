import { Arc3DError } from "./errors"

export type LifecycleState =
  | "created"
  | "initializing"
  | "ready"
  | "destroying"
  | "destroyed"

export class LifecycleManager {
  private state: LifecycleState = "created"

  get current(): LifecycleState {
    return this.state
  }

  get isReady(): boolean {
    return this.state === "ready"
  }

  get isDestroyed(): boolean {
    return this.state === "destroyed"
  }

  get isTerminating(): boolean {
    return this.state === "destroying" || this.state === "destroyed"
  }

  transition(next: LifecycleState): void {
    if (this.state === next && (next === "destroying" || next === "destroyed")) return
    const allowed = ALLOWED_TRANSITIONS[this.state]
    if (!allowed.includes(next)) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Invalid lifecycle transition: ${this.state} -> ${next}`
      )
    }
    this.state = next
  }

  assertUsable(action: string): void {
    if (this.isTerminating) {
      throw new Arc3DError("APP_DESTROYED", `Cannot ${action} after Arc3DApp has been destroyed`)
    }
  }
}

const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  created: ["initializing", "destroying"],
  initializing: ["ready", "destroying"],
  ready: ["destroying"],
  destroying: ["destroyed"],
  destroyed: [],
}
