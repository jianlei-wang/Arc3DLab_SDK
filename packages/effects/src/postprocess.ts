import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { PostProcessStageLibrary } from "cesium"

export interface BloomOptions {
  sigma?: number
  delta?: number
  stepSize?: number
}

export interface DepthOfFieldOptions {
  focalDistance?: number
}

export interface FogOptions {
  density?: number
}

export interface ColorCorrectionOptions {
  brightness?: number
}

export interface StageLike {
  uniforms?: Record<string, number>
}

export interface PostProcessStageFactory {
  createBloom(options?: BloomOptions): StageLike
  createOutline(): StageLike
  createDepthOfField(options?: DepthOfFieldOptions): StageLike
  createColorCorrection(options?: ColorCorrectionOptions): StageLike
}

function applyUniforms(stage: StageLike, values: Record<string, number | undefined>): StageLike {
  if (!stage.uniforms) return stage
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) stage.uniforms[key] = value
  }
  return stage
}

export function createCesiumStageFactory(): PostProcessStageFactory {
  return {
    createBloom(options) {
      return applyUniforms(PostProcessStageLibrary.createBlurStage() as StageLike, {
        sigma: options?.sigma,
        delta: options?.delta,
        stepSize: options?.stepSize,
      })
    },
    createOutline() {
      return PostProcessStageLibrary.createSilhouetteStage() as StageLike
    },
    createDepthOfField(options) {
      return applyUniforms(PostProcessStageLibrary.createDepthOfFieldStage() as StageLike, {
        focalDistance: options?.focalDistance,
      })
    },
    createColorCorrection(options) {
      return applyUniforms(PostProcessStageLibrary.createBrightnessStage() as StageLike, {
        brightness: options?.brightness,
      })
    },
  }
}

export class PostProcessManager {
  private readonly stages = new Map<string, StageLike>()
  private readonly active = new Set<string>()
  private readonly factory: PostProcessStageFactory

  constructor(
    private readonly context: Arc3DContext,
    factory?: PostProcessStageFactory
  ) {
    this.factory = factory ?? createCesiumStageFactory()
  }

  setBloom(enabled: boolean, options?: BloomOptions): void {
    this.setStage("bloom", enabled, () => this.factory.createBloom(options))
  }

  setOutline(enabled: boolean): void {
    this.setStage("outline", enabled, () => this.factory.createOutline())
  }

  setDepthOfField(enabled: boolean, options?: DepthOfFieldOptions): void {
    this.setStage("depthOfField", enabled, () => this.factory.createDepthOfField(options))
  }

  setFog(enabled: boolean, options?: FogOptions): void {
    this.context.lifecycle.assertUsable("toggle fog")
    const fog = getCesiumViewer(this.context.engine.native.viewer).scene.fog
    fog.enabled = enabled
    if (options?.density !== undefined) fog.density = options.density
    if (enabled) this.active.add("fog")
    else this.active.delete("fog")
  }

  setColorCorrection(enabled: boolean, options?: ColorCorrectionOptions): void {
    this.setStage("colorCorrection", enabled, () => this.factory.createColorCorrection(options))
  }

  list(): string[] {
    return Array.from(this.active)
  }

  clear(): void {
    this.context.lifecycle.assertUsable("clear postprocess")
    this.removeAll()
  }

  destroy(): void {
    this.removeAll()
  }

  private setStage(name: string, enabled: boolean, create: () => StageLike): void {
    this.context.lifecycle.assertUsable(`toggle ${name}`)
    const collection = getCesiumViewer(this.context.engine.native.viewer).scene.postProcessStages
    const existing = this.stages.get(name)
    if (existing) {
      collection.remove(existing as never)
      this.stages.delete(name)
    }
    this.active.delete(name)
    if (!enabled) return
    const stage = create()
    collection.add(stage as never)
    this.stages.set(name, stage)
    this.active.add(name)
  }

  private removeAll(): void {
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    for (const stage of this.stages.values()) {
      viewer.scene.postProcessStages.remove(stage as never)
    }
    this.stages.clear()
    this.active.clear()
    viewer.scene.fog.enabled = false
  }
}
