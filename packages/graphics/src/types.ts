import type {
  GraphicStyle,
  LngLatHeight,
  PositionInput,
  RenderMode,
  ResourceHandle,
} from "@arc3dlab/core"
import type { ConcreteRenderMode } from "./policy"

export interface Graphic extends ResourceHandle {
  readonly renderMode: ConcreteRenderMode
  readonly positions: LngLatHeight[]
  readonly editable: boolean
  setStyle(style: GraphicStyle): void
  setPositions(positions: PositionInput | PositionInput[]): void
  remove(): void
}

export interface GraphicCreateOptions {
  id?: string
  positions: PositionInput | PositionInput[]
  style?: GraphicStyle
  renderMode?: RenderMode
  dynamic?: boolean
  properties?: Record<string, unknown>
}

export interface ModelCreateOptions {
  id?: string
  url: string
  position: PositionInput
  scale?: number
  minimumPixelSize?: number
  heading?: number
  pitch?: number
  roll?: number
  properties?: Record<string, unknown>
}
