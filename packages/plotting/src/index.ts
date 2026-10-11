/**
 * `@arc3dlab/plotting` 包入口，提供军事态势标绘能力。
 *
 * @packageDocumentation
 */

export {
  PlottingManager,
  PLOTTING_TOOL_NAME,
  type PlotResult,
} from "./plotting-manager"

export {
  PLOT_SYMBOLS,
  PLOT_POINT_SYMBOLS,
  PLOT_LINE_SYMBOLS,
  PLOT_POLYGON_SYMBOLS,
  PLOT_ARROW_SYMBOLS,
  type PlotSymbol,
  type FlagType,
  type FormationType,
  type PlotStyle,
  type PlotSymbolOptions,
  type PlotDrawOptions,
} from "./symbols"

export { SYMBOL_DRAWERS } from "./symbols/drawers"
export {
  closeRing,
  type PlotShape,
  type PlotShapeKind,
  type PlotDrawer,
  type PlotDrawerMap,
  type PlotSymbolInput,
} from "./symbols/types"

export {
  assemblePoints,
  attackArrow,
  bowPoints,
  calculateAngle,
  circlePoints,
  distance,
  distanceMeters,
  doubleArrow,
  ellipsePoints,
  fineArrow,
  flagPoints,
  formationPoints,
  getAngleOfThreePoints,
  getArcPoints,
  getAzimuth,
  getBaseLength,
  getBezierPoints,
  getBinomialFactor,
  getCircleCenterOfThreePoints,
  getCubicValue,
  getCurvePoints,
  getFactorial,
  getIntersectPoint,
  getLabelText,
  getPointByAngleDistance,
  getPointOnLine,
  getQBSplinePoints,
  getThirdPoint,
  isClockWise,
  midPoint,
  offsetByMeters,
  pincerArrow,
  rectanglePoints,
  regularPolygonPoints,
  rightAngleArrow,
  roundRectanglePoints,
  sectorPoints,
  straightArrow,
  swallowtailArrow,
  wholeDistance,
  type PlotPoint,
} from "./algorithm"
