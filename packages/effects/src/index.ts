import type { Arc3DContext } from "@arc3dlab/core"

export class EffectsManager {
  constructor(private readonly context: Arc3DContext) {}

  get materials(): Record<string, unknown> {
    this.context.lifecycle.assertUsable("use effects")
    return {}
  }
}
