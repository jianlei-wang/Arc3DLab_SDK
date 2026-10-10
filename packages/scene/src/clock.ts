import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

/**
 * 时钟控制器，用于读取和设置 Cesium 场景时钟的播放倍速与动画开关。
 */
export class ClockController {
  /**
   * 创建时钟控制器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use clock")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  /**
   * 时钟的播放倍速，数值越大时间流逝越快。
   */
  set multiplier(value: number) {
    this.viewer().clock.multiplier = value
  }

  get multiplier(): number {
    return this.viewer().clock.multiplier
  }

  /**
   * 时钟是否正在自动推进时间。
   */
  set shouldAnimate(value: boolean) {
    this.viewer().clock.shouldAnimate = value
  }

  get shouldAnimate(): boolean {
    return this.viewer().clock.shouldAnimate
  }
}
