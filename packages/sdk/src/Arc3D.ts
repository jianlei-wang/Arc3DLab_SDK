import {
  ConsoleLogger,
  createContext,
  registerCoreCapabilities,
  type Arc3DConfig,
} from "@arc3dlab/core"
import { createCesiumEngineContext } from "@arc3dlab/engine-cesium"
import { Arc3DApp, createApp } from "./Arc3DApp"

function buildApp(config: Arc3DConfig): Arc3DApp {
  const logger = new ConsoleLogger(config.logger?.level ?? "warn")
  let context: ReturnType<typeof createContext> | undefined
  const engine = createCesiumEngineContext({
    container: config.container,
    ionToken: config.engine?.cesium?.ionToken ?? config.tokens?.cesiumIon,
    defaultViewRectangle: config.engine?.cesium?.defaultViewRectangle ?? [
      70, -15, 140, 80,
    ],
    sceneMode: config.scene?.mode,
    depthTestAgainstTerrain: config.scene?.depthTestAgainstTerrain,
    resolutionScale: config.scene?.resolutionScale,
    controls: config.scene?.controls,
    fpsShow: config.scene?.fpsShow,
    creditMode: config.scene?.creditMode,
    defaultBaseLayer: config.engine?.cesium?.defaultBaseLayer,
    onError: (error) => {
      logger.error(error.message)
      context?.events.emit("error", error)
    },
  })
  context = createContext(config, engine, logger)
  context.lifecycle.transition("initializing")
  registerCoreCapabilities(context.capabilities, context.engineAdapter)
  return createApp(config, engine, context)
}

/**
 * Arc3D 运行时入口。
 *
 * 通过 {@link Arc3D.create} 创建已接线的运行时；`create` 解析完成表示 Runtime facade
 * 就绪，异步资源（底图、地形、数据）通过各自的状态或 `app.scene.whenSceneReady()` 回报。
 */
export const Arc3D = {
  /**
   * 异步创建 Arc3D 运行时。
   *
   * @param config - 运行时配置，包含容器、引擎与场景选项。
   * @returns 已就绪的 {@link Arc3DApp} 实例。
   * @example
   * const app = await Arc3D.create({ container: "map" })
   * await app.scene.whenSceneReady()
   */
  async create(config: Arc3DConfig): Promise<Arc3DApp> {
    return buildApp(config)
  },
  /**
   * 同步创建 Arc3D 运行时。
   *
   * @param config - 运行时配置。
   * @returns 已就绪的 {@link Arc3DApp} 实例。
   */
  createSync(config: Arc3DConfig): Arc3DApp {
    return buildApp(config)
  },
}
