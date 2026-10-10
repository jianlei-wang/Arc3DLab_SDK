import type { Arc3DConfig, Arc3DEvents, Engine, EngineContext } from "./types"
import { CapabilityRegistry } from "./capabilities"
import { DataCatalog } from "./catalog"
import { CommandBus } from "./commands"
import { DisposerStack } from "./disposer"
import { EventBus } from "./event-bus"
import { LifecycleManager } from "./lifecycle"
import { ConsoleLogger, type Logger } from "./logger"
import { ResourceRegistry, ResourceTracker } from "./resource"
import { PluginScopeManager } from "./plugin-scope"
import { ToolRegistry } from "./tools"

function createCoreCommandBus(
  ownerProvider?: () => string | undefined,
): CommandBus {
  const commands = new CommandBus(ownerProvider)
  commands.register({
    name: "core.ping",
    version: "1.0.0",
    plugin: "core",
    execute: () => "pong",
  })
  return commands
}

/** Arc3D 运行时上下文，聚合配置、引擎、资源注册表及各类扩展子系统。 */
export interface Arc3DContext {
  /** 应用配置。 */
  config: Arc3DConfig
  /** 引擎上下文。 */
  engine: EngineContext
  /** 底层引擎适配器，未提供时为 undefined。 */
  engineAdapter: Engine | undefined
  /** 资源注册表。 */
  registry: ResourceRegistry
  /** 父子资源关系追踪器。 */
  tracker: ResourceTracker
  /** 事件总线。 */
  events: EventBus<Arc3DEvents>
  /** 生命周期管理器。 */
  lifecycle: LifecycleManager
  /** 日志记录器。 */
  logger: Logger
  /** 能力注册表。 */
  capabilities: CapabilityRegistry
  /** 命令总线。 */
  commands: CommandBus
  /** 工具注册表。 */
  tools: ToolRegistry
  /** 释放回调栈。 */
  disposers: DisposerStack
  /** 插件作用域管理器。 */
  scopes: PluginScopeManager
  /** 数据目录。 */
  catalog: DataCatalog
}

/**
 * 创建并初始化 Arc3D 运行时上下文。
 *
 * @param config - 应用配置。
 * @param engine - 引擎上下文。
 * @param logger - 自定义日志记录器，省略时使用控制台日志记录器。
 * @param engineAdapter - 可选的底层引擎适配器。
 * @returns 初始化完成的 Arc3D 运行时上下文。
 */
export function createContext(
  config: Arc3DConfig,
  engine: EngineContext,
  logger?: Logger,
  engineAdapter?: Engine,
): Arc3DContext {
  const resolvedLogger =
    logger ?? new ConsoleLogger(config.logger?.level ?? "warn")
  const scopes = new PluginScopeManager()
  const ownerProvider = () => scopes.owner
  return {
    config,
    engine,
    engineAdapter: engineAdapter ?? engine.engine,
    registry: new ResourceRegistry(),
    tracker: new ResourceTracker(),
    events: new EventBus<Arc3DEvents>({
      onHandlerError: (error, event) => {
        resolvedLogger.error(`Event handler failed: ${String(event)}`, error)
      },
    }),
    lifecycle: new LifecycleManager(),
    logger: resolvedLogger,
    capabilities: new CapabilityRegistry(ownerProvider),
    commands: createCoreCommandBus(ownerProvider),
    tools: new ToolRegistry(ownerProvider),
    disposers: new DisposerStack(),
    scopes,
    catalog: new DataCatalog(),
  }
}
