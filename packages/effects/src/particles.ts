import {
  Arc3DError,
  type Arc3DContext,
  type PositionInput,
} from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3 } from "@arc3dlab/engine-cesium"
import {
  BoxEmitter,
  Cartesian2,
  Cartesian3,
  CircleEmitter,
  Color,
  ConeEmitter,
  HeadingPitchRoll,
  Matrix3,
  Matrix4,
  ParticleSystem,
  Quaternion,
  SphereEmitter,
  Transforms,
  type Viewer,
} from "cesium"

/** 支持的粒子特效类型。 */
export type ParticleKind = "fire" | "water" | "explosion"

/** 粒子发射器形状。 */
export type ParticleEmitterShape = "cone" | "sphere" | "box" | "circle"

/** 粒子特效选项。 */
export interface ParticleOptions {
  /** 自定义粒子纹理（URL、data URI 或画布）；省略时按类型生成径向渐变纹理。 */
  image?: string
  /** 粒子图像尺寸，单位为像素。 */
  particleSize?: number
  /** 每秒发射的粒子数量。 */
  emissionRate?: number
  /** 粒子最短存活时间，单位为秒。 */
  minimumParticleLife?: number
  /** 粒子最长存活时间，单位为秒。 */
  maximumParticleLife?: number
  /** 粒子最小初速度。 */
  minimumSpeed?: number
  /** 粒子最大初速度。 */
  maximumSpeed?: number
  /** 生命周期起始缩放比例。 */
  startScale?: number
  /** 生命周期结束缩放比例。 */
  endScale?: number
  /** 粒子系统存活时间，单位为秒。 */
  lifetime?: number
  /** 重力加速度，负值向下。 */
  gravity?: number
  /** 粒子起始颜色（CSS 颜色）。 */
  startColor?: string
  /** 粒子结束颜色（CSS 颜色）。 */
  endColor?: string
  /** 发射器形状。 */
  emitter?: ParticleEmitterShape
  /** 是否循环发射。 */
  loop?: boolean
}

/** 补全后的粒子特效配置。 */
export interface ResolvedParticlePreset {
  /** 粒子图像尺寸，单位为像素。 */
  particleSize: number
  /** 每秒发射的粒子数量。 */
  emissionRate: number
  /** 粒子最短存活时间，单位为秒。 */
  minimumParticleLife: number
  /** 粒子最长存活时间，单位为秒。 */
  maximumParticleLife: number
  /** 粒子最小初速度。 */
  minimumSpeed: number
  /** 粒子最大初速度。 */
  maximumSpeed: number
  /** 生命周期起始缩放比例。 */
  startScale: number
  /** 生命周期结束缩放比例。 */
  endScale: number
  /** 粒子系统存活时间，单位为秒。 */
  lifetime: number
  /** 重力加速度，负值向下。 */
  gravity: number
  /** 粒子起始颜色（CSS 颜色）。 */
  startColor: string
  /** 粒子结束颜色（CSS 颜色）。 */
  endColor: string
  /** 发射器形状。 */
  emitter: ParticleEmitterShape
  /** 是否循环发射。 */
  loop: boolean
}

/** 各类型粒子特效的默认配置。 */
export const PARTICLE_PRESETS: Record<ParticleKind, ResolvedParticlePreset> = {
  fire: {
    particleSize: 5,
    emissionRate: 5,
    minimumParticleLife: 1,
    maximumParticleLife: 6,
    minimumSpeed: 1,
    maximumSpeed: 4,
    startScale: 0,
    endScale: 10,
    lifetime: 16,
    gravity: 0,
    startColor: "#ffffff",
    endColor: "rgba(128,0,0,0)",
    emitter: "cone",
    loop: true,
  },
  explosion: {
    particleSize: 25,
    emissionRate: 5,
    minimumParticleLife: 1,
    maximumParticleLife: 6,
    minimumSpeed: 1,
    maximumSpeed: 4,
    startScale: 0,
    endScale: 10,
    lifetime: 16,
    gravity: 0,
    startColor: "rgba(255,0,0,0.7)",
    endColor: "rgba(255,255,0,0.3)",
    emitter: "circle",
    loop: false,
  },
  water: {
    particleSize: 10,
    emissionRate: 150,
    minimumParticleLife: 25,
    maximumParticleLife: 30,
    minimumSpeed: 20,
    maximumSpeed: 21,
    startScale: 1,
    endScale: 5,
    lifetime: 16,
    gravity: -9.8,
    startColor: "rgba(255,255,255,0.6)",
    endColor: "rgba(204,219,255,0.4)",
    emitter: "circle",
    loop: true,
  },
}

const TEXTURE_RGB: Record<ParticleKind, [number, number, number]> = {
  fire: [255, 160, 40],
  explosion: [255, 210, 90],
  water: [140, 200, 255],
}

/**
 * 合并粒子特效选项与类型默认值。
 * @param kind - 粒子类型。
 * @param options - 用户选项。
 * @returns 补全后的粒子配置。
 */
export function resolveParticlePreset(
  kind: ParticleKind,
  options: ParticleOptions = {},
): ResolvedParticlePreset {
  const base = PARTICLE_PRESETS[kind]
  const result: ResolvedParticlePreset = { ...base }
  const overrides = options as Partial<ResolvedParticlePreset>
  for (const key of Object.keys(base) as Array<keyof ResolvedParticlePreset>) {
    const value = overrides[key]
    if (value !== undefined) {
      result[key] = value as never
    }
  }
  return result
}

/**
 * 获取粒子纹理，省略自定义纹理时在浏览器环境生成径向渐变画布。
 * @param image - 自定义纹理。
 * @param kind - 粒子类型，用于决定默认纹理颜色。
 * @returns 纹理字符串或画布元素。
 * @throws {Arc3DError} 当未提供纹理且当前环境不支持画布时抛出，错误码为 `UNSUPPORTED_CAPABILITY`。
 */
export function resolveParticleTexture(
  image: string | undefined,
  kind: ParticleKind,
): string | HTMLCanvasElement {
  if (image) return image
  if (typeof document === "undefined") {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "particle texture requires a DOM canvas or an explicit image",
    )
  }
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Arc3DError("ENGINE_FAILURE", "2D canvas context unavailable")
  }
  const [r, g, b] = TEXTURE_RGB[kind]
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`)
  gradient.addColorStop(0.4, `rgba(${r},${g},${b},0.6)`)
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvas
}

function createEmitter(
  shape: ParticleEmitterShape,
  radius: number,
): ConeEmitter | SphereEmitter | BoxEmitter | CircleEmitter {
  switch (shape) {
    case "sphere":
      return new SphereEmitter(radius)
    case "box":
      return new BoxEmitter(new Cartesian3(radius, radius, radius))
    case "circle":
      return new CircleEmitter(radius)
    default:
      return new ConeEmitter(radius)
  }
}

/**
 * 粒子特效句柄，封装粒子系统与宿主实体的生命周期。
 */
export class ParticleHandle {
  private destroyed = false

  /**
   * 创建粒子特效句柄。
   * @param viewer - Cesium 视图对象。
   * @param entityId - 承载粒子位置的实体 ID。
   * @param system - 粒子系统实例。
   * @param detach - 移除场景更新监听的函数。
   */
  constructor(
    private readonly viewer: Viewer,
    private readonly entityId: string,
    private readonly system: ParticleSystem,
    private readonly detach: () => void,
  ) {}

  /**
   * 设置粒子系统的显隐。
   * @param visible - 是否显示。
   */
  setVisible(visible: boolean): void {
    this.system.show = visible
  }

  /**
   * 判断粒子系统是否可见。
   * @returns 可见时返回 true。
   */
  get visible(): boolean {
    return this.system.show
  }

  /** 销毁粒子系统、宿主实体与更新监听。 */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.detach()
    this.viewer.scene.primitives.remove(this.system)
    this.viewer.entities.removeById(this.entityId)
  }
}

function assertUsable(context: Arc3DContext, action: string): void {
  context.lifecycle.assertUsable(action)
}

function createBaseSystem(
  context: Arc3DContext,
  position: Cartesian3,
  preset: ResolvedParticlePreset,
  texture: string | HTMLCanvasElement,
  emitter: ConeEmitter | SphereEmitter | BoxEmitter | CircleEmitter,
  emitterModelMatrix: Matrix4,
  updateCallback?: (
    particle: { position: Cartesian3; velocity: Cartesian3 },
    dt: number,
  ) => void,
): ParticleHandle {
  const viewer = getCesiumViewer(context.engine.native.viewer)
  viewer.clock.shouldAnimate = true
  const entity = viewer.entities.add({ position: position as never })
  const system = viewer.scene.primitives.add(
    new ParticleSystem({
      image: texture as never,
      startColor: Color.fromCssColorString(preset.startColor),
      endColor: Color.fromCssColorString(preset.endColor),
      startScale: preset.startScale,
      endScale: preset.endScale,
      minimumParticleLife: preset.minimumParticleLife,
      maximumParticleLife: preset.maximumParticleLife,
      minimumSpeed: preset.minimumSpeed,
      maximumSpeed: preset.maximumSpeed,
      imageSize: new Cartesian2(preset.particleSize, preset.particleSize),
      emissionRate: preset.emissionRate,
      lifetime: preset.lifetime,
      loop: preset.loop,
      sizeInMeters: true,
      emitter,
      updateCallback: updateCallback as never,
    }),
  )
  const listener = (): void => {
    system.modelMatrix = entity.computeModelMatrix(
      viewer.clock.currentTime,
      new Matrix4(),
    )
    system.emitterModelMatrix = emitterModelMatrix
  }
  viewer.scene.preUpdate.addEventListener(listener)
  return new ParticleHandle(viewer, entity.id, system, () =>
    viewer.scene.preUpdate.removeEventListener(listener),
  )
}

/**
 * 创建火焰粒子特效。
 * @param context - Arc3D 运行上下文。
 * @param position - 粒子位置。
 * @param options - 粒子选项。
 * @returns 粒子特效句柄。
 */
export function createFireParticle(
  context: Arc3DContext,
  position: PositionInput,
  options: ParticleOptions = {},
): ParticleHandle {
  assertUsable(context, "create fire particle")
  const preset = resolveParticlePreset("fire", options)
  const texture = resolveParticleTexture(options.image, "fire")
  const origin = toCartesian3(position)
  return createBaseSystem(
    context,
    origin,
    preset,
    texture,
    createEmitter(preset.emitter, Math.PI / 8),
    Matrix4.fromTranslation(new Cartesian3(0, 0, 1)),
  )
}

/**
 * 创建爆炸粒子特效。
 * @param context - Arc3D 运行上下文。
 * @param position - 粒子位置。
 * @param options - 粒子选项。
 * @returns 粒子特效句柄。
 */
export function createExplosionParticle(
  context: Arc3DContext,
  position: PositionInput,
  options: ParticleOptions = {},
): ParticleHandle {
  assertUsable(context, "create explosion particle")
  const preset = resolveParticlePreset("explosion", options)
  const texture = resolveParticleTexture(options.image, "explosion")
  const origin = toCartesian3(position)
  return createBaseSystem(
    context,
    origin,
    preset,
    texture,
    createEmitter(preset.emitter, 5),
    Matrix4.IDENTITY.clone(),
  )
}

function headingPitchToward(
  origin: Cartesian3,
  target: Cartesian3,
): {
  heading: number
  pitch: number
} {
  const enu = Transforms.eastNorthUpToFixedFrame(origin)
  const inverse = Matrix4.inverseTransformation(enu, new Matrix4())
  const local = Matrix4.multiplyByPoint(inverse, target, new Cartesian3())
  const horizontal = Math.hypot(local.x, local.y)
  return {
    heading: Math.atan2(local.x, local.y),
    pitch: Math.atan2(local.z, horizontal),
  }
}

/**
 * 创建水枪（弹道喷泉）粒子特效。
 * @param context - Arc3D 运行上下文。
 * @param source - 发射起点位置。
 * @param target - 目标位置，用于确定发射方向与初速度。
 * @param options - 粒子选项。
 * @returns 粒子特效句柄。
 */
export function createWaterGunParticle(
  context: Arc3DContext,
  source: PositionInput,
  target: PositionInput,
  options: ParticleOptions = {},
): ParticleHandle {
  assertUsable(context, "create water gun particle")
  const origin = toCartesian3(source)
  const goal = toCartesian3(target)
  const distance = Cartesian3.distance(origin, goal)
  const preset = resolveParticlePreset("water", {
    ...options,
    minimumSpeed: options.minimumSpeed ?? Math.ceil(distance / 5),
    maximumSpeed: options.maximumSpeed ?? Math.ceil(distance / 5) + 1,
  })
  const texture = resolveParticleTexture(options.image, "water")
  const { heading, pitch } = headingPitchToward(origin, goal)
  const hpr = new HeadingPitchRoll(heading, pitch, 0)
  const emitterModelMatrix = Matrix4.fromRotationTranslation(
    Matrix3.fromQuaternion(Quaternion.fromHeadingPitchRoll(hpr)),
    new Cartesian3(0, 0, 0.1),
  )
  const gravity = preset.gravity
  const scratch = new Cartesian3()
  const updateCallback = (
    particle: { position: Cartesian3; velocity: Cartesian3 },
    dt: number,
  ): void => {
    Cartesian3.normalize(particle.position, scratch)
    Cartesian3.multiplyByScalar(scratch, gravity * dt, scratch)
    particle.velocity = Cartesian3.add(
      particle.velocity,
      scratch,
      particle.velocity,
    )
  }
  return createBaseSystem(
    context,
    origin,
    preset,
    texture,
    createEmitter(preset.emitter, 2),
    emitterModelMatrix,
    updateCallback,
  )
}
