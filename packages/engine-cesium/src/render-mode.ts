/**
 * 与 Cesium Scene 渲染模式相关字段兼容的最小接口。
 */
export interface RenderModeScene {
  /** 是否仅在需要时渲染。 */
  requestRenderMode: boolean
  /** 允许在空闲期间推进的最大模拟时间差，单位为秒。 */
  maximumRenderTimeChange: number
  /** 请求渲染一帧。 */
  requestRender(): void
}

/**
 * 渲染模式协调器，统一管理按需渲染基准模式与持续渲染需求。
 *
 * 默认启用按需渲染，并抑制单纯由模拟时间变化触发的渲染
 * （`maximumRenderTimeChange = Infinity`）。当存在活动的持续渲染需求时，
 * 协调器临时关闭按需渲染，确保雨雪、粒子、动态材质等依赖逐帧推进的动画
 * 在静态场景下仍能刷新；需求全部解除后自动恢复基准模式。这样业务方无需
 * 感知底层渲染细节。
 */
export class RenderModeCoordinator {
  private enabled = true
  private readonly demands = new Map<symbol, string>()

  /**
   * 创建渲染模式协调器，并立即应用初始模式。
   * @param scene - 目标场景对象。
   */
  constructor(private readonly scene: RenderModeScene) {
    this.apply()
  }

  /**
   * 设置按需渲染的基准模式。
   * @param enabled - 是否启用按需渲染。
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.apply()
  }

  /**
   * 声明一段需要持续渲染的动画需求。
   * @param reason - 需求来源说明，便于诊断。
   * @returns 释放该需求的函数。
   */
  acquire(reason = "animation"): () => void {
    const token = Symbol(reason)
    this.demands.set(token, reason)
    this.apply()
    return () => {
      if (!this.demands.delete(token)) return
      this.apply()
    }
  }

  /**
   * 当前实际是否处于按需渲染模式。
   *
   * 存在持续渲染需求时返回 false，因为此时场景在持续渲染。
   * @returns 按需渲染生效时返回 true。
   */
  get requestRenderMode(): boolean {
    return this.enabled && this.demands.size === 0
  }

  /** 当前活动的持续渲染需求数量。 */
  get activeDemandCount(): number {
    return this.demands.size
  }

  /** 清除全部持续渲染需求并恢复基准模式。 */
  dispose(): void {
    this.demands.clear()
    this.apply()
  }

  /**
   * 依据基准模式与活动需求计算并应用实际渲染模式。
   */
  private apply(): void {
    this.scene.requestRenderMode = this.enabled && this.demands.size === 0
    this.scene.maximumRenderTimeChange = Infinity
    this.scene.requestRender()
  }
}
