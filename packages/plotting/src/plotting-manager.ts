import {
  Arc3DError,
  createId,
  type Arc3DContext,
  type LngLat,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  Cartesian3,
  Color,
  PolygonHierarchy,
  type Entity,
  type Viewer,
} from "cesium"
import { SYMBOL_DRAWERS } from "./symbols/drawers"
import type { PlotPoint } from "./algorithm"
import type { PlotShape } from "./symbols/types"
import type { PlotDrawOptions, PlotStyle, PlotSymbol } from "./symbols"

/** 描述一次标绘的结果。 */
export interface PlotResult {
  /** 结果标识。 */
  id: string
  /** 标绘所使用的符号类型。 */
  symbol: PlotSymbol
  /** 原始锚点集合。 */
  positions: LngLat[]
  /** 计算得到待渲染的图元集合。 */
  shapes: PlotShape[]
  /** 已创建的底层图元对象集合。 */
  entities: unknown[]
}

/** 标绘工具在 ToolRegistry 中注册的名称。 */
export const PLOTTING_TOOL_NAME = "plotting.drawing"

/** 态势标绘管理器，负责符号几何计算、图元渲染与结果管理。 */
export class PlottingManager {
  private readonly items = new Map<string, PlotResult>()
  private toolRegistered = false

  /**
   * 创建标绘管理器。
   *
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 依据符号类型与锚点绘制一个标绘对象。
   *
   * @param symbol - 标绘符号类型。
   * @param options - 锚点与样式配置。
   * @returns 标绘结果。
   * @throws {Arc3DError} 当符号未知、锚点不足或视图不支持实体时抛出。
   */
  draw(symbol: PlotSymbol, options: PlotDrawOptions): PlotResult {
    this.context.lifecycle.assertUsable("draw plot")
    const drawer = SYMBOL_DRAWERS[symbol]
    if (!drawer) {
      throw new Arc3DError("INVALID_ARGUMENT", `Unknown plot symbol: ${symbol}`)
    }
    const positions = options.positions ?? []
    const anchorPoints: PlotPoint[] = positions.map((point) => [
      point.longitude,
      point.latitude,
    ])
    const shapes = drawer({ positions: anchorPoints, options })
    if (shapes.length === 0) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Symbol ${symbol} requires more anchor positions`,
      )
    }
    const style: PlotStyle = options.style ?? {}
    const entities = shapes.map((shape) =>
      this.materialize(shape, style, options),
    )
    const id = options.id ?? createId("plot")
    const result: PlotResult = { id, symbol, positions, shapes, entities }
    this.items.set(id, result)
    this.ensureTool()
    return result
  }

  /**
   * 获取指定标识的标绘结果。
   *
   * @param id - 结果标识。
   * @returns 标绘结果，不存在时为 undefined。
   */
  get(id: string): PlotResult | undefined {
    return this.items.get(id)
  }

  /**
   * 列出全部标绘结果。
   *
   * @returns 标绘结果数组。
   */
  get results(): PlotResult[] {
    return Array.from(this.items.values())
  }

  /**
   * 移除指定的标绘对象。
   *
   * @param id - 结果标识。
   * @returns 是否成功移除。
   */
  remove(id: string): boolean {
    const result = this.items.get(id)
    if (!result) return false
    const viewer = this.viewerOrUndefined()
    if (viewer?.entities) {
      for (const entity of result.entities)
        viewer.entities.remove(entity as Entity)
    }
    this.items.delete(id)
    return true
  }

  /**
   * 移除全部标绘对象。
   */
  removeAll(): void {
    for (const id of Array.from(this.items.keys())) this.remove(id)
  }

  /**
   * 销毁管理器，移除全部标绘对象并注销工具。
   */
  destroy(): void {
    this.removeAll()
    if (this.toolRegistered && this.context.tools.has(PLOTTING_TOOL_NAME)) {
      void this.context.tools.unregister(PLOTTING_TOOL_NAME)
    }
    this.toolRegistered = false
  }

  /**
   * 确保标绘工具已注册到 ToolRegistry。
   */
  private ensureTool(): void {
    if (this.toolRegistered) return
    if (!this.context.tools.has(PLOTTING_TOOL_NAME)) {
      this.context.tools.register({
        name: PLOTTING_TOOL_NAME,
        version: "1.0.0",
        plugin: "arc3dlab.plotting",
        activate: () => undefined,
        deactivate: () => undefined,
      })
    }
    this.toolRegistered = true
  }

  /**
   * 解析底层 Cesium 视图。
   *
   * @returns Cesium 视图对象。
   * @throws {Arc3DError} 当视图不提供实体集合时抛出。
   */
  private viewer(): Viewer {
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    if (!viewer || !viewer.entities) {
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        "Viewer does not expose an entity collection",
      )
    }
    return viewer
  }

  /**
   * 尝试解析底层 Cesium 视图，用于容错清理。
   *
   * @returns Cesium 视图对象，不可用时为 undefined。
   */
  private viewerOrUndefined(): Viewer | undefined {
    const viewer = getCesiumViewer(this.context.engine.native.viewer) as
      Viewer | undefined
    return viewer && viewer.entities ? viewer : undefined
  }

  /**
   * 将几何图元渲染为底层实体。
   *
   * @param shape - 待渲染的图元。
   * @param style - 符号样式。
   * @param options - 符号配置。
   * @returns 创建的实体对象。
   */
  private materialize(
    shape: PlotShape,
    style: PlotStyle,
    options: PlotDrawOptions,
  ): unknown {
    const viewer = this.viewer()
    const cartesians = shape.positions.map(([lng, lat]) =>
      Cartesian3.fromDegrees(lng, lat),
    )
    const color = style.color
      ? Color.fromCssColorString(style.color)
      : Color.WHITE
    const fill = style.fillColor
      ? Color.fromCssColorString(style.fillColor)
      : color
    const outlineColor = style.outlineColor
      ? Color.fromCssColorString(style.outlineColor)
      : color
    const clampToGround = options.clampToGround ?? true
    switch (shape.kind) {
      case "point":
        return viewer.entities.add({
          position: cartesians[0],
          point: {
            pixelSize: style.pixelSize ?? 8,
            color: fill,
            outlineColor,
            outlineWidth: style.outlineWidth ?? 1,
          },
        })
      case "billboard":
        return viewer.entities.add({
          position: cartesians[0],
          billboard: { image: options.image ?? "", scale: 1 },
        })
      case "label":
        return viewer.entities.add({
          position: cartesians[0],
          label: {
            text: options.labelText ?? "",
            font: "14px sans-serif",
            fillColor: color,
            showBackground: false,
          },
        })
      case "polyline":
        return viewer.entities.add({
          polyline: {
            positions: cartesians,
            width: style.width ?? 2,
            material: color,
            clampToGround,
          },
        })
      case "polygon":
      default:
        return viewer.entities.add({
          polygon: {
            hierarchy: new PolygonHierarchy(cartesians),
            material: fill,
            outline: true,
            outlineColor,
            outlineWidth: style.outlineWidth ?? 1,
          },
        })
    }
  }
}
