import type { Arc3DContext } from "@arc3dlab/core"
import { HeatmapOverlay, type HeatmapRenderOptions } from "./heatmap-overlay"
import {
  computeHeatmapGrid,
  type HeatmapGrid,
  type HeatmapPoint,
} from "./heatmap"

/** 动态热力图的一帧数据。 */
export interface DynamicHeatmapFrame {
  /** 该帧的数据点。 */
  points: HeatmapPoint[]
  /** 该帧的渲染选项。 */
  options?: HeatmapRenderOptions
}

/**
 * 在两张网格之间做线性插值，用于帧间平滑过渡。
 * @param from - 起始网格。
 * @param to - 结束网格。
 * @param t - 插值比例，取值位于 `[0, 1]`。
 * @returns 插值后的网格，维度不一致时返回 `from`。
 */
export function interpolateHeatmapGrid(
  from: HeatmapGrid,
  to: HeatmapGrid,
  t: number,
): HeatmapGrid {
  if (from.width !== to.width || from.height !== to.height) return from
  const ratio = Math.min(1, Math.max(0, t))
  const values = new Float32Array(from.values.length)
  for (let i = 0; i < values.length; i += 1) {
    values[i] = from.values[i] + (to.values[i] - from.values[i]) * ratio
  }
  return {
    width: from.width,
    height: from.height,
    extent: from.extent,
    values,
    maxValue: from.maxValue + (to.maxValue - from.maxValue) * ratio,
  }
}

/** 播放时每个帧间隔默认拆分的插值步数。 */
const DEFAULT_TRANSITION_STEPS = 12

/**
 * 动态热力图，支持在多个数据帧之间切换与定时播放。
 */
export class DynamicHeatmapOverlay {
  private readonly overlay: HeatmapOverlay
  private readonly grids: HeatmapGrid[] = []
  private frames: DynamicHeatmapFrame[] = []
  private timer: ReturnType<typeof setInterval> | undefined
  private current = 0

  /**
   * 创建动态热力图。
   * @param context - Arc3D 运行上下文。
   */
  constructor(context: Arc3DContext) {
    this.overlay = new HeatmapOverlay(context)
  }

  /**
   * 设置数据帧列表，并停用当前播放。
   * @param frames - 帧列表。
   */
  setFrames(frames: DynamicHeatmapFrame[]): void {
    this.pause()
    this.frames = frames
    this.grids.length = 0
    for (const frame of frames) {
      this.grids.push(computeHeatmapGrid(frame.points, frame.options))
    }
    this.current = 0
    if (frames.length > 0) this.showFrame(0)
  }

  /**
   * 显示指定索引的数据帧。
   * @param index - 帧索引，超出范围时按环形取模。
   */
  showFrame(index: number): void {
    if (this.frames.length === 0) return
    this.current =
      ((index % this.frames.length) + this.frames.length) % this.frames.length
    const frame = this.frames[this.current]
    this.overlay.setGrid(this.grids[this.current], frame.options)
  }

  /**
   * 播放动态热力图，在相邻帧的缓存网格之间插值过渡。
   * @param intervalMs - 帧间隔，单位为毫秒，默认 500。
   * @param steps - 每个帧间隔拆分的插值步数，默认 12。
   */
  play(intervalMs = 500, steps = DEFAULT_TRANSITION_STEPS): void {
    this.pause()
    if (this.frames.length < 2) return
    const duration = Math.max(16, intervalMs)
    const stepMs = Math.max(
      16,
      Math.round(duration / Math.max(2, Math.floor(steps))),
    )
    let elapsed = 0
    this.timer = setInterval(() => {
      elapsed += stepMs
      const from = this.current
      const to = (from + 1) % this.frames.length
      const ratio = Math.min(1, elapsed / duration)
      if (ratio >= 1) {
        this.overlay.setGrid(this.grids[to], this.frames[to].options)
        this.current = to
        elapsed = 0
        return
      }
      this.overlay.setGrid(
        interpolateHeatmapGrid(this.grids[from], this.grids[to], ratio),
        this.frames[from].options,
      )
    }, stepMs)
  }

  /** 暂停播放。 */
  pause(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  /** 清除当前帧并停止播放。 */
  clear(): void {
    this.pause()
    this.frames = []
    this.grids.length = 0
    this.overlay.clear()
  }

  /** 销毁动态热力图。 */
  destroy(): void {
    this.clear()
    this.overlay.destroy()
  }
}
