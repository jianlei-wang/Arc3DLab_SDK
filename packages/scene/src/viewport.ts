import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

/**
 * 视口控制器，用于查询当前画布的尺寸。
 */
export class ViewportController {
  /**
   * 创建视口控制器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 当前画布的像素宽高。
   */
  get size(): { width: number; height: number } {
    this.context.lifecycle.assertUsable("use viewport")
    const canvas = getCesiumViewer(this.context.engine.native.viewer).canvas
    return { width: canvas.width, height: canvas.height }
  }
}
