import type { Arc3DContext, PickResult, Unsubscribe, WindowPosition } from "@arc3dlab/core"
import { fromCartesian3, getCesiumViewer } from "@arc3dlab/engine-cesium"
import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, defined } from "cesium"

export interface InteractionClickEvent extends PickResult {
  graphic?: { id: string }
}

type InteractionEvents = {
  click: InteractionClickEvent
  move: { windowPosition: WindowPosition }
}

export class InteractionManager {
  private handler: ScreenSpaceEventHandler | undefined
  private listeners = new Map<keyof InteractionEvents, Set<(payload: never) => void>>()

  constructor(private readonly context: Arc3DContext) {
    const viewer = getCesiumViewer(context.engine.native.viewer)
    this.handler = new ScreenSpaceEventHandler(viewer.canvas)
    this.handler.setInputAction((movement: { position: { x: number; y: number } }) => {
      const event = this.pick(movement.position)
      this.emit("click", event)
      this.context.events.emit("pick", event)
    }, ScreenSpaceEventType.LEFT_CLICK)
    this.handler.setInputAction((movement: { endPosition: { x: number; y: number } }) => {
      this.emit("move", { windowPosition: { x: movement.endPosition.x, y: movement.endPosition.y } })
    }, ScreenSpaceEventType.MOUSE_MOVE)
  }

  on<K extends keyof InteractionEvents>(event: K, handler: (payload: InteractionEvents[K]) => void): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as (payload: never) => void)
    return () => this.off(event, handler)
  }

  off<K extends keyof InteractionEvents>(event: K, handler?: (payload: InteractionEvents[K]) => void): void {
    if (!handler) {
      this.listeners.delete(event)
      return
    }
    this.listeners.get(event)?.delete(handler as (payload: never) => void)
  }

  pick(windowPosition: WindowPosition): InteractionClickEvent {
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const window = new Cartesian2(windowPosition.x, windowPosition.y)
    const picked = viewer.scene.pick(window)
    const cartesian = viewer.camera.pickEllipsoid(window, viewer.scene.globe.ellipsoid)
    const graphicId = defined(picked) && picked.id ? String(typeof picked.id === "object" && picked.id.id ? picked.id.id : picked.id) : undefined
    return {
      windowPosition,
      graphicId,
      graphic: graphicId ? { id: graphicId } : undefined,
      lngLat: cartesian ? fromCartesian3(cartesian) : undefined,
      native: picked,
    }
  }

  destroy(): void {
    if (this.handler && !this.handler.isDestroyed()) {
      this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK)
      this.handler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE)
      this.handler.destroy()
    }
    this.handler = undefined
    this.listeners.clear()
  }

  private emit<K extends keyof InteractionEvents>(event: K, payload: InteractionEvents[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of Array.from(set)) handler(payload as never)
  }
}
