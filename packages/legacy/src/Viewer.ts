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
 *
 * @deprecated Since 1.0.0-alpha.1. Use `Arc3D.create()` (stable) instead.
 * This adapter only maps a small subset of the legacy surface:
 * `Layers.Add.addPoints/addLines/addPolygons`, `Layers.get/remove/show/clear`,
 * `Terrain`, `EventHandler`, `ReminderTip`, plus `native/scene/camera/canvas`
 * escape hatches. Legacy-only concepts without a counterpart (Popup tip DOM,
 * built-in creator factories, mapbox controller flags beyond `controls`) are
 * intentionally unsupported and map to the closest primitive.
 *
 * `native` / `scene` / `camera` / `canvas` are advanced, unstable escape
 * hatches bound to the Cesium runtime and are excluded from SemVer guarantees.
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
      get: (id: string) =>
        this.app.graphics.get(id) ?? this.app.context.registry.get(id),
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
