import { Arc3DError } from "./errors"
import type { Disposer } from "./disposer"
import type { CommandSpec } from "./commands"
import type { ToolSpec } from "./tools"
import type { CapabilityRecord } from "./capabilities"

/** 插件的生命周期状态。 */
export type PluginState =
  "installing" | "installed" | "uninstalling" | "failed" | "disposed"

/** 以插件作用域注册命令的输入，所有者由作用域自动绑定。 */
export type ScopedCommandSpec = Omit<CommandSpec, "plugin">
/** 以插件作用域注册工具的输入，所有者由作用域自动绑定。 */
export type ScopedToolSpec = Omit<ToolSpec, "plugin">
/** 以插件作用域注册能力的输入，提供方由作用域自动绑定。 */
export type ScopedCapabilityRecord = string | Omit<CapabilityRecord, "provider">

/**
 * 由插件创建、需要随插件卸载自动回收的资源句柄。
 *
 * 图形、图层、效果、事件监听器、分析任务等运行时资源均可实现该接口，
 * 并通过 {@link PluginScope.manage} 交由插件作用域统一回收。
 */
export interface DisposableResource {
  /** 释放资源；允许返回 Promise。 */
  destroy(): void | Promise<void>
}

/** 作用域绑定注册回调；由运行时把显式 owner 传递给各注册表。 */
export interface PluginRegistrationBinding {
  /** 以指定插件为所有者注册命令。 */
  registerCommand(spec: ScopedCommandSpec, owner: string): void
  /** 以指定插件为所有者注册工具。 */
  registerTool(spec: ScopedToolSpec, owner: string): void
  /** 以指定插件为提供方注册能力。 */
  registerCapability(record: ScopedCapabilityRecord, owner: string): void
}

/** 描述单个插件作用域，用于追踪该插件注册的释放回调。 */
export interface PluginScope {
  /** 作用域所属插件名。 */
  readonly owner: string
  /** 当前插件状态。 */
  readonly state: PluginState
  /** 作用域是否已关闭（不可再追踪释放回调或注册扩展）。 */
  readonly closed: boolean
  /**
   * 追踪一个释放回调。
   *
   * @param disposer - 释放回调。
   * @returns 取消追踪的函数。
   * @throws {Arc3DError} 当作用域已关闭时抛出，错误码为 `INVALID_ARGUMENT`。
   */
  track(disposer: Disposer): () => void
  /**
   * 托管一个插件创建的运行时资源，在其卸载时自动调用 `resource.destroy()`。
   *
   * 这是插件创建图形、图层、效果、分析任务等外部资源时应使用的统一入口：
   * 资源创建后立即纳入作用域，插件卸载（含安装失败回滚）时会被自动回收，
   * 无需在 `uninstall()` 中手动清理。销毁对同一资源幂等。
   *
   * @param resource - 可销毁的资源句柄。
   * @returns 传入的资源本身，便于链式使用。
   * @throws {Arc3DError} 当作用域已关闭时抛出，错误码为 `INVALID_ARGUMENT`。
   */
  manage<T extends DisposableResource>(resource: T): T
  /**
   * 以本插件为所有者注册命令。
   *
   * 相比直接使用运行时上下文的命令总线，该接口把所有者显式绑定到当前作用域，
   * 不受跨 `await` 的全局活动 owner 影响，避免插件安装期间的外部注册被误归属。
   *
   * @param spec - 命令定义（无需提供 `plugin`）。
   * @throws {Arc3DError} 当作用域已关闭或未配置注册绑定时抛出。
   */
  registerCommand(spec: ScopedCommandSpec): void
  /**
   * 以本插件为所有者注册工具。
   *
   * @param spec - 工具定义（无需提供 `plugin`）。
   * @throws {Arc3DError} 当作用域已关闭或未配置注册绑定时抛出。
   */
  registerTool(spec: ScopedToolSpec): void
  /**
   * 以本插件为提供方注册能力。
   *
   * @param record - 能力名称或能力记录（无需提供 `provider`）。
   * @throws {Arc3DError} 当作用域已关闭或未配置注册绑定时抛出。
   */
  registerCapability(record: ScopedCapabilityRecord): void
  /** 已追踪的释放回调数量。 */
  readonly size: number
  /** 执行并清空全部释放回调。 */
  dispose(): Promise<unknown[]>
}

class PluginScopeImpl implements PluginScope {
  private items: Disposer[] = []
  private current: PluginState = "installing"
  private isClosed = false

  constructor(
    readonly owner: string,
    private readonly binding?: PluginRegistrationBinding,
  ) {}

  get state(): PluginState {
    return this.current
  }

  /** 作用域是否已关闭。 */
  get closed(): boolean {
    return this.isClosed
  }

  setState(state: PluginState): void {
    this.current = state
  }

  /** 标记作用域已关闭并把状态推进到 `disposed`。 */
  markClosed(): void {
    this.isClosed = true
    this.current = "disposed"
  }

  track(disposer: Disposer): () => void {
    this.assertOpen("track")
    this.items.push(disposer)
    return () => {
      const index = this.items.lastIndexOf(disposer)
      if (index >= 0) this.items.splice(index, 1)
    }
  }

  manage<T extends DisposableResource>(resource: T): T {
    this.assertOpen("manage")
    let disposed = false
    this.items.push(async () => {
      if (disposed) return
      disposed = true
      await resource.destroy()
    })
    return resource
  }

  registerCommand(spec: ScopedCommandSpec): void {
    this.assertOpen("registerCommand")
    this.requireBinding("registerCommand").registerCommand(spec, this.owner)
  }

  registerTool(spec: ScopedToolSpec): void {
    this.assertOpen("registerTool")
    this.requireBinding("registerTool").registerTool(spec, this.owner)
  }

  registerCapability(record: ScopedCapabilityRecord): void {
    this.assertOpen("registerCapability")
    this.requireBinding("registerCapability").registerCapability(
      record,
      this.owner,
    )
  }

  private assertOpen(method: string): void {
    if (this.isClosed) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Plugin scope already closed: ${this.owner} (${method})`,
      )
    }
  }

  private requireBinding(method: string): PluginRegistrationBinding {
    if (!this.binding) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Plugin scope has no registration binding: ${this.owner} (${method})`,
      )
    }
    return this.binding
  }

  get size(): number {
    return this.items.length
  }

  async dispose(): Promise<unknown[]> {
    const pending = this.items.splice(0, this.items.length).reverse()
    const errors: unknown[] = []
    for (const disposer of pending) {
      try {
        await disposer()
      } catch (error) {
        errors.push(error)
      }
    }
    return errors
  }
}

/** 管理多个插件作用域的打开、查询与关闭。 */
export class PluginScopeManager {
  private scopes = new Map<string, PluginScopeImpl>()
  private activeOwner: string | undefined
  private binding: PluginRegistrationBinding | undefined

  /**
   * 配置作用域注册绑定；运行时用它把显式 owner 传递给各注册表。
   *
   * @param binding - 注册绑定。
   */
  setBinding(binding: PluginRegistrationBinding): void {
    this.binding = binding
  }

  /**
   * 打开一个插件作用域。
   *
   * @param owner - 插件名。
   * @returns 新建的插件作用域。
   * @throws {Arc3DError} 当试图为保留插件名打开作用域时抛出，错误码为 `INVALID_ARGUMENT`；
   * 当同名作用域已打开时抛出，错误码为 `DUPLICATE_RESOURCE`。
   */
  open(owner: string): PluginScope {
    if (owner === "core" || owner === "arc3dlab") {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Reserved plugin scope: ${owner}`,
      )
    }
    if (this.scopes.has(owner)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Plugin scope already open: ${owner}`,
      )
    }
    const scope = new PluginScopeImpl(owner, this.binding)
    this.scopes.set(owner, scope)
    return scope
  }

  /**
   * 获取指定插件的作用域。
   *
   * @param owner - 插件名。
   * @returns 对应作用域，不存在时为 undefined。
   */
  get(owner: string): PluginScope | undefined {
    return this.scopes.get(owner)
  }

  /** 当前活动的插件所有者名称。 */
  get owner(): string | undefined {
    return this.activeOwner
  }

  /**
   * 设置当前活动的插件所有者。
   *
   * @param owner - 插件名，undefined 表示清除。
   */
  setActive(owner: string | undefined): void {
    this.activeOwner = owner
  }

  /**
   * 更新指定插件的状态。
   *
   * @param owner - 插件名。
   * @param state - 目标状态。
   */
  setState(owner: string, state: PluginState): void {
    this.scopes.get(owner)?.setState(state)
  }

  /**
   * 关闭指定插件作用域并执行其释放回调。
   *
   * @param owner - 插件名。
   * @returns 释放过程中收集到的错误数组。
   */
  async close(owner: string): Promise<unknown[]> {
    const scope = this.scopes.get(owner)
    if (!scope) return []
    scope.markClosed()
    const errors = await scope.dispose()
    this.scopes.delete(owner)
    return errors
  }

  /**
   * 列出全部已打开的插件作用域名。
   *
   * @returns 插件名数组。
   */
  list(): string[] {
    return Array.from(this.scopes.keys())
  }
}

/**
 * 判断给定值是否为有效的插件作用域。
 *
 * @param value - 待判断的值。
 * @returns 是否为插件作用域。
 */
export function isPluginScope(
  value: PluginScope | undefined,
): value is PluginScope {
  return Boolean(value && typeof value.track === "function")
}
