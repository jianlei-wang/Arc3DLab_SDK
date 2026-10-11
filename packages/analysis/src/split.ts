import { Arc3DError, type Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { ImageryLayer, SplitDirection } from "cesium"

/** 卷帘对比的方向。 */
export type SwipeOrientation = "vertical" | "horizontal"

/** 卷帘对比的图层归属侧。 */
export type SwipeSide = "left" | "right"

/**
 * 卷帘对比，通过场景分割位置控制左右两侧图层各显示一半。
 *
 * 说明：底层依赖 Cesium 的场景分割能力，当前仅支持竖直方向的分割；
 * 传入 `horizontal` 将抛出 `UNSUPPORTED_CAPABILITY`。
 */
export class SwipeComparison {
  private readonly layers: Array<{ layer: ImageryLayer; side: SwipeSide }> = []
  private position = 0.5
  private active = true

  /**
   * 创建卷帘对比。
   * @param context - Arc3D 运行上下文。
   * @param orientation - 分割方向，默认为竖直。
   */
  constructor(
    private readonly context: Arc3DContext,
    private readonly orientation: SwipeOrientation = "vertical",
  ) {
    if (orientation !== "vertical") {
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        `swipe orientation not supported: ${orientation}`,
      )
    }
  }

  /**
   * 添加参与对比的图层。
   * @param layer - Cesium 影像图层。
   * @param side - 该图层显示的一侧。
   * @returns 当前实例，便于链式调用。
   */
  addLayer(layer: ImageryLayer, side: SwipeSide): this {
    this.layers.push({ layer, side })
    this.applyLayer(layer, side)
    return this
  }

  /**
   * 设置分割位置。
   * @param ratio - 归一化位置，取值位于 `[0, 1]`，小于 0.5 表示左侧更窄。
   */
  setPosition(ratio: number): void {
    this.position = Math.min(1, Math.max(0, ratio))
    if (this.active) {
      getCesiumViewer(this.context.engine.native.viewer).scene.splitPosition =
        this.position
    }
  }

  /**
   * 获取当前分割位置。
   * @returns 归一化位置。
   */
  getPosition(): number {
    return this.position
  }

  /**
   * 启用或停用卷帘对比。
   * @param active - 是否启用。
   */
  setActive(active: boolean): void {
    this.active = active
    const scene = getCesiumViewer(this.context.engine.native.viewer).scene
    if (!active) {
      scene.splitPosition = 0
      for (const { layer } of this.layers)
        layer.splitDirection = SplitDirection.NONE
    } else {
      scene.splitPosition = this.position
      for (const { layer, side } of this.layers) this.applyLayer(layer, side)
    }
  }

  /**
   * 清除卷帘效果并还原所有图层的分割方向。
   */
  clear(): void {
    for (const { layer } of this.layers)
      layer.splitDirection = SplitDirection.NONE
    this.layers.length = 0
  }

  /** 销毁卷帘对比并释放引用。 */
  destroy(): void {
    this.clear()
  }

  private applyLayer(layer: ImageryLayer, side: SwipeSide): void {
    layer.splitDirection =
      side === "left" ? SplitDirection.LEFT : SplitDirection.RIGHT
  }
}
