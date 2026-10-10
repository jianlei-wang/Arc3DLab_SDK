import {
  Arc3DError,
  assertGraphicStyle,
  assertPositions,
  type GraphicStyle,
  type LngLatHeight,
  type PositionInput,
} from "@arc3dlab/core"
import { ColorGeometryInstanceAttribute } from "cesium"
import type { ConcreteRenderMode } from "./policy"
import {
  applyNativeStyle,
  assertMutableStyle,
  mergeGraphicStyle,
} from "./style"
import { asList, parseColor, toLngLatHeights } from "./helpers"
import type { Graphic } from "./types"

/**
 * 受管图形实现，封装原生渲染对象并对外暴露位置、可见性与样式更新能力。
 */
export class ManagedGraphic implements Graphic {
  /** 该图形持有的资源是否由本对象负责释放。 */
  owned = true
  /** 底层的原生 Cesium 渲染对象。 */
  native: unknown
  private destroyed = false
  private currentPositions: LngLatHeight[]

  /**
   * 创建受管图形。
   * @param id - 图形唯一 ID。
   * @param type - 图形类型。
   * @param renderMode - 图形采用的具体渲染模式。
   * @param native - 底层原生渲染对象。
   * @param teardown - 释放原生资源的回调。
   * @param setVisible - 设置原生对象可见性的回调。
   * @param positions - 图形初始经纬高坐标。
   * @param currentStyle - 图形当前样式。
   * @param applyPositions - 应用坐标更新的可选回调。
   * @param onChange - 图形发生变更时的可选回调。
   */
  constructor(
    readonly id: string,
    readonly type: string,
    readonly renderMode: ConcreteRenderMode,
    native: unknown,
    private readonly teardown: () => void,
    private readonly setVisible: (visible: boolean) => void,
    positions: LngLatHeight[],
    private currentStyle: GraphicStyle,
    private readonly applyPositions?: (positions: PositionInput[]) => void,
    private readonly onChange?: (reason: string) => void,
  ) {
    this.native = native
    this.currentPositions = positions
  }

  private _visible = true

  /**
   * 图形的经纬高坐标序列。
   */
  get positions(): LngLatHeight[] {
    return this.currentPositions
  }

  /**
   * 图形是否可编辑，仅实体渲染模式为 true。
   */
  get editable(): boolean {
    return this.renderMode === "entity"
  }

  /**
   * 图形的可见性。
   */
  get visible(): boolean {
    return this._visible
  }

  set visible(value: boolean) {
    this._visible = value
    this.setVisible(value)
    this.onChange?.("graphic-visible")
  }

  /**
   * 更新图形样式。
   * @param style - 待应用的图形样式。
   */
  setStyle(style: GraphicStyle): void {
    assertGraphicStyle(style)
    assertMutableStyle(this.type, this.renderMode, this.currentStyle, style)
    applyNativeStyle(
      {
        id: this.id,
        type: this.type,
        renderMode: this.renderMode,
        native: this.native,
      },
      style,
      {
        color: (css) => parseColor(css, "#ffffff"),
        colorAttribute: (css) =>
          ColorGeometryInstanceAttribute.toValue(parseColor(css, "#ffffff")),
      },
    )
    this.currentStyle = mergeGraphicStyle(this.currentStyle, style)
    this.onChange?.("graphic-style")
  }

  /**
   * 更新图形坐标。
   * @param positions - 单个坐标或坐标数组。
   */
  setPositions(positions: PositionInput | PositionInput[]): void {
    const list = asList(positions)
    const min = this.type === "polygon" ? 3 : this.type === "polyline" ? 2 : 1
    assertPositions(list, min, this.type)
    if (!this.applyPositions) {
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        `${this.renderMode} ${this.type} positions cannot be changed after create`,
      )
    }
    this.applyPositions(list)
    this.currentPositions = toLngLatHeights(list)
    this.onChange?.("graphic-positions")
  }

  /**
   * 移除该图形，等价于销毁。
   */
  remove(): void {
    this.destroy()
  }

  /**
   * 销毁该图形并释放原生资源，重复调用无副作用。
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.teardown()
    this.onChange?.("graphic-removed")
  }
}
