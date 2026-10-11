import {
  assemblePoints,
  bowPoints,
  circlePoints,
  ellipsePoints,
  rectanglePoints,
  regularPolygonPoints,
  roundRectanglePoints,
  sectorPoints,
} from "../algorithm"
import { areaShape, type PlotDrawer } from "./types"

/**
 * 绘制多边形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawPolygon: PlotDrawer = ({ positions }) => areaShape(positions)

/**
 * 绘制自由多边形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawFreePolygon: PlotDrawer = ({ positions }) =>
  areaShape(positions)

/**
 * 绘制正多边形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawRegularPolygon: PlotDrawer = ({ positions, options }) => {
  if (positions.length < 2) return []
  return areaShape(
    regularPolygonPoints(positions[0], positions[1], options.sides ?? 5),
  )
}

/**
 * 绘制弓形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawBow: PlotDrawer = ({ positions }) => {
  if (positions.length < 2) return []
  return areaShape(bowPoints(positions[0], positions[1]))
}

/**
 * 绘制椭圆符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawEllipse: PlotDrawer = ({ positions }) => {
  if (positions.length < 2) return []
  return areaShape(ellipsePoints(positions[0], positions[1]))
}

/**
 * 绘制扇形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawSector: PlotDrawer = ({ positions }) => {
  if (positions.length < 3) return []
  return areaShape(sectorPoints(positions[0], positions[1], positions[2]))
}

/**
 * 绘制圆形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawCircle: PlotDrawer = ({ positions }) => {
  if (positions.length < 2) return []
  return areaShape(circlePoints(positions[0], positions[1]))
}

/**
 * 绘制矩形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawRectangle: PlotDrawer = ({ positions }) => {
  if (positions.length < 2) return []
  return areaShape(rectanglePoints(positions[0], positions[1]))
}

/**
 * 绘制圆角矩形符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawRoundRectangle: PlotDrawer = ({ positions }) => {
  if (positions.length < 2) return []
  return areaShape(roundRectanglePoints(positions[0], positions[1]))
}

/**
 * 绘制集结地符号。
 *
 * @param input - 锚点与配置。
 * @returns 面状图元集合。
 */
export const drawAssemble: PlotDrawer = ({ positions }) => {
  if (positions.length < 2) return []
  return areaShape(assemblePoints(positions[0], positions[1]))
}
