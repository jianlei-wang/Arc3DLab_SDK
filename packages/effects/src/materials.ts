import { Color, Event, JulianDate, Material } from "cesium"

/** 动态扩散材质的类型名。 */
export const DYNAMIC_SPREAD_MATERIAL = "Arc3DDynamicSpread"
/** 线尾迹流动材质的类型名。 */
export const POLYLINE_TRAIL_MATERIAL = "Arc3DPolylineTrailLink"

const DYNAMIC_SPREAD_SHADER = `
czm_material czm_getMaterial(czm_materialInput materialInput){
  czm_material material=czm_getDefaultMaterial(materialInput);
  vec2 st=materialInput.st;
  float per=fract(time);
  float dis=distance(st,vec2(.5));
  if(dis*2.>per){
    discard;
  }else{
    material.alpha=pow(color.a*dis*2./per,gradient);
    material.diffuse=color.rgb;
  }
  return material;
}
`

const POLYLINE_TRAIL_SHADER = `
czm_material czm_getMaterial(czm_materialInput materialInput){
  czm_material material=czm_getDefaultMaterial(materialInput);
  vec2 st=materialInput.st;
  vec4 colorImage=texture(image,vec2(fract(st.s-time),st.t));
  material.alpha=colorImage.a*color.a;
  float factor=colorImage.a;
  material.diffuse=mix(color.rgb,colorImage.rgb,factor);
  return material;
}
`

interface MaterialCacheLike {
  addMaterial(type: string, material: { fabric: Record<string, unknown> }): void
}

/**
 * 将 Arc3D 内置材质注册到 Cesium 材质缓存。
 *
 * 重复调用是幂等的；当运行环境缺少材质缓存时静默跳过。
 */
export function registerArc3DMaterials(): void {
  const cache = (Material as unknown as { _materialCache?: MaterialCacheLike })
    ._materialCache
  if (!cache) return
  cache.addMaterial(DYNAMIC_SPREAD_MATERIAL, {
    fabric: {
      type: DYNAMIC_SPREAD_MATERIAL,
      uniforms: {
        color: new Color(1, 0, 0, 1),
        time: 0,
        gradient: 4,
      },
      source: DYNAMIC_SPREAD_SHADER,
    },
  })
  cache.addMaterial(POLYLINE_TRAIL_MATERIAL, {
    fabric: {
      type: POLYLINE_TRAIL_MATERIAL,
      uniforms: {
        color: new Color(1, 0, 0, 1),
        image: "",
        time: 0,
      },
      source: POLYLINE_TRAIL_SHADER,
    },
  })
}

/** 动态扩散材质的选项。 */
export interface DynamicSpreadMaterialOptions {
  /** 图形颜色（CSS 颜色）。 */
  color?: string
  /** 渐变强度，值越大渐变越明显。 */
  gradient?: number
  /** 动画周期，单位为毫秒，值越小扩散越快。 */
  duration?: number
}

/** 承载材质取值的结果对象。 */
export interface MaterialValueResult {
  /** 材质颜色。 */
  color?: Color
  /** 动画时间，单位为周期数。 */
  time?: number
  /** 渐变强度。 */
  gradient?: number
  /** 纹理图像。 */
  image?: string
}

/**
 * 动态扩散材质属性，产生自中心向外扩散并淡出的动画，适用于点、线、面、体。
 */
export class DynamicSpreadMaterialProperty {
  private readonly definitionChangedEvent = new Event()
  private epoch: JulianDate | undefined
  private readonly colorValue: Color
  private gradientValue: number
  private durationValue: number

  /**
   * 创建动态扩散材质属性。
   * @param options - 材质选项。
   */
  constructor(options: DynamicSpreadMaterialOptions = {}) {
    this.colorValue = Color.fromCssColorString(options.color ?? "#ff0000")
    this.gradientValue = options.gradient ?? 4
    this.durationValue = options.duration ?? 1000
  }

  /** 图形颜色。 */
  get color(): Color {
    return this.colorValue
  }

  /** 渐变强度。 */
  get gradient(): number {
    return this.gradientValue
  }

  set gradient(value: number) {
    this.gradientValue = value
    this.definitionChangedEvent.raiseEvent(this, "gradient", value)
  }

  /** 动画周期，单位为毫秒。 */
  get duration(): number {
    return this.durationValue
  }

  set duration(value: number) {
    this.durationValue = value
    this.definitionChangedEvent.raiseEvent(this, "duration", value)
  }

  /** 属性定义变化事件。 */
  get definitionChanged(): Event {
    return this.definitionChangedEvent
  }

  /** 属性是否为常量。 */
  get isConstant(): boolean {
    return false
  }

  /**
   * 返回属性所属的材质类型。
   * @returns 材质类型名。
   */
  getType(): string {
    return DYNAMIC_SPREAD_MATERIAL
  }

  /**
   * 计算指定时刻的材质取值。
   * @param time - 当前时刻。
   * @param result - 可选的结果对象。
   * @returns 材质取值。
   */
  getValue(
    time: JulianDate,
    result?: MaterialValueResult,
  ): MaterialValueResult {
    const value: MaterialValueResult = result ?? {}
    value.color = this.colorValue
    if (this.epoch === undefined) this.epoch = JulianDate.clone(time)
    value.time =
      (JulianDate.secondsDifference(time, this.epoch) * 1000) /
      this.durationValue
    value.gradient = this.gradientValue
    return value
  }

  /**
   * 判断与另一属性是否相等。
   * @param other - 另一属性。
   * @returns 相等时返回 true。
   */
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof DynamicSpreadMaterialProperty &&
        Color.equals(this.colorValue, other.colorValue) &&
        this.gradientValue === other.gradientValue &&
        this.durationValue === other.durationValue)
    )
  }
}

/** 线尾迹流动材质的选项。 */
export interface PolylineTrailMaterialOptions {
  /** 与纹理混合的颜色（CSS 颜色）。 */
  color?: string
  /** 流动纹理（URL 或 data URI）。 */
  image?: string
  /** 动画周期，单位为毫秒。 */
  duration?: number
}

/**
 * 线尾迹流动材质属性，沿线要素方向播放纹理动画。
 */
export class PolylineTrailMaterialProperty {
  private readonly definitionChangedEvent = new Event()
  private epoch: JulianDate | undefined
  private readonly colorValue: Color
  private imageValue: string
  private durationValue: number

  /**
   * 创建线尾迹流动材质属性。
   * @param options - 材质选项。
   */
  constructor(options: PolylineTrailMaterialOptions = {}) {
    this.colorValue = Color.fromCssColorString(options.color ?? "#ff0000")
    this.imageValue = options.image ?? ""
    this.durationValue = options.duration ?? 1000
  }

  /** 材质颜色。 */
  get color(): Color {
    return this.colorValue
  }

  /** 流动纹理。 */
  get image(): string {
    return this.imageValue
  }

  set image(value: string) {
    this.imageValue = value
    this.definitionChangedEvent.raiseEvent(this, "image", value)
  }

  /** 动画周期，单位为毫秒。 */
  get duration(): number {
    return this.durationValue
  }

  set duration(value: number) {
    this.durationValue = value
    this.definitionChangedEvent.raiseEvent(this, "duration", value)
  }

  /** 属性定义变化事件。 */
  get definitionChanged(): Event {
    return this.definitionChangedEvent
  }

  /** 属性是否为常量。 */
  get isConstant(): boolean {
    return false
  }

  /**
   * 返回属性所属的材质类型。
   * @returns 材质类型名。
   */
  getType(): string {
    return POLYLINE_TRAIL_MATERIAL
  }

  /**
   * 计算指定时刻的材质取值。
   * @param time - 当前时刻。
   * @param result - 可选的结果对象。
   * @returns 材质取值。
   */
  getValue(
    time: JulianDate,
    result?: MaterialValueResult,
  ): MaterialValueResult {
    const value: MaterialValueResult = result ?? {}
    value.color = this.colorValue
    if (this.epoch === undefined) this.epoch = JulianDate.clone(time)
    value.time =
      (JulianDate.secondsDifference(time, this.epoch) * 1000) /
      this.durationValue
    value.image = this.imageValue
    return value
  }

  /**
   * 判断与另一属性是否相等。
   * @param other - 另一属性。
   * @returns 相等时返回 true。
   */
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof PolylineTrailMaterialProperty &&
        Color.equals(this.colorValue, other.colorValue) &&
        this.imageValue === other.imageValue &&
        this.durationValue === other.durationValue)
    )
  }
}
