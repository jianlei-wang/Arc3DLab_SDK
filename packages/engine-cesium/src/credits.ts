import type { CreditMode } from "@arc3dlab/core"
import type { Viewer } from "cesium"

export class CreditManager {
  private mode: CreditMode = "default"
  private customContainer: Element | undefined

  constructor(private readonly viewer: Viewer) {}

  setMode(mode: CreditMode, container?: Element): void {
    this.mode = mode
    this.customContainer = container
    const creditContainer = this.viewer.cesiumWidget.creditContainer as HTMLElement
    if (mode === "custom" && container instanceof HTMLElement) {
      creditContainer.style.display = "none"
      container.appendChild(creditContainer)
      creditContainer.style.display = ""
      return
    }
    creditContainer.style.display = mode === "compact" ? "none" : ""
  }

  getMode(): CreditMode {
    return this.mode
  }

  getContainer(): Element | undefined {
    return this.customContainer ?? (this.viewer.cesiumWidget.creditContainer as Element)
  }
}
