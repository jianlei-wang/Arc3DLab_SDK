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

export interface InteractionPickEvent extends PickResult {
  graphic?: { id: string }
  layer?: { id: string }
}

type InteractionEvents = {
  click: InteractionPickEvent
  hover: InteractionPickEvent
  move: { windowPosition: WindowPosition }
}

export class SelectionController {
  private selectedId: string | undefined

  constructor(private readonly context: Arc3DContext) {}

  get id(): string | undefined {
    return this.selectedId
  }

  get(): ResourceHandle | undefined {
    if (!this.selectedId) return undefined
    return this.context.registry.get(this.selectedId)
  }

  set(id: string | undefined): void {
    this.context.lifecycle.assertUsable("set selection")
    this.selectedId = id
  }

  clear(): void {
    this.selectedId = undefined
  }
}

export class InteractionManager {
  private handler: ScreenSpaceEventHandler | undefined
  private listeners = new Map<
    keyof InteractionEvents,
    Set<(payload: never) => void>
  >()
  readonly selection: SelectionController
  private readonly hoverGate = new HoverGate()
  private readonly canvas: HTMLCanvasElement
  private readonly onCanvasLeave = (): void => {
    if (!this.hoverGate.leave()) return
    this.emit("hover", this.emptyPick())
  }

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

  pickGraphic(windowPosition: WindowPosition): { id: string } | undefined {
    return this.pick(windowPosition).graphic
  }

  pickLayer(windowPosition: WindowPosition): { id: string } | undefined {
    return this.pick(windowPosition).layer
  }

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
