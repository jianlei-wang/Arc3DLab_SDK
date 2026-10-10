import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

export class ViewportController {
  constructor(private readonly context: Arc3DContext) {}

  get size(): { width: number; height: number } {
    this.context.lifecycle.assertUsable("use viewport")
    const canvas = getCesiumViewer(this.context.engine.native.viewer).canvas
    return { width: canvas.width, height: canvas.height }
  }
}
