import type { PositionInput } from "@arc3dlab/core"

/**
 * 动态图形句柄，描述一次性创建的动态图形对象及其释放方式。
 */
export interface DynamicGraphicHandle {
  /** 图形标识。 */
  readonly id: string
  /** 底层原生对象，通常为 Cesium 实体或后处理阶段。 */
  readonly native: unknown
  /** 移除图形并释放其动画监听。 */
  destroy(): void
}

/**
 * 动态图形创建的通用选项。
 */
export interface DynamicGraphicOptions {
  /** 图形标识，未提供时自动生成。 */
  id?: string
}

/**
 * 广告牌创建选项。
 */
export interface BillboardOptions extends DynamicGraphicOptions {
  /** 广告牌位置。 */
  position: PositionInput
  /** 图标地址。 */
  image: string
  /** 缩放系数，默认为 1。 */
  scale?: number
  /** 是否贴合地表，默认为 true。 */
  clampToGround?: boolean
}

/**
 * 扩散点创建选项。
 */
export interface SpreadPointOptions extends DynamicGraphicOptions {
  /** 扩散点中心位置。 */
  position: PositionInput
  /** 扩散半径，单位为米。 */
  radius: number
  /** 扩散颜色（CSS 颜色字符串）。 */
  color?: string
  /** 扩散周期，单位为毫秒，数值越小扩散越快。 */
  duration?: number
  /** 渐变强度，值越大渐变越明显。 */
  gradient?: number
  /** 是否贴合地表，默认为 true。 */
  onGround?: boolean
}

/**
 * 雷达扫描符号创建选项。
 */
export interface RadarNormalOptions extends DynamicGraphicOptions {
  /** 雷达中心位置。 */
  position: PositionInput
  /** 扫描半径，单位为米。 */
  radius: number
  /** 扫描颜色（CSS 颜色字符串）。 */
  color?: string
  /** 扫描速度。 */
  speed?: number
}

/**
 * 水系面创建选项。
 */
export interface RiverOptions extends DynamicGraphicOptions {
  /** 水系面边界节点。 */
  positions: PositionInput[]
  /** 水纹法线贴图地址。 */
  image?: string
}

/**
 * 圆形扩散创建选项。
 */
export interface CircleDiffusionOptions extends DynamicGraphicOptions {
  /** 扩散中心位置。 */
  position: PositionInput
  /** 扩散半径，单位为米。 */
  radius: number
  /** 扩散颜色（CSS 颜色字符串）。 */
  color?: string
}

/**
 * 动态折线创建选项。
 */
export interface DynamicPolylineOptions extends DynamicGraphicOptions {
  /** 折线节点。 */
  positions: PositionInput[]
  /** 线宽，单位为像素，默认为 6。 */
  width?: number
  /** 尾迹颜色（CSS 颜色字符串）。 */
  color?: string
  /** 尾迹周期，单位为毫秒。 */
  duration?: number
}

/**
 * 热点面板创建选项。
 */
export interface PanelOptions extends DynamicGraphicOptions {
  /** 面板位置。 */
  position: PositionInput
  /** 面板文本内容。 */
  text: string
  /** 面板类型，`hot` 热点、`process` 流程，默认为 `hot`。 */
  type?: "hot" | "process"
  /** 面板可见的最小视距。 */
  near?: number
  /** 面板可见的最大视距。 */
  far?: number
}
