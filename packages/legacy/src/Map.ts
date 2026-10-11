import {
  Arc3DError,
  type Arc3DConfig,
  type SceneModeName,
} from "@arc3dlab/core"
import { Arc3D, type Arc3DApp } from "@arc3dlab/sdk"

/**
 * 旧版地图场景的可选配置。
 */
export interface LegacyMapOptions {
  /** Cesium ion 默认访问令牌。 */
  defaultKey?: string
  /** 是否显示帧率。 */
  fpsShow?: boolean
  /** 是否使用 mapbox 控制器。 */
  mapboxController?: boolean
  /** 是否对地形启用深度测试。 */
  depthTestAgainstTerrain?: boolean
  /** 初始场景模式。 */
  sceneMode?: SceneModeName
}

/**
 * 旧版 `LarkExplorer.map` 的兼容适配器。
 *
 * 将旧版以 `Map` 为入口的用法映射到 {@link Arc3DApp} 的运行时门面，便于既有业务逐步迁移；
 * 尚未迁移的能力在访问时会抛出错误码为 `UNSUPPORTED_CAPABILITY` 的 {@link Arc3DError}。
 *
 * @deprecated 请改用 `Arc3D.create()`
 */
export class Map {
  /** 底层 Arc3DApp 实例。 */
  readonly app: Arc3DApp

  /**
   * 创建旧版地图场景实例。
   * @param container - 承载地图的容器元素或其 id。
   * @param options - 旧版可选配置。
   */
  constructor(container: string | Element, options: LegacyMapOptions = {}) {
    const config: Arc3DConfig = {
      container,
      tokens: { cesiumIon: options.defaultKey },
      scene: {
        fpsShow: options.fpsShow,
        controls: options.mapboxController ? "mapbox" : "default",
        mode: options.sceneMode,
        depthTestAgainstTerrain: options.depthTestAgainstTerrain,
      },
    }
    this.app = Arc3D.createSync(config)
  }

  /**
   * 图层操作入口。
   */
  get Layers() {
    return {
      addPoints: (
        positions: Array<[number, number] | [number, number, number]>,
      ) => this.app.graphics.addPoints({ positions }),
      addLines: (
        positions: Array<[number, number] | [number, number, number]>,
      ) => this.app.graphics.addPolyline({ positions }),
      addPolygons: (
        positions: Array<[number, number] | [number, number, number]>,
      ) => this.app.graphics.addPolygon({ positions }),
      get: (id: string) => this.app.graphics.get(id),
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
   * 交互事件句柄。
   */
  get Handler() {
    return this.app.interaction
  }

  /**
   * 相机导航入口。
   */
  get Navigation() {
    return this.app.scene.camera
  }

  /**
   * 渲染相关入口。
   */
  get Render() {
    return this.app.scene.render
  }

  /**
   * 场景窗口入口。
   */
  get Screen() {
    return this.app.scene
  }

  /**
   * 底层引擎 Viewer 实例（高级不稳定逃生舱）。
   */
  get viewer() {
    return this.app.native.viewer
  }

  /**
   * 地图画布元素。
   */
  get canvas() {
    return this.app.context.engine.viewer.canvas
  }

  /**
   * 销毁地图场景并释放相关资源。
   * @returns 销毁完成后的 Promise。
   */
  destroy(): Promise<void> {
    return this.app.destroy()
  }
}

const NOT_MIGRATED = [
  "Weather",
  "Components",
  "SpecialAnalysis",
  "MilitaryPlotting",
] as const

for (const name of NOT_MIGRATED) {
  Object.defineProperty(Map.prototype, name, {
    configurable: true,
    get() {
      throw new Arc3DError(
        "UNSUPPORTED_CAPABILITY",
        `LarkExplorer capability is not migrated yet: ${name}`,
      )
    },
  })
}
