import type { CreditMode } from "@arc3dlab/core"
import type { Viewer } from "cesium"

/**
 * 判断给定值是否可作为版权容器的挂载目标。
 *
 * 以是否具备节点挂载能力判定，避免依赖运行环境存在 `HTMLElement`
 * 全局构造器（例如无 DOM 的测试环境）。
 */
function isMountable(value: Element | undefined): value is Element {
  return (
    value !== undefined &&
    typeof (value as Element).appendChild === "function" &&
    typeof (value as Element).removeChild === "function"
  )
}

/**
 * 管理 Cesium 版权信息的展示模式与容器。
 *
 * `default` 与 `compact` 均保留版权信息本身，二者只区别布局：`compact`
 * 在保持归属信息可见的前提下压缩占位；`custom` 把版权容器挂载到业务
 * 指定的 DOM 节点。切换模式前会先把容器移回原始父节点并清除本管理器
 * 施加的内联样式，因此可反复切换而不丢失原始位置。
 */
export class CreditManager {
  private mode: CreditMode = "default"
  private customContainer: Element | undefined
  private readonly creditContainer: HTMLElement
  private readonly originalParent: Node | undefined
  private readonly baselineDisplay: string

  /**
   * 创建版权信息管理器。
   * @param viewer - 关联的原生 Cesium Viewer 实例。
   */
  constructor(private readonly viewer: Viewer) {
    this.creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement
    this.originalParent = this.creditContainer.parentNode ?? undefined
    this.baselineDisplay = this.creditContainer.style.display ?? ""
  }

  /**
   * 设置版权信息的展示模式，可挂载到自定义容器。
   * @param mode - 版权展示模式。
   * @param container - 可选的自定义容器元素。
   */
  setMode(mode: CreditMode, container?: Element): void {
    this.restore()
    this.mode = mode
    this.customContainer = undefined
    if (mode === "custom" && isMountable(container)) {
      this.customContainer = container
      container.appendChild(this.creditContainer)
      return
    }
    if (mode === "compact") this.applyCompact()
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
    return this.customContainer ?? this.creditContainer
  }

  /** 压缩版权容器占位，但不隐藏归属信息。 */
  private applyCompact(): void {
    const style = this.creditContainer.style
    style.fontSize = "10px"
    style.lineHeight = "1.2"
    style.padding = "2px 4px"
  }

  /** 将版权容器移回原始父节点并清除压缩样式。 */
  private restore(): void {
    const parent = this.creditContainer.parentNode
    if (this.originalParent && parent !== this.originalParent) {
      this.originalParent.appendChild(this.creditContainer)
    }
    const style = this.creditContainer.style
    style.display = this.baselineDisplay
    style.fontSize = ""
    style.lineHeight = ""
    style.padding = ""
  }
}
