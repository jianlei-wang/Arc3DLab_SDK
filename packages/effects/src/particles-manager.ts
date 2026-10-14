import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import {
  createExplosionParticle,
  createFireParticle,
  createWaterGunParticle,
  type ParticleHandle,
  type ParticleOptions,
} from "./particles"

/**
 * 粒子特效管理器，以运行时上下文创建火焰、爆炸与水枪三类粒子系统。
 */
export class ParticleManager {
  /**
   * 创建粒子特效管理器实例。
   * @param context - Arc3D 运行时上下文
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 在指定位置创建火焰粒子特效。
   * @param position - 粒子位置。
   * @param options - 粒子选项。
   * @returns 粒子特效句柄。
   */
  fire(position: PositionInput, options?: ParticleOptions): ParticleHandle {
    return createFireParticle(this.context, position, options)
  }

  /**
   * 在指定位置创建爆炸粒子特效。
   * @param position - 粒子位置。
   * @param options - 粒子选项。
   * @returns 粒子特效句柄。
   */
  explosion(
    position: PositionInput,
    options?: ParticleOptions,
  ): ParticleHandle {
    return createExplosionParticle(this.context, position, options)
  }

  /**
   * 创建从起点射向目标的水枪（弹道喷泉）粒子特效。
   * @param source - 发射起点位置。
   * @param target - 目标位置，用于确定发射方向与初速度。
   * @param options - 粒子选项。
   * @returns 粒子特效句柄。
   */
  waterGun(
    source: PositionInput,
    target: PositionInput,
    options?: ParticleOptions,
  ): ParticleHandle {
    return createWaterGunParticle(this.context, source, target, options)
  }
}
