import type { Arc3DContext, WindowPosition } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"

export class TooltipService {
  private element: HTMLDivElement
  private message = ""
  private visible = false
  private onMove: (event: MouseEvent) => void

  constructor(private readonly context: Arc3DContext) {
    const viewer = getCesiumViewer(context.engine.native.viewer)
    const host = viewer.container as HTMLElement
    const existing = host.querySelector("#arc3d-tooltip") as HTMLDivElement | null
    this.element = existing ?? document.createElement("div")
    this.element.id = "arc3d-tooltip"
    this.element.style.cssText =
      "display:none;pointer-events:none;position:absolute;z-index:1000;opacity:0.8;border-radius:4px;padding:4px 8px;white-space:nowrap;color:#fff;font-size:14px;background:#000000cc;"
    if (!existing) host.appendChild(this.element)
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
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    viewer.canvas.addEventListener("mousemove", this.onMove)
  }

  hide(): void {
    this.visible = false
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    viewer.canvas.removeEventListener("mousemove", this.onMove)
    this.element.style.display = "none"
    this.text = ""
  }

  destroy(): void {
    this.hide()
    this.element.remove()
  }

  private place(event: MouseEvent): void {
    if (!this.visible) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const rect = viewer.canvas.getBoundingClientRect()
    const position: WindowPosition = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    this.element.textContent = this.message
    this.element.style.left = `${position.x + 15}px`
    this.element.style.top = `${position.y + 20}px`
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
