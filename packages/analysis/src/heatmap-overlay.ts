import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { HeightReference, ImageMaterialProperty, Rectangle } from "cesium"
import {
  computeHeatmapGrid,
  DEFAULT_HEATMAP_GRADIENT,
  gridToRgba,
  type GradientStop,
  type HeatmapGrid,
  type HeatmapGridOptions,
  type HeatmapPoint,
} from "./heatmap"

/** 热力图的渲染模式。 */
export type HeatmapMode = "2d" | "3d"

/** 热力图渲染选项。 */
export interface HeatmapRenderOptions extends HeatmapGridOptions {
  /** 渐变色标，默认使用经典配色。 */
  gradient?: GradientStop[]
  /** 渲染模式，`2d` 贴地、`3d` 抬升为平面，默认 `2d`。 */
  mode?: HeatmapMode
  /** 抬升平面的基准高度，单位为米，仅 `3d` 模式生效。 */
  baseHeight?: number
}

/**
 * 热力图可视化，将网格数据绘制为贴地或抬升的半透明影像。
 *
 * 说明：`3d` 模式当前以抬升平面近似表达，体数据表达将在后续阶段补充。
 */
export class HeatmapOverlay {
  private entityId: string | undefined
  private visible = true

  /**
   * 创建热力图可视化。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 使用点集更新热力图。
   * @param points - 热力图数据点。
   * @param options - 渲染选项。
   */
  setData(points: HeatmapPoint[], options: HeatmapRenderOptions = {}): void {
    this.context.lifecycle.assertUsable("render heatmap")
    this.setGrid(computeHeatmapGrid(points, options), options)
  }

  /**
   * 使用预计算网格更新热力图，跳过网格计算。
   * @param grid - 预计算的热力图网格。
   * @param options - 渲染选项。
   */
  setGrid(grid: HeatmapGrid, options: HeatmapRenderOptions = {}): void {
    this.context.lifecycle.assertUsable("render heatmap")
    const pixels = gridToRgba(
      grid,
      options.gradient ?? DEFAULT_HEATMAP_GRADIENT,
    )
    const canvas = document.createElement("canvas")
    canvas.width = grid.width
    canvas.height = grid.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const image = ctx.createImageData(grid.width, grid.height)
    image.data.set(pixels)
    ctx.putImageData(image, 0, 0)

    this.clear()
    const [west, south, east, north] = grid.extent
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const mode = options.mode ?? "2d"
    const entity = viewer.entities.add({
      rectangle: {
        coordinates: Rectangle.fromDegrees(west, south, east, north),
        material: new ImageMaterialProperty({
          image: canvas,
          transparent: true,
        }),
        height: mode === "3d" ? (options.baseHeight ?? 0) : undefined,
        heightReference:
          mode === "2d"
            ? HeightReference.CLAMP_TO_GROUND
            : HeightReference.NONE,
      },
    })
    this.entityId = entity.id
    entity.show = this.visible
  }

  /**
   * 设置热力图的显隐。
   * @param visible - 是否显示。
   */
  setVisible(visible: boolean): void {
    this.visible = visible
    if (this.entityId === undefined) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const entity = viewer.entities.getById(this.entityId)
    if (entity) entity.show = visible
  }

  /** 清除已绘制的热力图。 */
  clear(): void {
    if (this.entityId === undefined) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    viewer.entities.removeById(this.entityId)
    this.entityId = undefined
  }

  /** 销毁热力图并释放图元。 */
  destroy(): void {
    this.clear()
  }
}
