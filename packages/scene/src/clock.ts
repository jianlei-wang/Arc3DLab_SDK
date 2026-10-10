import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

export class ClockController {
  constructor(private readonly context: Arc3DContext) {}

  private viewer() {
    this.context.lifecycle.assertUsable("use clock")
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  set multiplier(value: number) {
    this.viewer().clock.multiplier = value
  }

  get multiplier(): number {
    return this.viewer().clock.multiplier
  }

  set shouldAnimate(value: boolean) {
    this.viewer().clock.shouldAnimate = value
  }

  get shouldAnimate(): boolean {
    return this.viewer().clock.shouldAnimate
  }
}
