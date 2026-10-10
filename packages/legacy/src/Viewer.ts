import type { Arc3DConfig } from "@arc3dlab/core"
import { Arc3D, Arc3DApp } from "@arc3dlab/sdk"

export interface LegacyViewerOptions {
  defaultKey?: string
  fpsShow?: boolean
  mapboxController?: boolean
}

/**
 * Compatibility adapter around Arc3DApp.
 * New code should use `Arc3D.create()`.
 */
export class Viewer {
  readonly app: Arc3DApp

  constructor(container: string | Element, options: LegacyViewerOptions = {}) {
    const config: Arc3DConfig = {
      container,
      tokens: {
        cesiumIon: options.defaultKey,
      },
      scene: {
        fpsShow: options.fpsShow,
        controls: options.mapboxController ? "mapbox" : "default",
        creditMode: "default",
      },
    }
    this.app = Arc3D.createSync(config)
  }

  get Layers() {
    return {
      Add: {
        addPoints: (
          positions: Array<[number, number] | [number, number, number]>,
          style?: {
            color?: string
            pixelSize?: number
            clampToGround?: boolean
          },
          usePrimitive = false,
        ) =>
          this.app.graphics.addPoints({
            positions,
            style,
            renderMode: usePrimitive ? "primitive" : "entity",
          }),
        addLines: (
          positions: Array<[number, number] | [number, number, number]>,
          style?: { color?: string; width?: number; clampToGround?: boolean },
          usePrimitive = false,
        ) =>
          this.app.graphics.addPolyline({
            positions,
            style,
            renderMode: usePrimitive ? "primitive" : "entity",
          }),
        addPolygons: (
          positions: Array<[number, number] | [number, number, number]>,
          style?: {
            fill?: string
            outline?: boolean
            outlineColor?: string
            clampToGround?: boolean
          },
          usePrimitive = false,
        ) =>
          this.app.graphics.addPolygon({
            positions,
            style,
            renderMode: usePrimitive ? "primitive" : "entity",
          }),
      },
      get: (id: string) => this.app.graphics.get(id) ?? this.app.layers.imagery,
      remove: (id: string) => this.app.graphics.remove(id),
      show: (id: string, visible: boolean) =>
        this.app.graphics.show(id, visible),
      clear: () => this.app.graphics.clear(),
    }
  }

  get Terrain() {
    return this.app.terrain
  }

  get EventHandler() {
    return this.app.interaction
  }

  get ReminderTip() {
    return this.app.ui.tooltip
  }

  get native() {
    return this.app.native.viewer
  }

  get scene() {
    return (this.app.native.viewer as { scene: unknown }).scene
  }

  get camera() {
    return (this.app.native.viewer as { camera: unknown }).camera
  }

  get canvas() {
    return this.app.context.engine.viewer.canvas
  }

  destroy(): Promise<void> {
    return this.app.destroy()
  }
}
