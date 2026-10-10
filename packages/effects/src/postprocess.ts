import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { PostProcessStage, PostProcessStageLibrary } from "cesium"

/**
 * 泛光（bloom）后处理的可选参数。
 */
export interface BloomOptions {
  /**
   * 高斯模糊的标准差。
   */
  sigma?: number
  /**
   * 采样步长缩放系数。
   */
  delta?: number
  /**
   * 采样步长。
   */
  stepSize?: number
}

/**
 * 景深（depth of field）后处理的可选参数。
 */
export interface DepthOfFieldOptions {
  /**
   * 对焦距离。
   */
  focalDistance?: number
}

/**
 * 雾效的可选参数。
 */
export interface FogOptions {
  /**
   * 雾的密度。
   */
  density?: number
}

/**
 * 色彩校正的可选参数。
 */
export interface ColorCorrectionOptions {
  /**
   * 亮度调整值。
   */
  brightness?: number
}

/**
 * 后处理阶段的通用抽象，暴露可选的 uniform 与启用状态。
 */
export interface StageLike {
  /**
   * 阶段使用的 uniform 数值表。
   */
  uniforms?: Record<string, number>
  /**
   * 阶段是否启用。
   */
  enabled?: boolean
}

/**
 * 后处理阶段工厂接口，用于创建各类内置后处理效果。
 */
export interface PostProcessStageFactory {
  /**
   * 创建泛光阶段。
   * @param options - 泛光可选参数
   * @returns 创建出的后处理阶段
   */
  createBloom(options?: BloomOptions): StageLike
  /**
   * 创建轮廓（silhouette）阶段。
   * @returns 创建出的后处理阶段
   */
  createOutline(): StageLike
  /**
   * 创建景深阶段。
   * @param options - 景深可选参数
   * @returns 创建出的后处理阶段
   */
  createDepthOfField(options?: DepthOfFieldOptions): StageLike
  /**
   * 创建色彩校正阶段。
   * @param options - 色彩校正可选参数
   * @returns 创建出的后处理阶段
   */
  createColorCorrection(options?: ColorCorrectionOptions): StageLike
}

const BLOOM_FRAGMENT_SHADER = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
uniform float sigma;
uniform float delta;
uniform float stepSize;
uniform float threshold;
void main() {
  vec2 texel = vec2(delta * stepSize) / vec2(textureSize(colorTexture, 0));
  vec4 base = texture(colorTexture, v_textureCoordinates);
  vec3 bloom = vec3(0.0);
  float total = 0.0;
  for (int x = -3; x <= 3; x++) {
    for (int y = -3; y <= 3; y++) {
      vec2 offset = vec2(float(x), float(y)) * texel;
      vec4 sampleColor = texture(colorTexture, v_textureCoordinates + offset);
      float luminance = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
      float weight = exp(-float(x * x + y * y) / (2.0 * sigma * sigma));
      bloom += sampleColor.rgb * weight * max(luminance - threshold, 0.0);
      total += weight;
    }
  }
  bloom /= max(total, 1.0);
  out_FragColor = vec4(base.rgb + bloom, base.a);
}
`

function applyUniforms(
  stage: StageLike,
  values: Record<string, number | undefined>,
): StageLike {
  if (!stage.uniforms) return stage
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) stage.uniforms[key] = value
  }
  return stage
}

/**
 * 创建基于 Cesium 的后处理阶段工厂。
 * @returns 使用 Cesium 内置阶段实现的后处理阶段工厂
 */
export function createCesiumStageFactory(): PostProcessStageFactory {
  return {
    createBloom(options) {
      const stage = new PostProcessStage({
        fragmentShader: BLOOM_FRAGMENT_SHADER,
        uniforms: {
          sigma: options?.sigma ?? 2.0,
          delta: options?.delta ?? 1.0,
          stepSize: options?.stepSize ?? 1.0,
          threshold: 0.6,
        },
      })
      return applyUniforms(stage as unknown as StageLike, {
        sigma: options?.sigma,
        delta: options?.delta,
        stepSize: options?.stepSize,
      })
    },
    createOutline() {
      return PostProcessStageLibrary.createSilhouetteStage() as StageLike
    },
    createDepthOfField(options) {
      return applyUniforms(
        PostProcessStageLibrary.createDepthOfFieldStage() as StageLike,
        {
          focalDistance: options?.focalDistance,
        },
      )
    },
    createColorCorrection(options) {
      return applyUniforms(
        PostProcessStageLibrary.createBrightnessStage() as StageLike,
        {
          brightness: options?.brightness,
        },
      )
    },
  }
}

/**
 * 后处理管理器，负责启用、配置与移除各类场景后处理效果。
 */
export class PostProcessManager {
  private readonly stages = new Map<string, StageLike>()
  private readonly active = new Set<string>()
  private readonly factory: PostProcessStageFactory

  /**
   * 创建后处理管理器实例。
   * @param context - Arc3D 运行时上下文
   * @param factory - 可选的阶段工厂，默认使用 Cesium 实现
   */
  constructor(
    private readonly context: Arc3DContext,
    factory?: PostProcessStageFactory,
  ) {
    this.factory = factory ?? createCesiumStageFactory()
  }

  /**
   * 启用或禁用泛光效果，并可更新其参数。
   * @param enabled - 是否启用
   * @param options - 泛光可选参数
   */
  setBloom(enabled: boolean, options?: BloomOptions): void {
    this.context.lifecycle.assertUsable("toggle bloom")
    const bloom = getCesiumViewer(this.context.engine.native.viewer).scene
      .postProcessStages.bloom as
      (StageLike & { enabled?: boolean }) | undefined
    if (bloom && typeof bloom === "object" && "enabled" in bloom) {
      bloom.enabled = enabled
      applyUniforms(bloom, {
        sigma: options?.sigma,
        delta: options?.delta,
        stepSize: options?.stepSize,
      })
      if (enabled) this.active.add("bloom")
      else this.active.delete("bloom")
      return
    }
    this.setStage("bloom", enabled, () => this.factory.createBloom(options))
  }

  /**
   * 启用或禁用轮廓效果。
   * @param enabled - 是否启用
   */
  setOutline(enabled: boolean): void {
    this.setStage("outline", enabled, () => this.factory.createOutline())
  }

  /**
   * 启用或禁用景深效果，并可更新其参数。
   * @param enabled - 是否启用
   * @param options - 景深可选参数
   */
  setDepthOfField(enabled: boolean, options?: DepthOfFieldOptions): void {
    this.setStage("depthOfField", enabled, () =>
      this.factory.createDepthOfField(options),
    )
  }

  /**
   * 启用或禁用雾效，并可更新其密度。
   * @param enabled - 是否启用
   * @param options - 雾效可选参数
   */
  setFog(enabled: boolean, options?: FogOptions): void {
    this.context.lifecycle.assertUsable("toggle fog")
    const fog = getCesiumViewer(this.context.engine.native.viewer).scene.fog
    fog.enabled = enabled
    if (options?.density !== undefined) fog.density = options.density
    if (enabled) this.active.add("fog")
    else this.active.delete("fog")
  }

  /**
   * 启用或禁用色彩校正效果，并可更新其参数。
   * @param enabled - 是否启用
   * @param options - 色彩校正可选参数
   */
  setColorCorrection(enabled: boolean, options?: ColorCorrectionOptions): void {
    this.setStage("colorCorrection", enabled, () =>
      this.factory.createColorCorrection(options),
    )
  }

  /**
   * 列出当前处于激活状态的后处理效果名称。
   * @returns 激活的后处理名称数组
   */
  list(): string[] {
    return Array.from(this.active)
  }

  /**
   * 清除全部后处理效果。
   */
  clear(): void {
    this.context.lifecycle.assertUsable("clear postprocess")
    this.removeAll()
  }

  /**
   * 销毁后处理管理器并移除全部效果。
   */
  destroy(): void {
    this.removeAll()
  }

  private setStage(
    name: string,
    enabled: boolean,
    create: () => StageLike,
  ): void {
    this.context.lifecycle.assertUsable(`toggle ${name}`)
    const collection = getCesiumViewer(this.context.engine.native.viewer).scene
      .postProcessStages
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
    const bloom = viewer.scene.postProcessStages.bloom as
      (StageLike & { enabled?: boolean }) | undefined
    if (bloom && typeof bloom === "object" && "enabled" in bloom) {
      bloom.enabled = false
    }
    for (const stage of this.stages.values()) {
      viewer.scene.postProcessStages.remove(stage as never)
    }
    this.stages.clear()
    this.active.clear()
    viewer.scene.fog.enabled = false
  }
}
