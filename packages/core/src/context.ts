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

export interface Arc3DContext {
  config: Arc3DConfig
  engine: EngineContext
  engineAdapter: Engine | undefined
  registry: ResourceRegistry
  tracker: ResourceTracker
  events: EventBus<Arc3DEvents>
  lifecycle: LifecycleManager
  logger: Logger
  capabilities: CapabilityRegistry
  commands: CommandBus
  tools: ToolRegistry
  disposers: DisposerStack
  scopes: PluginScopeManager
  catalog: DataCatalog
}

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
