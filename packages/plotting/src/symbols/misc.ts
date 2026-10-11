import { flagPoints, formationPoints } from "../algorithm"
import { areaShape, type PlotDrawer } from "./types"

/**
 * 绘制旗标符号。
 *
 * @param input - 锚点与配置。
 * @returns 旗标图元集合。
 */
export const drawFlag: PlotDrawer = ({ positions, options }) =>
  positions.length >= 2
    ? areaShape(flagPoints(positions[0], positions[1], options.flagType ?? 0))
    : []

/**
 * 绘制阵型符号。
 *
 * @param input - 锚点与配置。
 * @returns 阵型图元集合。
 */
export const drawFormation: PlotDrawer = ({ positions, options }) =>
  positions.length >= 2
    ? areaShape(
        formationPoints(positions[0], positions[1], options.formationType ?? 0),
      )
    : []
