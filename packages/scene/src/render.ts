import type { Arc3DContext, Unsubscribe } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

/**
 * 渲染控制器，用于调整渲染分辨率缩放与按需渲染模式。
 */
export class RenderController {
  /**
   * 创建渲染控制器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use render")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  /**
   * 设置渲染分辨率缩放比例。
   * @param value - 分辨率缩放系数，取值通常大于 0。
   */
  setResolutionScale(value: number): void {
    this.viewer().resolutionScale = value
  }

  /**
   * 开启或关闭按需渲染模式。
   *
   * 当存在活动的持续渲染需求（动画）时，实际渲染仍会被临时强制为持续
   * 渲染；需求全部解除后恢复到此处设置的基准模式。
   *
   * @param enabled - 是否仅在需要时渲染。
   */
  setRequestRenderMode(enabled: boolean): void {
    this.context.lifecycle.assertUsable("set request render mode")
    const viewer = this.context.engine.viewer
    if (viewer.setRequestRenderMode) {
      viewer.setRequestRenderMode(enabled)
      return
    }
    this.viewer().scene.requestRenderMode = enabled
  }

  /**
   * 当前是否处于按需渲染模式。
   *
   * 存在持续渲染需求时返回 false，因为此时引擎实际在持续渲染。
   *
   * @returns 按需渲染生效时返回 true。
   */
  get requestRenderMode(): boolean {
    return this.viewer().scene.requestRenderMode
  }

  /**
   * 声明一段需要持续渲染的动画需求。
   *
   * 雨雪、粒子、动态材质等依赖逐帧推进的效果在活动期间应持有该需求，
   * 返回的释放函数用于结束该需求。当不再存在任何需求时，引擎自动回到
   * 按需渲染模式，无需业务方处理底层渲染细节。
   *
   * @param reason - 需求来源说明，便于诊断。
   * @returns 释放该需求的函数。
   */
  acquireContinuousRender(reason = "animation"): Unsubscribe {
    this.context.lifecycle.assertUsable("acquire continuous render")
    const viewer = this.context.engine.viewer
    if (viewer.acquireContinuousRender) {
      return viewer.acquireContinuousRender(reason)
    }
    return () => {}
  }
}
