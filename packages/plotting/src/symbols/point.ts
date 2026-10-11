import { pointShape, type PlotDrawer } from "./types"

/**
 * 绘制点符号。
 *
 * @param input - 锚点与配置。
 * @returns 点状图元集合。
 */
export const drawPoint: PlotDrawer = ({ positions }) =>
  pointShape(positions, "point")

/**
 * 绘制图标符号。
 *
 * @param input - 锚点与配置。
 * @returns 图标图元集合。
 */
export const drawBillboard: PlotDrawer = ({ positions }) =>
  pointShape(positions, "billboard")

/**
 * 绘制标注符号。
 *
 * @param input - 锚点与配置。
 * @returns 标注图元集合。
 */
export const drawLabel: PlotDrawer = ({ positions }) =>
  pointShape(positions, "label")
