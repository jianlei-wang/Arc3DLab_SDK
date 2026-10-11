import {
  attackArrow,
  pincerArrow,
  rightAngleArrow,
  straightArrow,
  swallowtailArrow,
} from "../algorithm"
import { areaShape, type PlotDrawer } from "./types"

/**
 * 绘制直角箭头符号。
 *
 * @param input - 锚点与配置。
 * @returns 箭头图元集合。
 */
export const drawRightAngleArrow: PlotDrawer = ({ positions }) =>
  positions.length >= 2 ? areaShape(rightAngleArrow(positions)) : []

/**
 * 绘制直箭头符号。
 *
 * @param input - 锚点与配置。
 * @returns 箭头图元集合。
 */
export const drawStraightArrow: PlotDrawer = ({ positions }) =>
  positions.length >= 2
    ? areaShape(straightArrow(positions[0], positions[1], true))
    : []

/**
 * 绘制攻击箭头符号。
 *
 * @param input - 锚点与配置。
 * @returns 箭头图元集合。
 */
export const drawAttackArrow: PlotDrawer = ({ positions }) =>
  positions.length >= 3 ? areaShape(attackArrow(positions)) : []

/**
 * 绘制燕尾箭头符号。
 *
 * @param input - 锚点与配置。
 * @returns 箭头图元集合。
 */
export const drawSwallowtailArrow: PlotDrawer = ({ positions }) =>
  positions.length >= 2
    ? areaShape(swallowtailArrow(positions[0], positions[1], true))
    : []

/**
 * 绘制钳击箭头符号。
 *
 * @param input - 锚点与配置。
 * @returns 箭头图元集合。
 */
export const drawPincerArrow: PlotDrawer = ({ positions }) =>
  positions.length >= 3 ? areaShape(pincerArrow(positions)) : []
