import { getBezierPoints, getCurvePoints } from "../algorithm"
import { lineShape, type PlotDrawer } from "./types"

/**
 * 绘制折线符号。
 *
 * @param input - 锚点与配置。
 * @returns 线状图元集合。
 */
export const drawPolyline: PlotDrawer = ({ positions }) => lineShape(positions)

/**
 * 绘制自由线符号。
 *
 * @param input - 锚点与配置。
 * @returns 线状图元集合。
 */
export const drawFreeLine: PlotDrawer = ({ positions }) => lineShape(positions)

/**
 * 绘制平滑曲线符号。
 *
 * @param input - 锚点与配置。
 * @returns 线状图元集合。
 */
export const drawCurve: PlotDrawer = ({ positions }) =>
  positions.length >= 2 ? lineShape(getBezierPoints(positions)) : []

/**
 * 绘制曲线箭头（自由线箭头）符号。
 *
 * @param input - 锚点与配置。
 * @returns 线状图元集合。
 */
export const drawLineArrow: PlotDrawer = ({ positions }) =>
  positions.length >= 3
    ? lineShape(getCurvePoints(positions))
    : lineShape(positions)
