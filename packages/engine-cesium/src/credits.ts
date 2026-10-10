import type { CreditMode } from "@arc3dlab/core"
import type { Viewer } from "cesium"

/**
 * 管理 Cesium 版权信息的展示模式与容器。
 */
export class CreditManager {
  private mode: CreditMode = "default"
  private customContainer: Element | undefined

  /**
   * 创建版权信息管理器。
   * @param viewer - 关联的原生 Cesium Viewer 实例。
   */
  constructor(private readonly viewer: Viewer) {}

  /**
   * 设置版权信息的展示模式，可挂载到自定义容器。
   * @param mode - 版权展示模式。
   * @param container - 可选的自定义容器元素。
   */
  setMode(mode: CreditMode, container?: Element): void {
    this.mode = mode
    this.customContainer = container
    const creditContainer = this.viewer.cesiumWidget
      .creditContainer as HTMLElement
    if (mode === "custom" && container instanceof HTMLElement) {
      creditContainer.style.display = "none"
      container.appendChild(creditContainer)
      creditContainer.style.display = ""
      return
    }
    creditContainer.style.display = mode === "compact" ? "none" : ""
  }

  /**
   * 获取当前版权展示模式。
   * @returns 当前版权展示模式。
   */
  getMode(): CreditMode {
    return this.mode
  }

  /**
   * 获取当前版权信息所在的容器元素。
   * @returns 自定义容器或原生版权容器。
   */
  getContainer(): Element | undefined {
    return (
      this.customContainer ??
      (this.viewer.cesiumWidget.creditContainer as Element)
    )
  }
}
