import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

export class EnvironmentController {
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use environment")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  setLighting(enabled: boolean): void {
    const viewer = this.viewer()
    viewer.scene.globe.enableLighting = enabled
    viewer.shadows = enabled
  }

  setAtmosphere(enabled: boolean): void {
    const atmosphere = this.viewer().scene.skyAtmosphere
    if (atmosphere) atmosphere.show = enabled
  }
}
