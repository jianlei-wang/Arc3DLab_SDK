import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

/**
 * 环境控制器，用于控制地球光照、阴影与大气层的显示效果。
 */
export class EnvironmentController {
  /**
   * 创建环境控制器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use environment")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  /**
   * 开启或关闭地球光照及阴影效果。
   * @param enabled - 是否启用光照与阴影。
   */
  setLighting(enabled: boolean): void {
    const viewer = this.viewer()
    viewer.scene.globe.enableLighting = enabled
    viewer.shadows = enabled
  }

  /**
   * 开启或关闭大气层显示。
   * @param enabled - 是否显示大气层。
   */
  setAtmosphere(enabled: boolean): void {
    const atmosphere = this.viewer().scene.skyAtmosphere
    if (atmosphere) atmosphere.show = enabled
  }
}
