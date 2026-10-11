import type { PlotSymbol, PlotSymbolOptions } from "../symbols"
import type { PlotPoint } from "../algorithm"

/** 标绘图元的渲染种类。 */
export type PlotShapeKind =
  "point" | "billboard" | "label" | "polyline" | "polygon"

/** 描述一个待渲染的标绘图元。 */
export interface PlotShape {
  /** 图元渲染种类。 */
  kind: PlotShapeKind
  /** 图元的经纬度顶点集合。 */
  positions: PlotPoint[]
}

/** 绘制器的输入参数。 */
export interface PlotSymbolInput {
  /** 锚点集合，通常为绘制过程中采集的经纬度点。 */
  positions: PlotPoint[]
  /** 符号配置。 */
  options: PlotSymbolOptions
}

/** 符号绘制器，把锚点转换为待渲染图元集合。 */
export type PlotDrawer = (input: PlotSymbolInput) => PlotShape[]

/** 每个符号对应的绘制器映射。 */
export type PlotDrawerMap = Record<PlotSymbol, PlotDrawer>

/**
 * 生成一个点状图元。
 *
 * @param positions - 顶点集合。
 * @param kind - 点状图元种类。
 * @returns 图元集合。
 */
export function pointShape(
  positions: PlotPoint[],
  kind: Extract<PlotShapeKind, "point" | "billboard" | "label">,
): PlotShape[] {
  const first = positions[0]
  return first ? [{ kind, positions: [first] }] : []
}

/**
 * 生成一个线状图元。
 *
 * @param positions - 顶点集合。
 * @returns 图元集合。
 */
export function lineShape(positions: PlotPoint[]): PlotShape[] {
  return positions.length >= 2 ? [{ kind: "polyline", positions }] : []
}

/**
 * 生成面与轮廓两个图元。
 *
 * @param ring - 面轮廓顶点集合。
 * @param outline - 是否为轮廓单独生成线状图元，默认为 true。
 * @returns 图元集合。
 */
export function areaShape(ring: PlotPoint[], outline = true): PlotShape[] {
  if (ring.length < 3) return []
  const shapes: PlotShape[] = [{ kind: "polygon", positions: closeRing(ring) }]
  if (outline) shapes.push({ kind: "polyline", positions: closeRing(ring) })
  return shapes
}

/**
 * 闭合环，确保首尾顶点一致。
 *
 * @param ring - 顶点集合。
 * @returns 闭合后的顶点集合。
 */
export function closeRing(ring: PlotPoint[]): PlotPoint[] {
  if (ring.length === 0) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return ring
  return ring.concat([[first[0], first[1]]])
}
