import { Arc3DError } from "./errors"

/** Arc3D 应用的生命周期状态。 */
export type LifecycleState =
  "created" | "initializing" | "ready" | "destroying" | "destroyed"

/** 管理应用生命周期状态并校验状态迁移的控制器。 */
export class LifecycleManager {
  private state: LifecycleState = "created"

  /** 当前生命周期状态。 */
  get current(): LifecycleState {
    return this.state
  }

  /** 应用是否已就绪。 */
  get isReady(): boolean {
    return this.state === "ready"
  }

  /** 应用是否已销毁。 */
  get isDestroyed(): boolean {
    return this.state === "destroyed"
  }

  /** 应用是否处于销毁中或已销毁状态。 */
  get isTerminating(): boolean {
    return this.state === "destroying" || this.state === "destroyed"
  }

  /**
   * 将生命周期状态迁移到目标状态。
   *
   * @param next - 目标生命周期状态。
   * @throws {Arc3DError} 当迁移不被允许时抛出，错误码为 `INVALID_ARGUMENT`。
   */
  transition(next: LifecycleState): void {
    if (this.state === next && (next === "destroying" || next === "destroyed"))
      return
    const allowed = ALLOWED_TRANSITIONS[this.state]
    if (!allowed.includes(next)) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Invalid lifecycle transition: ${this.state} -> ${next}`,
      )
    }
    this.state = next
  }

  /**
   * 断言应用在给定操作下仍可用。
   *
   * @param action - 正在执行的操作名称，用于错误信息。
   * @throws {Arc3DError} 当应用处于销毁中或已销毁状态时抛出，错误码为 `APP_DESTROYED`。
   */
  assertUsable(action: string): void {
    if (this.isTerminating) {
      throw new Arc3DError(
        "APP_DESTROYED",
        `Cannot ${action} after Arc3DApp has been destroyed`,
      )
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
