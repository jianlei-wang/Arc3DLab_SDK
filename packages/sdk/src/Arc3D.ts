import { ConsoleLogger, createContext, type Arc3DConfig } from "@arc3dlab/core"
import { createCesiumEngineContext } from "@arc3dlab/engine-cesium"
import { Arc3DApp, createApp } from "./Arc3DApp"

function buildEngine(config: Arc3DConfig) {
  return createCesiumEngineContext({
    container: config.container,
    ionToken: config.engine?.cesium?.ionToken ?? config.tokens?.cesiumIon,
    defaultViewRectangle: config.engine?.cesium?.defaultViewRectangle ?? [70, -15, 140, 80],
    sceneMode: config.scene?.mode,
    depthTestAgainstTerrain: config.scene?.depthTestAgainstTerrain,
    resolutionScale: config.scene?.resolutionScale,
    controls: config.scene?.controls,
    fpsShow: config.scene?.fpsShow,
    creditMode: config.scene?.creditMode,
  })
}

function buildApp(config: Arc3DConfig): Arc3DApp {
  const logger = new ConsoleLogger(config.logger?.level ?? "warn")
  const engine = buildEngine(config)
  const context = createContext(config, engine, logger)
  context.lifecycle.transition("initializing")
  context.capabilities.register("engine:cesium")
  context.capabilities.register("render:entity")
  context.capabilities.register("render:primitive")
  context.capabilities.register("graphic:model")
  context.capabilities.register("analysis:measure")
  context.capabilities.register("analysis:terrain")
  context.capabilities.register("analysis:visibility")
  context.capabilities.register("effects:postprocess")
  context.capabilities.register("analysis:query")
  context.capabilities.register("analysis:clip")
  context.capabilities.register("analysis:volume")
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
