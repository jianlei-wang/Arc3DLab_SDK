import { Color, Event, Material, type JulianDate } from "cesium"

/** 雷达扫描材质的类型名。 */
export const RADAR_NORMAL_MATERIAL = "Arc3DRadarNormal"

const RADAR_NORMAL_SHADER = `
uniform vec4 color;
uniform float speed;

#define PI 3.14159265359

czm_material czm_getMaterial(czm_materialInput materialInput){
  czm_material material=czm_getDefaultMaterial(materialInput);
  vec2 st=materialInput.st;
  vec2 scrPt=st*2.-1.;
  float time=czm_frameNumber*speed/1000.;
  vec3 col=vec3(0.);
  mat2 rot;
  float theta=-time*1.*PI-2.2;
  float cosTheta,sinTheta;
  cosTheta=cos(theta);
  sinTheta=sin(theta);
  rot[0][0]=cosTheta;
  rot[0][1]=-sinTheta;
  rot[1][0]=sinTheta;
  rot[1][1]=cosTheta;
  vec2 scrPtRot=rot*scrPt;
  float angle=1.-(atan(scrPtRot.y,scrPtRot.x)/6.2831+.5);
  float falloff=length(scrPtRot);
  material.alpha=color.a*pow(length(col+vec3(.5)),5.);
  material.diffuse=(.5+pow(angle,2.)*falloff)*color.rgb;
  return material;
}
`

interface MaterialCacheLike {
  addMaterial(type: string, material: { fabric: Record<string, unknown> }): void
}

/**
 * 将雷达扫描材质注册到 Cesium 材质缓存。
 *
 * 重复调用是幂等的；当运行环境缺少材质缓存时静默跳过。
 */
export function registerRadarNormalMaterial(): void {
  const cache = (Material as unknown as { _materialCache?: MaterialCacheLike })
    ._materialCache
  if (!cache) return
  cache.addMaterial(RADAR_NORMAL_MATERIAL, {
    fabric: {
      type: RADAR_NORMAL_MATERIAL,
      uniforms: {
        color: new Color(1, 0, 0, 1),
        speed: 15,
      },
      source: RADAR_NORMAL_SHADER,
    },
  })
}

/**
 * 雷达扫描材质属性选项。
 */
export interface RadarNormalMaterialOptions {
  /** 扫描颜色，默认为 `#ff0000`。 */
  color?: string
  /** 扫描速度，默认为 15。 */
  speed?: number
}

/**
 * 雷达扫描材质属性，按时间驱动雷达光束旋转。
 */
export class RadarNormalMaterialProperty {
  private readonly definitionChangedEvent = new Event()
  private colorValue: Color
  private speedValue: number

  /**
   * 创建雷达扫描材质属性。
   * @param options - 颜色与速度。
   */
  constructor(options: RadarNormalMaterialOptions = {}) {
    this.colorValue =
      Color.fromCssColorString(options.color ?? "#ff0000") ?? Color.RED
    this.speedValue = options.speed ?? 15
  }

  /** 扫描颜色。 */
  get color(): Color {
    return this.colorValue
  }

  set color(value: Color) {
    this.colorValue = value
    this.definitionChangedEvent.raiseEvent(this, "color")
  }

  /** 扫描速度。 */
  get speed(): number {
    return this.speedValue
  }

  set speed(value: number) {
    this.speedValue = value
    this.definitionChangedEvent.raiseEvent(this, "speed")
  }

  /** 材质发生变化时触发的事件。 */
  get definitionChanged(): Event {
    return this.definitionChangedEvent
  }

  /** 该属性始终随时间变化。 */
  get isConstant(): boolean {
    return false
  }

  /**
   * 获取材质类型。
   * @returns 材质类型名。
   */
  getType(): string {
    return RADAR_NORMAL_MATERIAL
  }

  /**
   * 获取指定时间的材质值。
   * @param time - 当前时间。
   * @param result - 复用的结果对象。
   * @returns 材质 uniform 值。
   */
  getValue(
    _time?: JulianDate,
    result?: Record<string, unknown>,
  ): Record<string, unknown> {
    const target = result ?? {}
    target.color = this.colorValue
    target.speed = this.speedValue
    return target
  }

  /**
   * 判断与另一材质属性是否相等。
   * @param other - 另一材质属性。
   * @returns 相等时返回 true。
   */
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof RadarNormalMaterialProperty &&
        Color.equals(this.colorValue, other.colorValue) &&
        this.speedValue === other.speedValue)
    )
  }
}
