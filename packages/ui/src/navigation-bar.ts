import { Arc3DError, type Arc3DContext } from "@arc3dlab/core"
import {
  getCesiumViewer,
  getNativeSceneModeName,
  morphNativeScene,
  toRadians,
} from "@arc3dlab/engine-cesium"

/** 导航条可提供的控件类型。 */
export type NavigationControl = "zoomIn" | "zoomOut" | "home" | "top" | "mode"

/** 导航条控件的提示文案。 */
export interface NavigationBarLabels {
  /** 放大控件提示。 */
  zoomIn: string
  /** 缩小控件提示。 */
  zoomOut: string
  /** 复位控件提示。 */
  home: string
  /** 俯视控件提示。 */
  top: string
  /** 二三维切换控件提示。 */
  mode: string
}

/** 创建导航条时使用的 DOM 工厂，便于测试注入。 */
export interface NavigationBarDocument {
  /** 创建指定标签的元素。 */
  createElement(tag: string): HTMLElement
}

/** 导航条配置项。 */
export interface NavigationBarOptions {
  /** 宿主容器，缺省时在挂载时使用视图容器。 */
  container?: HTMLElement
  /** 启用的控件及其顺序，缺省为全部控件。 */
  controls?: NavigationControl[]
  /** 复位使用的过渡时长（秒），缺省为 2。 */
  duration?: number
  /** 缩放控件每次操作的相对比例，缺省为 0.5。 */
  zoomRatio?: number
  /** 控件提示文案覆盖。 */
  labels?: Partial<NavigationBarLabels>
  /** DOM 工厂，缺省使用全局 document。 */
  document?: NavigationBarDocument
}

const DEFAULT_CONTROLS: NavigationControl[] = [
  "zoomIn",
  "zoomOut",
  "home",
  "top",
  "mode",
]

const DEFAULT_LABELS: NavigationBarLabels = {
  zoomIn: "放大",
  zoomOut: "缩小",
  home: "复位",
  top: "俯视",
  mode: "二三维切换",
}

const CONTROL_TEXT: Record<NavigationControl, string> = {
  zoomIn: "+",
  zoomOut: "-",
  home: "⌂",
  top: "◎",
  mode: "◲",
}

interface HomeSnapshot {
  position: ReturnType<typeof getCesiumViewer>["camera"]["positionWC"]
  orientation: { heading: number; pitch: number; roll: number }
}

/**
 * 导航条组件，在视图容器内渲染放大、缩小、复位、俯视与二三维切换控件。
 */
export class NavigationBar {
  private readonly controls: NavigationControl[]
  private readonly labels: NavigationBarLabels
  private readonly duration: number
  private readonly zoomRatio: number
  private readonly doc: NavigationBarDocument | undefined
  private readonly listeners: Array<{
    element: HTMLElement
    type: string
    handler: EventListener
  }> = []
  private root: HTMLElement | undefined
  private home: HomeSnapshot | undefined

  /**
   * 创建导航条组件。
   * @param context - Arc3D 运行时上下文。
   * @param options - 导航条配置项。
   */
  constructor(
    private readonly context: Arc3DContext,
    options: NavigationBarOptions = {},
  ) {
    this.controls = options.controls ?? DEFAULT_CONTROLS
    this.labels = { ...DEFAULT_LABELS, ...options.labels }
    this.duration = options.duration ?? 2
    this.zoomRatio = options.zoomRatio ?? 0.5
    this.doc =
      options.document ??
      (globalThis as { document?: NavigationBarDocument }).document
    this.container = options.container
  }

  private container: HTMLElement | undefined

  /** 导航条当前是否已挂载。 */
  get mounted(): boolean {
    return this.root !== undefined
  }

  /**
   * 将导航条挂载到宿主容器。
   * @param container - 可选宿主容器，缺省使用构造时提供或视图容器。
   * @throws {Arc3DError} 当缺少可用容器或 DOM 工厂时抛出，错误码为 `INVALID_CONTAINER`。
   */
  mount(container?: HTMLElement): void {
    if (this.root) return
    const host = container ?? this.container ?? this.viewerContainer()
    if (!host) {
      throw new Arc3DError(
        "INVALID_CONTAINER",
        "NavigationBar container is required",
      )
    }
    if (!this.doc) {
      throw new Arc3DError(
        "INVALID_CONTAINER",
        "NavigationBar document is unavailable",
      )
    }
    const root = this.doc.createElement("div")
    root.className = "arc3d-navigation-bar"
    root.setAttribute("data-arc3d-owned", "true")
    root.style.cssText =
      "position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:4px;z-index:900;"
    for (const control of this.controls) {
      root.appendChild(this.createButton(control))
    }
    this.root = root
    this.container = host
    host.appendChild(root)
    this.home = this.captureHome()
  }

  /**
   * 卸载导航条，移除事件监听与 DOM 元素。
   */
  destroy(): void {
    for (const { element, type, handler } of this.listeners) {
      element.removeEventListener(type, handler)
    }
    this.listeners.length = 0
    this.root?.remove()
    this.root = undefined
    this.home = undefined
  }

  private createButton(control: NavigationControl): HTMLButtonElement {
    const button = this.doc!.createElement("button") as HTMLButtonElement
    button.type = "button"
    button.className = `arc3d-navigation-bar__control arc3d-navigation-bar__control--${control}`
    button.setAttribute("data-arc3d-control", control)
    button.setAttribute("title", this.labels[control])
    button.setAttribute("aria-label", this.labels[control])
    button.textContent = CONTROL_TEXT[control]
    button.style.cssText =
      "width:30px;height:30px;line-height:1;cursor:pointer;color:#fff;background:#00000080;border:1px solid #ffffff40;border-radius:4px;font-size:14px;"
    const handler: EventListener = () => this.run(control)
    button.addEventListener("click", handler)
    this.listeners.push({ element: button, type: "click", handler })
    return button
  }

  private run(control: NavigationControl): void {
    this.context.lifecycle.assertUsable(`use navigation control (${control})`)
    if (control === "zoomIn") this.zoom(1)
    else if (control === "zoomOut") this.zoom(-1)
    else if (control === "home") this.goHome()
    else if (control === "top") this.lookTop()
    else this.toggleMode()
  }

  private zoom(direction: number): void {
    const viewer = this.viewer()
    const height = Math.abs(viewer.camera.positionCartographic.height)
    const amount = Math.max(height * this.zoomRatio, 10) * direction
    viewer.camera.zoomIn(amount)
  }

  private goHome(): void {
    if (!this.home) return
    this.viewer().camera.setView({
      destination: this.home.position,
      orientation: this.home.orientation,
    })
  }

  private lookTop(): void {
    const camera = this.viewer().camera
    camera.setView({
      orientation: {
        heading: camera.heading,
        pitch: toRadians(-90, "degrees"),
        roll: 0,
      },
    })
  }

  private toggleMode(): void {
    const viewer = this.viewer()
    const next = getNativeSceneModeName(viewer) === "3d" ? "2d" : "3d"
    morphNativeScene(viewer, next)
  }

  private captureHome(): HomeSnapshot {
    const camera = this.viewer().camera
    return {
      position: camera.positionWC,
      orientation: {
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll,
      },
    }
  }

  private viewer(): ReturnType<typeof getCesiumViewer> {
    return getCesiumViewer(this.context.engine.native.viewer)
  }

  private viewerContainer(): HTMLElement | undefined {
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    return (viewer.container as HTMLElement | undefined) ?? undefined
  }
}
