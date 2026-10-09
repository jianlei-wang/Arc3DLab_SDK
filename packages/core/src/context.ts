import type { Arc3DConfig, Arc3DEvents, EngineContext } from "./types"
import { CapabilityRegistry } from "./capabilities"
import { CommandBus } from "./commands"
import { DisposerStack } from "./disposer"
import { EventBus } from "./event-bus"
import { LifecycleManager } from "./lifecycle"
import { ConsoleLogger, type Logger } from "./logger"
import { ResourceRegistry, ResourceTracker } from "./resource"
import { ToolRegistry } from "./tools"

function createCoreCommandBus(): CommandBus {
  const commands = new CommandBus()
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
  registry: ResourceRegistry
  tracker: ResourceTracker
  events: EventBus<Arc3DEvents>
  lifecycle: LifecycleManager
  logger: Logger
  capabilities: CapabilityRegistry
  commands: CommandBus
  tools: ToolRegistry
  disposers: DisposerStack
}

export function createContext(
  config: Arc3DConfig,
  engine: EngineContext,
  logger?: Logger
): Arc3DContext {
  const resolvedLogger = logger ?? new ConsoleLogger(config.logger?.level ?? "warn")
  return {
    config,
    engine,
    registry: new ResourceRegistry(),
    tracker: new ResourceTracker(),
    events: new EventBus<Arc3DEvents>({
      onHandlerError: (error, event) => {
        resolvedLogger.error(`Event handler failed: ${String(event)}`, error)
      },
    }),
    lifecycle: new LifecycleManager(),
    logger: resolvedLogger,
    capabilities: new CapabilityRegistry(),
    commands: createCoreCommandBus(),
    tools: new ToolRegistry(),
    disposers: new DisposerStack(),
  }
}
