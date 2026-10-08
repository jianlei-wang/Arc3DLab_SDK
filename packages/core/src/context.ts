import type { Arc3DConfig, Arc3DEvents, EngineContext } from "./types"
import { CapabilityRegistry } from "./capabilities"
import { EventBus } from "./event-bus"
import { LifecycleManager } from "./lifecycle"
import { ConsoleLogger, type Logger } from "./logger"
import { ResourceRegistry, ResourceTracker } from "./resource"

export interface Arc3DContext {
  config: Arc3DConfig
  engine: EngineContext
  registry: ResourceRegistry
  tracker: ResourceTracker
  events: EventBus<Arc3DEvents>
  lifecycle: LifecycleManager
  logger: Logger
  capabilities: CapabilityRegistry
}

export function createContext(
  config: Arc3DConfig,
  engine: EngineContext,
  logger?: Logger
): Arc3DContext {
  return {
    config,
    engine,
    registry: new ResourceRegistry(),
    tracker: new ResourceTracker(),
    events: new EventBus<Arc3DEvents>(),
    lifecycle: new LifecycleManager(),
    logger: logger ?? new ConsoleLogger(config.logger?.level ?? "warn"),
    capabilities: new CapabilityRegistry(),
  }
}
