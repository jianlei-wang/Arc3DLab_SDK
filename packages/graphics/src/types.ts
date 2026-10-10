import type {
  GraphicStyle,
  LngLatHeight,
  PositionInput,
  RenderMode,
  ResourceHandle,
} from "@arc3dlab/core"
import type { ConcreteRenderMode } from "./policy"

/**
 * 图形对象接口，描述一个可读取位置、可更新样式与坐标的渲染图形。
 */
export interface Graphic extends ResourceHandle {
  /** 该图形实际采用的渲染模式。 */
  readonly renderMode: ConcreteRenderMode
  /** 图形的经纬高坐标序列。 */
  readonly positions: LngLatHeight[]
  /** 图形是否可编辑。 */
  readonly editable: boolean
  /**
   * 更新图形样式。
   * @param style - 新的图形样式。
   */
  setStyle(style: GraphicStyle): void
  /**
   * 更新图形坐标。
   * @param positions - 单个坐标或坐标数组。
   */
  setPositions(positions: PositionInput | PositionInput[]): void
  /** 移除该图形并释放其占用的资源。 */
  remove(): void
}

/**
 * 创建图形时的通用选项。
 */
export interface GraphicCreateOptions {
  /** 图形 ID，未提供时自动生成。 */
  id?: string
  /** 图形坐标，单点或坐标数组。 */
  positions: PositionInput | PositionInput[]
  /** 图形样式。 */
  style?: GraphicStyle
  /** 期望的渲染模式。 */
  renderMode?: RenderMode
  /** 图形坐标是否需要动态更新。 */
  dynamic?: boolean
  /** 附加到图元上的自定义属性。 */
  properties?: Record<string, unknown>
}

/**
 * 创建模型图形时的选项。
 */
export interface ModelCreateOptions {
  /** 模型 ID，未提供时自动生成。 */
  id?: string
  /** 模型资源地址。 */
  url: string
  /** 模型放置位置。 */
  position: PositionInput
  /** 模型缩放系数。 */
  scale?: number
  /** 模型显示的最小像素尺寸。 */
  minimumPixelSize?: number
  /** 模型绕朝向的角度，单位为度。 */
  heading?: number
  /** 模型俯仰角度，单位为度。 */
  pitch?: number
  /** 模型翻滚角度，单位为度。 */
  roll?: number
  /** 附加到模型图元上的自定义属性。 */
  properties?: Record<string, unknown>
}
