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

  transition(next: LifecycleState): void {
    this.state = next
  }

  assertUsable(action: string): void {
    if (this.state === "destroyed" || this.state === "destroying") {
      throw new Arc3DError("APP_DESTROYED", `Cannot ${action} after Arc3DApp has been destroyed`)
    }
  }
}
