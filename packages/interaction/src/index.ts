import type {
  Arc3DContext,
  PickResult,
  ResourceHandle,
  Unsubscribe,
  WindowPosition,
} from "@arc3dlab/core"
import { fromCartesian3, getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  Cartesian2,
  Cesium3DTileFeature,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
} from "cesium"
import {
  HoverGate,
  normalizeResourceId,
  pickIdentity,
  resolvePick,
} from "./pick"

export {
  HoverGate,
  classifyPickedId,
  normalizeResourceId,
  parentResourceId,
  pickIdentity,
  resolvePick,
} from "./pick"

/**
 * 交互拾取事件，在通用拾取结果之上附加图形与图层信息。
 */
export interface InteractionPickEvent extends PickResult {
  /** 命中的图形对象。 */
  graphic?: { id: string }
  /** 命中的图层对象。 */
  layer?: { id: string }
}

type InteractionEvents = {
  click: InteractionPickEvent
  hover: InteractionPickEvent
  move: { windowPosition: WindowPosition }
}

/**
 * 维护当前选中资源的标识，并提供选中状态的读写操作。
 */
export class SelectionController {
  private selectedId: string | undefined

  /**
   * 创建选中状态控制器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /** 当前选中资源的标识。 */
  get id(): string | undefined {
    return this.selectedId
  }

  /**
   * 获取当前选中资源对应的资源句柄。
   * @returns 选中的资源句柄，未选中时返回 undefined。
   */
  get(): ResourceHandle | undefined {
    if (!this.selectedId) return undefined
    return this.context.registry.get(this.selectedId)
  }

  /**
   * 设置当前选中的资源标识。
   * @param id - 要选中的资源标识。
   */
  set(id: string | undefined): void {
    this.context.lifecycle.assertUsable("set selection")
    this.selectedId = id
  }

  /**
   * 清除当前选中状态。
   */
  clear(): void {
    this.selectedId = undefined
  }
}

/**
 * 统一处理画布上的点击、悬停与移动交互事件。
 */
export class InteractionManager {
  private handler: ScreenSpaceEventHandler | undefined
  private listeners = new Map<
    keyof InteractionEvents,
    Set<(payload: never) => void>
  >()
  /** 选中状态控制器。 */
  readonly selection: SelectionController
  private readonly hoverGate = new HoverGate()
  private readonly canvas: HTMLCanvasElement
  private readonly onCanvasLeave = (): void => {
    if (!this.hoverGate.leave()) return
    this.emit("hover", this.emptyPick())
  }

  /**
   * 创建交互管理器并在画布上注册输入事件。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {
    const viewer = getCesiumViewer(context.engine.native.viewer)
    this.canvas = viewer.canvas
    this.selection = new SelectionController(context)
    this.handler = new ScreenSpaceEventHandler(viewer.canvas)
    this.handler.setInputAction(
      (movement: { position: { x: number; y: number } }) => {
        const event = this.pick(movement.position)
        if (event.graphicId) this.selection.set(event.graphicId)
        else this.selection.clear()
        this.emit("click", event)
        this.context.events.emit("pick", event)
      },
      ScreenSpaceEventType.LEFT_CLICK,
    )
    this.handler.setInputAction(
      (movement: { endPosition: { x: number; y: number } }) => {
        const windowPosition = {
          x: movement.endPosition.x,
          y: movement.endPosition.y,
        }
        const event = this.pick(windowPosition)
        if (this.hoverGate.observe(pickIdentity(event)))
          this.emit("hover", event)
        this.emit("move", { windowPosition })
      },
      ScreenSpaceEventType.MOUSE_MOVE,
    )
    this.canvas.addEventListener("mouseleave", this.onCanvasLeave)
  }

  /**
   * 注册交互事件监听器。
   * @param event - 事件名称。
   * @param handler - 事件处理函数。
   * @returns 用于取消订阅的函数。
   */
  on<K extends keyof InteractionEvents>(
    event: K,
    handler: (payload: InteractionEvents[K]) => void,
  ): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as (payload: never) => void)
    return () => this.off(event, handler)
  }

  /**
   * 移除交互事件监听器，未提供处理函数时移除该事件的全部监听器。
   * @param event - 事件名称。
   * @param handler - 可选的事件处理函数。
   */
  off<K extends keyof InteractionEvents>(
    event: K,
    handler?: (payload: InteractionEvents[K]) => void,
  ): void {
    if (!handler) {
      this.listeners.delete(event)
      return
    }
    this.listeners.get(event)?.delete(handler as (payload: never) => void)
  }

  /**
   * 在指定窗口坐标处执行拾取并返回拾取结果。
   * @param windowPosition - 窗口坐标位置。
   * @returns 交互拾取事件。
   */
  pick(windowPosition: WindowPosition): InteractionPickEvent {
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const window = new Cartesian2(windowPosition.x, windowPosition.y)
    const picked = viewer.scene.pick(window)
    let cartesian: ReturnType<typeof viewer.scene.pickPosition> | undefined
    try {
      cartesian = viewer.scene.pickPosition(window)
    } catch {
      cartesian = undefined
    }
    if (!defined(cartesian)) {
      cartesian = viewer.camera.pickEllipsoid(
        window,
        viewer.scene.globe.ellipsoid,
      )
    }
    const hasNative =
      defined(picked) && typeof picked === "object" && picked !== null
    const rawId = hasNative
      ? normalizeResourceId((picked as { id?: unknown }).id)
      : undefined
    let tilesetId: string | undefined
    if (picked instanceof Cesium3DTileFeature) {
      tilesetId = this.context.registry
        .values()
        .find((item) => item.native === picked.tileset)?.id
    }
    const resolved = resolvePick({
      rawId,
      lookup: (resourceId) => this.context.registry.get(resourceId),
      tilesetId,
      isTerrain: !hasNative && defined(cartesian),
      hasNative,
    })
    return {
      kind: resolved.kind,
      windowPosition,
      graphicId: resolved.graphicId,
      layerId: resolved.layerId,
      graphic: resolved.graphicId ? { id: resolved.graphicId } : undefined,
      layer: resolved.layerId ? { id: resolved.layerId } : undefined,
      lngLat: defined(cartesian) ? fromCartesian3(cartesian) : undefined,
      native: picked,
    }
  }

  /**
   * 在指定窗口坐标处拾取图形。
   * @param windowPosition - 窗口坐标位置。
   * @returns 命中的图形，未命中时返回 undefined。
   */
  pickGraphic(windowPosition: WindowPosition): { id: string } | undefined {
    return this.pick(windowPosition).graphic
  }

  /**
   * 在指定窗口坐标处拾取图层。
   * @param windowPosition - 窗口坐标位置。
   * @returns 命中的图层，未命中时返回 undefined。
   */
  pickLayer(windowPosition: WindowPosition): { id: string } | undefined {
    return this.pick(windowPosition).layer
  }

  /**
   * 销毁交互管理器并释放已注册的事件监听。
   */
  destroy(): void {
    this.canvas.removeEventListener("mouseleave", this.onCanvasLeave)
    if (this.handler && !this.handler.isDestroyed()) {
      this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK)
      this.handler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE)
      this.handler.destroy()
    }
    this.handler = undefined
    this.listeners.clear()
    this.selection.clear()
    this.hoverGate.reset()
  }

  private emit<K extends keyof InteractionEvents>(
    event: K,
    payload: InteractionEvents[K],
  ): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of Array.from(set)) handler(payload as never)
  }

  private emptyPick(): InteractionPickEvent {
    return { kind: "empty", windowPosition: { x: -1, y: -1 } }
  }
}
