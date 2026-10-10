import type { Arc3DContext } from "./context"
import type { LifecycleState } from "./lifecycle"

/** 运行时的诊断快照，汇总生命周期、资源与扩展注册的统计信息。 */
export interface RuntimeDiagnostics {
  /** 当前生命周期状态。 */
  lifecycle: LifecycleState
  /** 按资源类型统计的数量映射。 */
  resources: Record<string, number>
  /** 已注册的释放回调数量。 */
  disposerCount: number
  /** 事件监听器数量。 */
  listenerCount: number
  /** 被追踪的父资源数量。 */
  trackedParents: number
  /** 已注册能力数量。 */
  capabilities: number
  /** 已注册命令数量。 */
  commands: number
  /** 已注册工具数量。 */
  tools: number
  /** 当前激活的工具名，未激活时为 null。 */
  activeTool: string | null
  /** 当前打开的插件作用域名称列表。 */
  pluginScopes: string[]
}

/**
 * 采集给定上下文的运行时诊断信息。
 *
 * @param context - 要采集诊断信息的 Arc3D 上下文。
 * @returns 包含各类运行时统计的诊断快照。
 */
export function getRuntimeDiagnostics(
  context: Arc3DContext,
): RuntimeDiagnostics {
  const resources: Record<string, number> = {}
  for (const item of context.registry.values()) {
    resources[item.type] = (resources[item.type] ?? 0) + 1
  }
  return {
    lifecycle: context.lifecycle.current,
    resources,
    disposerCount: context.disposers.size,
    listenerCount: context.events.listenerCount,
    trackedParents: context.tracker.size,
    capabilities: context.capabilities.list().length,
    commands: context.commands.list().length,
    tools: context.tools.list().length,
    activeTool: context.tools.activeTool ?? null,
    pluginScopes: context.scopes.list(),
  }
}
