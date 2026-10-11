import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  Cartesian2,
  Cartesian3,
  Color,
  LabelStyle,
  VerticalOrigin,
} from "cesium"
import type { LngLatLike } from "./geometry"

/** 路况分段的状态。 */
export type RouteStatus = "unknown" | "smooth" | "slow" | "congested" | "severe"

/** 路径中的一个分段。 */
export interface RouteSegment {
  /** 分段顶点列表。 */
  positions: LngLatLike[]
  /** 分段路况状态。 */
  status: RouteStatus
}

/** 路径规划结果。 */
export interface RouteResult {
  /** 总距离，单位为米。 */
  distance: number
  /** 预计总耗时，单位为秒。 */
  duration: number
  /** 按路况划分的分段列表。 */
  segments: RouteSegment[]
}

/** 路径渲染样式。 */
export interface RouteStyle {
  /** 各路况状态对应的颜色，未提供时使用默认配色。 */
  colors?: Partial<Record<RouteStatus, string>>
  /** 线宽，单位为像素。 */
  width?: number
  /** 是否贴地渲染。 */
  clampToGround?: boolean
  /** 是否显示起终点间的总距离与总耗时标注。 */
  showLabel?: boolean
}

/** 默认的路况配色。 */
export const DEFAULT_ROUTE_COLORS: Record<RouteStatus, string> = {
  unknown: "#5B8FF9",
  smooth: "#00B42A",
  slow: "#FF7D00",
  congested: "#F5222D",
  severe: "#7816FF",
}

/**
 * 返回指定路况状态对应的颜色。
 * @param status - 路况状态。
 * @param colors - 可选的自定义配色覆盖。
 * @returns 十六进制颜色字符串。
 */
export function routeStatusColor(
  status: RouteStatus,
  colors: Partial<Record<RouteStatus, string>> = {},
): string {
  return colors[status] ?? DEFAULT_ROUTE_COLORS[status]
}

/**
 * 将距离格式化为人类可读文本。
 * @param meters - 距离，单位为米。
 * @returns 格式化后的距离文本。
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "0 米"
  if (meters < 1000) return `${Math.round(meters)} 米`
  return `${(meters / 1000).toFixed(1)} 公里`
}

/**
 * 将时长格式化为人类可读文本。
 * @param seconds - 时长，单位为秒。
 * @returns 格式化后的时长文本。
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 分钟"
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)} 分钟`
  const hours = minutes / 60
  return `${hours.toFixed(1)} 小时`
}

/**
 * 生成路径总距离与总耗时的摘要文本。
 * @param result - 路径规划结果。
 * @returns 摘要文本，形如 `12.3 公里 · 约 15 分钟`。
 */
export function formatRouteSummary(result: RouteResult): string {
  return `${formatDistance(result.distance)} · 约 ${formatDuration(result.duration)}`
}

/**
 * 路径渲染器，将路况分段结果绘制为贴地折线并可选标注摘要。
 */
export class RouteOverlay {
  private readonly ids: string[] = []
  private visible = true

  /**
   * 创建路径渲染器。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 渲染路径结果，重复调用会先清除上一次绘制。
   * @param result - 路径规划结果。
   * @param style - 可选渲染样式。
   * @returns 当前渲染器实例，便于链式调用。
   */
  render(result: RouteResult, style: RouteStyle = {}): this {
    this.context.lifecycle.assertUsable("render route")
    this.clear()
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const width = style.width ?? 6
    const clampToGround = style.clampToGround ?? true
    for (const segment of result.segments) {
      if (segment.positions.length < 2) continue
      const entity = viewer.entities.add({
        polyline: {
          positions: segment.positions.map((point) =>
            Cartesian3.fromDegrees(point.longitude, point.latitude),
          ),
          width,
          clampToGround,
          material: Color.fromCssColorString(
            routeStatusColor(segment.status, style.colors),
          ).withAlpha(0.9),
        },
      })
      this.ids.push(entity.id)
    }
    if (style.showLabel && result.segments.length > 0) {
      const first = result.segments[0].positions
      const anchor = first[Math.floor(first.length / 2)]
      const entity = viewer.entities.add({
        position: Cartesian3.fromDegrees(anchor.longitude, anchor.latitude, 0),
        label: {
          text: formatRouteSummary(result),
          font: "14px sans-serif",
          style: LabelStyle.FILL_AND_OUTLINE,
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -12),
        },
      })
      this.ids.push(entity.id)
    }
    this.applyVisibility()
    return this
  }

  /**
   * 设置路径与标注的显隐。
   * @param visible - 是否显示。
   */
  setVisible(visible: boolean): void {
    this.visible = visible
    this.applyVisibility()
  }

  /**
   * 清除已绘制的路径与标注。
   */
  clear(): void {
    if (this.ids.length === 0) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    for (const id of this.ids) viewer.entities.removeById(id)
    this.ids.length = 0
  }

  /**
   * 销毁渲染器并释放全部图元。
   */
  destroy(): void {
    this.clear()
  }

  private applyVisibility(): void {
    if (this.ids.length === 0) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    for (const id of this.ids) {
      const entity = viewer.entities.getById(id)
      if (entity) entity.show = this.visible
    }
  }
}
