import type { Arc3DContext } from "@arc3dlab/core"
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
   * @param enabled - 是否仅在需要时渲染。
   */
  setRequestRenderMode(enabled: boolean): void {
    this.viewer().scene.requestRenderMode = enabled
  }
}
