import { createId, type Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  createOwnedTooltipElement,
  hostRelativePosition,
  removeOwnedTooltip,
  tooltipOffsetStyle,
} from "./tooltip-dom"

export {
  TOOLTIP_OWNED_ATTR,
  createOwnedTooltipElement,
  hostRelativePosition,
  removeOwnedTooltip,
  tooltipOffsetStyle,
} from "./tooltip-dom"

export class TooltipService {
  private element: HTMLDivElement
  private message = ""
  private visible = false
  private onMove: (event: MouseEvent) => void
  private listening = false
  private readonly owned: boolean

  constructor(private readonly context: Arc3DContext) {
    const viewer = getCesiumViewer(context.engine.native.viewer)
    const host = viewer.container as HTMLElement
    this.element = createOwnedTooltipElement(`arc3d-tooltip-${createId("tooltip")}`)
    this.owned = true
    host.appendChild(this.element)
    this.onMove = (event) => this.place(event)
  }

  set text(value: string) {
    this.message = value
    this.element.textContent = value
  }

  get text(): string {
    return this.message
  }

  show(text?: string): void {
    if (text !== undefined) this.text = text
    this.visible = true
    if (!this.listening) {
      const viewer = getCesiumViewer(this.context.engine.native.viewer)
      viewer.canvas.addEventListener("mousemove", this.onMove)
      this.listening = true
    }
    this.context.engine.viewer.requestRender?.("tooltip")
  }

  hide(): void {
    this.visible = false
    if (this.listening) {
      const viewer = getCesiumViewer(this.context.engine.native.viewer)
      viewer.canvas.removeEventListener("mousemove", this.onMove)
      this.listening = false
    }
    this.element.style.display = "none"
    this.text = ""
  }

  destroy(): void {
    this.hide()
    if (this.owned) removeOwnedTooltip(this.element)
  }

  private place(event: MouseEvent): void {
    if (!this.visible) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const host = viewer.container as HTMLElement
    const position = hostRelativePosition(event.clientX, event.clientY, host.getBoundingClientRect())
    this.element.textContent = this.message
    const offset = tooltipOffsetStyle(position)
    this.element.style.left = offset.left
    this.element.style.top = offset.top
    this.element.style.display = "block"
  }
}

export class UIManager {
  readonly tooltip: TooltipService

  constructor(context: Arc3DContext) {
    this.tooltip = new TooltipService(context)
  }

  destroy(): void {
    this.tooltip.destroy()
  }
}
