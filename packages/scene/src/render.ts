import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

export class RenderController {
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use render")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  setResolutionScale(value: number): void {
    this.viewer().resolutionScale = value
  }

  setRequestRenderMode(enabled: boolean): void {
    this.viewer().scene.requestRenderMode = enabled
  }
}
