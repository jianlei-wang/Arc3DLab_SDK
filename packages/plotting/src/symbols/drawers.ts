import type { PlotDrawerMap } from "./types"
import { drawBillboard, drawLabel, drawPoint } from "./point"
import { drawCurve, drawFreeLine, drawLineArrow, drawPolyline } from "./line"
import {
  drawAssemble,
  drawBow,
  drawCircle,
  drawEllipse,
  drawFreePolygon,
  drawPolygon,
  drawRectangle,
  drawRegularPolygon,
  drawRoundRectangle,
  drawSector,
} from "./area"
import {
  drawAttackArrow,
  drawPincerArrow,
  drawRightAngleArrow,
  drawStraightArrow,
  drawSwallowtailArrow,
} from "./arrow"
import { drawFlag, drawFormation } from "./misc"

/**
 * 全部 24 种标绘符号的绘制器映射。
 */
export const SYMBOL_DRAWERS: PlotDrawerMap = {
  point: drawPoint,
  billboard: drawBillboard,
  label: drawLabel,
  polyline: drawPolyline,
  curve: drawCurve,
  freeLine: drawFreeLine,
  lineArrow: drawLineArrow,
  polygon: drawPolygon,
  freePolygon: drawFreePolygon,
  regularPolygon: drawRegularPolygon,
  bow: drawBow,
  ellipse: drawEllipse,
  sector: drawSector,
  circle: drawCircle,
  rectangle: drawRectangle,
  roundRectangle: drawRoundRectangle,
  assemble: drawAssemble,
  rightAngleArrow: drawRightAngleArrow,
  straightArrow: drawStraightArrow,
  attackArrow: drawAttackArrow,
  swallowtailArrow: drawSwallowtailArrow,
  pincerArrow: drawPincerArrow,
  flag: drawFlag,
  formation: drawFormation,
}
