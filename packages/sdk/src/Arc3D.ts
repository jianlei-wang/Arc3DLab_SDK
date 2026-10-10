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

export const Arc3D = {
  async create(config: Arc3DConfig): Promise<Arc3DApp> {
    return buildApp(config)
  },
  createSync(config: Arc3DConfig): Arc3DApp {
    return buildApp(config)
  },
}
