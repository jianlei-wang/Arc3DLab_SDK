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

/**
 * 工具提示服务，负责在 Cesium 容器内创建、显示与定位提示文本。
 */
export class TooltipService {
  private element: HTMLDivElement
  private message = ""
  private visible = false
  private onMove: (event: MouseEvent) => void
  private listening = false
  private readonly owned: boolean

  /**
   * 创建工具提示服务实例。
   * @param context - Arc3D 运行时上下文
   */
  constructor(private readonly context: Arc3DContext) {
    const viewer = getCesiumViewer(context.engine.native.viewer)
    const host = viewer.container as HTMLElement
    this.element = createOwnedTooltipElement(
      `arc3d-tooltip-${createId("tooltip")}`,
    )
    this.owned = true
    host.appendChild(this.element)
    this.onMove = (event) => this.place(event)
  }

  /**
   * 提示文本内容。
   */
  set text(value: string) {
    this.message = value
    this.element.textContent = value
  }

  get text(): string {
    return this.message
  }

  /**
   * 显示提示，并可同时更新提示文本。
   * @param text - 可选的新提示文本
   */
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

  /**
   * 隐藏提示并清空文本。
   */
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

  /**
   * 销毁工具提示并移除其 DOM 元素。
   */
  destroy(): void {
    this.hide()
    if (this.owned) removeOwnedTooltip(this.element)
  }

  private place(event: MouseEvent): void {
    if (!this.visible) return
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const host = viewer.container as HTMLElement
    const position = hostRelativePosition(
      event.clientX,
      event.clientY,
      host.getBoundingClientRect(),
    )
    this.element.textContent = this.message
    const offset = tooltipOffsetStyle(position)
    this.element.style.left = offset.left
    this.element.style.top = offset.top
    this.element.style.display = "block"
  }
}

/**
 * UI 管理器，聚合界面相关的服务。
 */
export class UIManager {
  /**
   * 工具提示服务实例。
   */
  readonly tooltip: TooltipService

  /**
   * 创建 UI 管理器实例。
   * @param context - Arc3D 运行时上下文
   */
  constructor(context: Arc3DContext) {
    this.tooltip = new TooltipService(context)
  }

  /**
   * 销毁 UI 管理器并释放相关资源。
   */
  destroy(): void {
    this.tooltip.destroy()
  }
}
