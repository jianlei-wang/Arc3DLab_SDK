import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { toCartesian3 } from "@arc3dlab/engine-cesium"
import { ClippingPolygon, ClippingPolygonCollection } from "cesium"

/**
 * 可应用压平裁剪的目标对象，具备 `clippingPolygons` 属性时为瓦片集。
 */
export interface FlattenTarget {
  /** 目标对象的裁剪多边形集合。 */
  clippingPolygons?: unknown
}

/**
 * 模型压平选项。
 */
export interface ModelFlattenOptions {
  /** 初始是否启用压平，默认为 true。 */
  enabled?: boolean
  /** 裁剪质量，取值范围 0 到 1，越大越精确。 */
  quality?: number
}

/**
 * 模型压平对象，将多个多边形合并后应用到目标模型或瓦片集的裁剪集合。
 */
export class ModelFlatten {
  private readonly collection: ClippingPolygonCollection
  private readonly polygons: ClippingPolygon[] = []
  private readonly target: FlattenTarget | undefined

  /**
   * 创建模型压平对象。
   * @param context - Arc3D 运行时上下文。
   * @param target - 可选的压平目标对象。
   * @param options - 压平选项。
   */
  constructor(
    context: Arc3DContext,
    target?: FlattenTarget,
    options: ModelFlattenOptions = {},
  ) {
    void context
    this.target = target
    this.collection = new ClippingPolygonCollection({
      enabled: options.enabled ?? true,
      quality: options.quality,
    })
    if (target) target.clippingPolygons = this.collection
  }

  /** 当前压平多边形数量。 */
  get count(): number {
    return this.polygons.length
  }

  /** 压平是否启用。 */
  get enabled(): boolean {
    return this.collection.enabled
  }

  /**
   * 添加一个压平多边形。
   * @param positions - 多边形边界节点。
   * @returns 该多边形在集合中的索引。
   */
  addPolygon(positions: PositionInput[]): number {
    const polygon = new ClippingPolygon({
      positions: positions.map((input) => toCartesian3(input)),
    })
    this.polygons.push(polygon)
    this.collection.add(polygon)
    return this.polygons.length - 1
  }

  /**
   * 启用或停用压平效果。
   * @param enabled - 是否启用。
   */
  setEnabled(enabled: boolean): void {
    this.collection.enabled = enabled
  }

  /**
   * 清除全部压平多边形。
   */
  clear(): void {
    this.collection.removeAll()
    this.polygons.length = 0
  }

  /**
   * 销毁压平对象，移除多边形并解除与目标对象的关联。
   */
  destroy(): void {
    this.clear()
    if (this.target && this.target.clippingPolygons === this.collection) {
      this.target.clippingPolygons = undefined
    }
  }
}
