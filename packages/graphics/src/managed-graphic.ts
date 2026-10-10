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

export class ManagedGraphic implements Graphic {
  owned = true
  native: unknown
  private destroyed = false
  private currentPositions: LngLatHeight[]

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

  get positions(): LngLatHeight[] {
    return this.currentPositions
  }

  get editable(): boolean {
    return this.renderMode === "entity"
  }

  get visible(): boolean {
    return this._visible
  }

  set visible(value: boolean) {
    this._visible = value
    this.setVisible(value)
    this.onChange?.("graphic-visible")
  }

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

  remove(): void {
    this.destroy()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.teardown()
    this.onChange?.("graphic-removed")
  }
}
