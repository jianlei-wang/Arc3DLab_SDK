/**
 * 图层高亮语义。
 *
 * 本模块以纯函数描述 `blink`（呼吸）、`scaling`（缩放闪烁）与 `jump`（跳跃）
 * 三类高亮动画的取值规律，并通过 {@link ActiveStyle} 控制器把动画值写入一个
 * 抽象属性读写端口，从而在关闭高亮时精确还原原始样式。该实现不依赖任何渲染
 * 引擎，便于在无浏览器环境下进行单元测试。
 */

/** 高亮动画类型：呼吸、缩放闪烁与跳跃。 */
export type ActiveType = "blink" | "scaling" | "jump"

/** 可被高亮的实体几何类型。 */
export type ActiveGeometry = "point" | "billboard" | "polyline" | "polygon"

/** 描述一次高亮动画的关键参数。 */
export interface ActiveStyleOptions {
  /** 高亮动画类型。 */
  type: ActiveType
  /** 目标几何类型。 */
  geometry: ActiveGeometry
  /** 动画取值下限，缺省时取对应类型的内置值。 */
  min?: number
  /** 动画取值上限，缺省时取对应类型的内置值。 */
  max?: number
  /** 每个动画帧的变化步长，缺省时取对应类型的内置值。 */
  step?: number
  /** 起始相位偏移，用于让多个实体错峰动画。 */
  phase?: number
}

/** 高亮动画在某一帧上的取值。 */
export interface ActiveFrameValue {
  /** 参与动画的属性键，例如 `colorAlpha`、`scale`、`pixelOffsetY`。 */
  key: string
  /** 该帧的取值。 */
  value: number
}

/** 抽象属性读写端口，用于隔离具体引擎或对象模型。 */
export interface ActiveStyleWriter {
  /** 读取当前属性值。 */
  read(key: string): number
  /** 写入属性值。 */
  write(key: string, value: number): void
}

interface ResolvedDefaults {
  min: number
  max: number
  step: number
}

/**
 * 根据几何类型与动画类型推导参与动画的属性键。
 *
 * 呼吸动画对线与面作用于材质的透明度，对点与广告牌作用于颜色透明度；缩放动画
 * 对线作用于线宽，其余作用于缩放系数；跳跃动画作用于垂直像素偏移。
 *
 * @param geometry - 目标几何类型。
 * @param type - 高亮动画类型。
 * @returns 属性键名。
 */
export function activePropertyKey(
  geometry: ActiveGeometry,
  type: ActiveType,
): string {
  if (type === "blink") {
    return geometry === "polyline" || geometry === "polygon"
      ? "materialAlpha"
      : "colorAlpha"
  }
  if (type === "scaling") {
    return geometry === "polyline" ? "width" : "scale"
  }
  return "pixelOffsetY"
}

function resolveDefaults(options: ActiveStyleOptions): ResolvedDefaults {
  if (options.type === "blink") {
    return { min: 0.3, max: 1, step: 0.02 }
  }
  if (options.type === "scaling") {
    return { min: 0.5, max: 1.5, step: 0.05 }
  }
  return { min: -10, max: 0, step: 0.2 }
}

/**
 * 计算三角波形式的往复取值。
 *
 * @param tick - 单调递增的帧号或时间刻度。
 * @param min - 取值下限。
 * @param max - 取值上限。
 * @param step - 每帧步长。
 * @returns 位于 `[min, max]` 区间内的往复取值。
 */
export function triangularWave(
  tick: number,
  min: number,
  max: number,
  step: number,
): number {
  const span = max - min
  if (span <= 0 || step <= 0) return min
  const period = span * 2
  const position = (((tick * step) % period) + period) % period
  return min + (position <= span ? position : period - position)
}

/**
 * 计算高亮动画在指定帧上的属性键与取值。
 *
 * @param options - 高亮动画参数。
 * @param tick - 单调递增的帧号或时间刻度。
 * @param base - 属性基准值，呼吸动画忽略该值，缩放用于相乘、跳跃用于相加。
 * @returns 该帧的属性键与取值。
 */
export function activeFrameValue(
  options: ActiveStyleOptions,
  tick: number,
  base = 1,
): ActiveFrameValue {
  const defaults = resolveDefaults(options)
  const min = options.min ?? defaults.min
  const max = options.max ?? defaults.max
  const step = options.step ?? defaults.step
  const wave = triangularWave(tick + (options.phase ?? 0), min, max, step)
  let value: number
  if (options.type === "blink") value = wave
  else if (options.type === "scaling") value = base * wave
  else value = base + wave
  return { key: activePropertyKey(options.geometry, options.type), value }
}

/**
 * 高亮样式控制器，负责保存基准值、按帧写入动画值并在关闭时还原。
 */
export class ActiveStyle {
  private base: number | undefined
  private readonly key: string

  /**
   * 创建高亮样式控制器。
   * @param writer - 属性读写端口。
   * @param options - 高亮动画参数。
   */
  constructor(
    private readonly writer: ActiveStyleWriter,
    private readonly options: ActiveStyleOptions,
  ) {
    this.key = activePropertyKey(options.geometry, options.type)
  }

  /** 参与动画的属性键。 */
  get propertyKey(): string {
    return this.key
  }

  /** 当前是否处于高亮状态。 */
  get isActive(): boolean {
    return this.base !== undefined
  }

  /**
   * 应用或推进一帧高亮动画；首次调用时记录基准值。
   * @param tick - 单调递增的帧号或时间刻度。
   * @returns 该帧的属性键与取值。
   */
  step(tick = 0): ActiveFrameValue {
    if (this.base === undefined) this.base = this.writer.read(this.key)
    const frame = activeFrameValue(this.options, tick, this.base)
    this.writer.write(frame.key, frame.value)
    return frame
  }

  /**
   * 关闭高亮并还原为记录的基准值。
   */
  restore(): void {
    if (this.base === undefined) return
    this.writer.write(this.key, this.base)
    this.base = undefined
  }
}
