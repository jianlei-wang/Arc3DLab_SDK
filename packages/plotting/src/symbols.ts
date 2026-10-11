import type { LngLat } from "@arc3dlab/core"

/**
 * 态势标绘支持的全部符号类型。
 *
 * 取值覆盖点、线、面与军事箭头四大类，共 24 种。
 */
export type PlotSymbol =
  | "point"
  | "billboard"
  | "polyline"
  | "curve"
  | "freeLine"
  | "polygon"
  | "freePolygon"
  | "regularPolygon"
  | "bow"
  | "ellipse"
  | "sector"
  | "circle"
  | "rectangle"
  | "roundRectangle"
  | "assemble"
  | "lineArrow"
  | "rightAngleArrow"
  | "straightArrow"
  | "attackArrow"
  | "swallowtailArrow"
  | "pincerArrow"
  | "flag"
  | "formation"
  | "label"

/** 旗标符号的样式，0 曲线、1 直线、2 正三角、3 倒三角、4 对三角。 */
export type FlagType = 0 | 1 | 2 | 3 | 4

/** 阵型符号的样式，0 进攻、1 防御。 */
export type FormationType = 0 | 1

/** 全部标绘符号类型的常量数组。 */
export const PLOT_SYMBOLS: readonly PlotSymbol[] = [
  "point",
  "billboard",
  "polyline",
  "curve",
  "freeLine",
  "polygon",
  "freePolygon",
  "regularPolygon",
  "bow",
  "ellipse",
  "sector",
  "circle",
  "rectangle",
  "roundRectangle",
  "assemble",
  "lineArrow",
  "rightAngleArrow",
  "straightArrow",
  "attackArrow",
  "swallowtailArrow",
  "pincerArrow",
  "flag",
  "formation",
  "label",
]

/** 点状符号集合。 */
export const PLOT_POINT_SYMBOLS: readonly PlotSymbol[] = [
  "point",
  "billboard",
  "label",
]

/** 线状符号集合。 */
export const PLOT_LINE_SYMBOLS: readonly PlotSymbol[] = [
  "polyline",
  "curve",
  "freeLine",
  "lineArrow",
]

/** 面状符号集合。 */
export const PLOT_POLYGON_SYMBOLS: readonly PlotSymbol[] = [
  "polygon",
  "freePolygon",
  "regularPolygon",
  "bow",
  "ellipse",
  "sector",
  "circle",
  "rectangle",
  "roundRectangle",
  "assemble",
]

/** 箭头符号集合。 */
export const PLOT_ARROW_SYMBOLS: readonly PlotSymbol[] = [
  "rightAngleArrow",
  "straightArrow",
  "attackArrow",
  "swallowtailArrow",
  "pincerArrow",
]

/** 描述符号的通用样式。 */
export interface PlotStyle {
  /** 线颜色，CSS 颜色字符串。 */
  color?: string
  /** 填充色，CSS 颜色字符串。 */
  fillColor?: string
  /** 轮廓颜色，CSS 颜色字符串。 */
  outlineColor?: string
  /** 线宽，单位像素。 */
  width?: number
  /** 轮廓宽度，单位像素。 */
  outlineWidth?: number
  /** 点符号的像素尺寸。 */
  pixelSize?: number
  /** 是否使用仅在轮廓线上的样式。 */
  outlineOnly?: boolean
}

/** 描述一次标绘所需的锚点与样式。 */
export interface PlotSymbolOptions {
  /** 锚点集合，通常为绘制过程中采集的经纬度点。 */
  positions: LngLat[]
  /** 符号样式。 */
  style?: PlotStyle
  /** 是否贴合地表，默认为 true。 */
  clampToGround?: boolean
  /** 正多边形的边数，仅 `regularPolygon` 使用。 */
  sides?: number
  /** 旗标样式，仅 `flag` 使用。 */
  flagType?: FlagType
  /** 阵型样式，仅 `formation` 使用。 */
  formationType?: FormationType
  /** 标注文本，仅 `label` 使用。 */
  labelText?: string
  /** 图片地址，仅 `billboard` 使用。 */
  image?: string
}

/** 描述一次标绘的入参，包含可选的结果标识。 */
export interface PlotDrawOptions extends PlotSymbolOptions {
  /** 结果标识；未提供时自动生成。 */
  id?: string
}
