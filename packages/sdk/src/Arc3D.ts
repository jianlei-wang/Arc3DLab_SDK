import {
  ConsoleLogger,
  createContext,
  registerCoreCapabilities,
  type Arc3DConfig,
  type EngineContext,
  type Logger,
} from "@arc3dlab/core"
import { createCesiumEngineContext } from "@arc3dlab/engine-cesium"
import { Arc3DApp, createApp } from "./Arc3DApp"

type RuntimeContext = ReturnType<typeof createContext>

/**
 * 初始化失败时携带原始错误与回滚动作，供 `Arc3D.create` / `createSync` 统一回滚。
 */
class InitFailure extends Error {
  constructor(
    readonly original: unknown,
    readonly rollback: () => Promise<void>,
  ) {
    super(original instanceof Error ? original.message : String(original))
    this.name = "InitFailure"
  }
}

function buildApp(config: Arc3DConfig): Arc3DApp {
  const logger = new ConsoleLogger(config.logger?.level ?? "warn")
  let context: RuntimeContext | undefined
  let engine: EngineContext | undefined
  try {
    engine = createCesiumEngineContext({
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
  } catch (error) {
    const engineRef = engine
    const contextRef = context
    throw new InitFailure(error, () =>
      rollbackInit(contextRef, engineRef, logger),
    )
  }
}

/**
 * 逆序回滚初始化过程中已创建的资源：先执行已登记的释放回调并清空注册表、
 * 监听器，再销毁引擎/Viewer。所有清理错误仅记录，不覆盖原始初始化错误。
 */
async function rollbackInit(
  context: RuntimeContext | undefined,
  engine: EngineContext | undefined,
  logger: Logger,
): Promise<void> {
  if (context) {
    try {
      await context.disposers.disposeAll((error) =>
        logger.error("Init rollback disposer failed", error),
      )
      context.registry.clear(context.tracker)
      context.tracker.clear()
      context.events.clear()
    } catch (error) {
      logger.error("Init rollback cleanup failed", error)
    }
  }
  if (engine) {
    try {
      if (engine.engine) {
        engine.engine.destroy()
      } else {
        engine.viewer.destroy()
      }
    } catch (error) {
      logger.error("Init rollback engine destroy failed", error)
    }
  }
}

/**
 * Arc3D 运行时入口。
 *
 * 通过 {@link Arc3D.create} 创建已接线的运行时；`create` 解析完成表示 Runtime facade
 * 就绪，异步资源（底图、地形、数据）通过各自的状态或 `app.scene.whenSceneReady()` 回报。
 * 初始化是事务式的：任一步骤失败都会回滚已创建的 Viewer 与资源，并抛出原始错误。
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
    try {
      return buildApp(config)
    } catch (error) {
      if (error instanceof InitFailure) {
        await error.rollback()
        throw error.original
      }
      throw error
    }
  },
  /**
   * 同步创建 Arc3D 运行时。
   *
   * 失败时以尽力而为的方式执行回滚；异步释放回调会在后台继续执行。
   *
   * @param config - 运行时配置。
   * @returns 已就绪的 {@link Arc3DApp} 实例。
   */
  createSync(config: Arc3DConfig): Arc3DApp {
    try {
      return buildApp(config)
    } catch (error) {
      if (error instanceof InitFailure) {
        void error.rollback()
        throw error.original
      }
      throw error
    }
  },
}
