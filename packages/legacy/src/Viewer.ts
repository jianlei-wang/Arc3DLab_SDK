import type { Arc3DConfig } from "@arc3dlab/core"
import { Arc3D, Arc3DApp } from "@arc3dlab/sdk"

/**
 * 旧版查看器的可选配置。
 */
export interface LegacyViewerOptions {
  /**
   * Cesium ion 默认访问令牌。
   */
  defaultKey?: string
  /**
   * 是否显示帧率。
   */
  fpsShow?: boolean
  /**
   * 是否使用 mapbox 控制器。
   */
  mapboxController?: boolean
}

/**
 * 围绕 Arc3DApp 的兼容适配器，供旧版 Viewer API 迁移期间使用。
 *
 * @deprecated 请改用 Arc3D.create()
 */
export class Viewer {
  /**
   * 底层 Arc3DApp 实例。
   */
  readonly app: Arc3DApp

  /**
   * 创建旧版查看器实例。
   * @param container - 承载查看器的容器元素或其 id
   * @param options - 旧版可选配置
   */
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

  /**
   * 图层操作入口，提供添加点、线、面以及查询、显示、清除等方法。
   */
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

  /**
   * 地形服务。
   */
  get Terrain() {
    return this.app.terrain
  }

  /**
   * 交互事件处理器。
   */
  get EventHandler() {
    return this.app.interaction
  }

  /**
   * 提示工具服务。
   */
  get ReminderTip() {
    return this.app.ui.tooltip
  }

  /**
   * 底层 Cesium Viewer 实例（高级不稳定逃生舱）。
   */
  get native() {
    return this.app.native.viewer
  }

  /**
   * 底层 Cesium 场景对象（高级不稳定逃生舱）。
   */
  get scene() {
    return (this.app.native.viewer as { scene: unknown }).scene
  }

  /**
   * 底层 Cesium 相机对象（高级不稳定逃生舱）。
   */
  get camera() {
    return (this.app.native.viewer as { camera: unknown }).camera
  }

  /**
   * 查看器画布元素。
   */
  get canvas() {
    return this.app.context.engine.viewer.canvas
  }

  /**
   * 销毁查看器并释放相关资源。
   * @returns 销毁完成后的 Promise
   */
  destroy(): Promise<void> {
    return this.app.destroy()
  }
}
