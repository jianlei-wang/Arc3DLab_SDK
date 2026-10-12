import {
  Arc3DError,
  type Arc3DContext,
  type PluginScope,
  type PluginState,
} from "@arc3dlab/core"

/** Arc3D 插件契约。 */
export interface Arc3DPlugin<TApp = unknown> {
  /** 插件名称，需全局唯一，且不能为 `core`/`arc3dlab`。 */
  name: string
  /** 插件版本。 */
  version?: string
  /** 声明所需的运行时能力。 */
  requiresCapabilities?: string[]
  /** 声明依赖的其他插件名称。 */
  dependsOnPlugins?: string[]
  /**
   * 安装插件。
   *
   * 推荐通过 `scope.registerCommand()` / `scope.registerTool()` /
   * `scope.registerCapability()` 注册扩展，使所有者显式绑定到当前插件，
   * 避免安装期间的异步等待被外部注册误归属。直接使用 `context` 上的注册表
   * 仍受当前活动作用域约束，但在跨 `await` 场景下不如作用域绑定可靠。
   *
   * @param app - 应用实例。
   * @param context - 运行时上下文。
   * @param scope - 插件专属作用域。
   */
  install(
    app: TApp,
    context: Arc3DContext,
    scope: PluginScope,
  ): void | Promise<void>
  /**
   * 卸载插件。
   *
   * @param app - 应用实例。
   * @param context - 运行时上下文。
   */
  uninstall?(app: TApp, context: Arc3DContext): void | Promise<void>
}

interface PluginEntry<TApp> {
  plugin: Arc3DPlugin<TApp>
  scope: PluginScope
}

/** 插件生命周期管理器：负责安装、卸载、依赖与能力校验。 */
export class PluginManager<TApp = unknown> {
  private plugins = new Map<string, PluginEntry<TApp>>()
  private stateMap = new Map<string, PluginState>()
  private queue: Promise<unknown> = Promise.resolve()
  private closing = false
  private closed = false
  private destroyTask: Promise<void> | undefined

  /**
   * 构造插件管理器。
   *
   * @param app - 应用实例。
   * @param context - 运行时上下文。
   */
  constructor(
    private readonly app: TApp,
    private readonly context: Arc3DContext,
  ) {}

  /** 管理器是否已进入关闭流程或已关闭。 */
  get shuttingDown(): boolean {
    return this.closing || this.closed
  }

  /** 将插件生命周期操作串行化，避免共享活动 owner 在异步安装期间被覆盖。 */
  private enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(operation, operation)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  /**
   * 安装插件。
   *
   * 安装操作串行执行；同名并发安装会确定性地拒绝其中一次。一旦管理器开始
   * 关闭，新的安装会同步被拒绝。若安装期间运行时进入销毁流程，安装会在提交
   * 前被回滚，不会登记为 `installed`。
   *
   * @param plugin - 插件对象。
   */
  async use(plugin: Arc3DPlugin<TApp>): Promise<void> {
    if (this.shuttingDown) {
      throw new Arc3DError(
        "CANCELLED",
        `Plugin manager is shutting down; cannot install ${plugin.name}`,
      )
    }
    return this.enqueue(() => this.performUse(plugin))
  }

  private async performUse(plugin: Arc3DPlugin<TApp>): Promise<void> {
    this.context.lifecycle.assertUsable("install plugin")
    if (this.shuttingDown) {
      throw new Arc3DError(
        "CANCELLED",
        `Plugin install aborted during shutdown: ${plugin.name}`,
      )
    }
    assertPluginName(plugin)
    if (this.plugins.has(plugin.name)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Plugin already installed: ${plugin.name}`,
      )
    }
    for (const dependency of plugin.dependsOnPlugins ?? []) {
      if (!this.plugins.has(dependency)) {
        throw new Arc3DError(
          "RESOURCE_NOT_FOUND",
          `Plugin dependency not installed: ${plugin.name} requires ${dependency}`,
        )
      }
    }
    const requires = plugin.requiresCapabilities ?? []
    for (const capability of requires) {
      this.context.capabilities.require(
        capability,
        `install plugin ${plugin.name}`,
      )
    }
    const scope = this.context.scopes.open(plugin.name)
    this.setState(plugin.name, "installing")
    this.context.scopes.setActive(plugin.name)
    try {
      await plugin.install(this.app, this.context, scope)
      if (this.shuttingDown || this.context.lifecycle.isTerminating) {
        throw new Arc3DError(
          "CANCELLED",
          `Plugin install aborted during shutdown: ${plugin.name}`,
        )
      }
      this.plugins.set(plugin.name, { plugin, scope })
      this.setState(plugin.name, "installed")
    } catch (error) {
      this.setState(plugin.name, "failed")
      await this.safeUninstall(plugin, "Failed to roll back plugin install")
      await this.context.scopes.close(plugin.name)
      await dropPluginExtensions(this.context, plugin.name)
      throw error
    } finally {
      this.context.scopes.setActive(undefined)
    }
  }

  /**
   * 卸载插件。
   *
   * @param name - 插件名称。
   */
  async uninstall(name: string): Promise<void> {
    if (this.closed) {
      throw new Arc3DError(
        "CANCELLED",
        `Plugin manager is closed; cannot uninstall ${name}`,
      )
    }
    return this.enqueue(() => this.performUninstall(name))
  }

  private async performUninstall(name: string): Promise<void> {
    const entry = this.plugins.get(name)
    if (!entry) {
      throw new Arc3DError(
        "RESOURCE_NOT_FOUND",
        `Plugin not installed: ${name}`,
      )
    }
    for (const other of Array.from(this.plugins.keys())) {
      const candidate = this.plugins.get(other)
      if (candidate?.plugin.dependsOnPlugins?.includes(name)) {
        throw new Arc3DError(
          "INVALID_ARGUMENT",
          `Cannot uninstall plugin ${name}: plugin ${other} depends on it`,
        )
      }
    }
    this.setState(name, "uninstalling")
    this.plugins.delete(name)
    this.context.scopes.setActive(name)
    try {
      await this.safeUninstall(entry.plugin, "Plugin uninstall failed")
      const scopeErrors = await this.context.scopes.close(name)
      for (const scopeError of scopeErrors) {
        safeLog(
          this.context.logger,
          `Plugin scope cleanup failed: ${name}`,
          scopeError,
        )
      }
      await dropPluginExtensions(this.context, name)
      this.stateMap.set(name, "disposed")
    } finally {
      this.context.scopes.setActive(undefined)
    }
  }

  /**
   * 逆序卸载全部插件。
   *
   * 关闭流程本身作为队列中的终止操作执行：先同步置位关闭标记以拒绝新的
   * `use()`，再排队等待已在途的插件安装/卸载收敛，最后逆序卸载剩余插件。
   * 这保证 `destroy()` 完成后不会再有插件登记残留。
   */
  async destroy(): Promise<void> {
    if (this.closed) return
    this.closing = true
    if (!this.destroyTask) {
      this.destroyTask = this.enqueue(() => this.performDestroy())
    }
    return this.destroyTask
  }

  private async performDestroy(): Promise<void> {
    if (this.closed) return
    const names = Array.from(this.plugins.keys()).reverse()
    for (const name of names) {
      try {
        await this.performUninstall(name)
      } catch (error) {
        safeLog(this.context.logger, `Plugin uninstall failed: ${name}`, error)
      }
    }
    this.closed = true
  }

  /** 列出已安装插件名称。 */
  list(): string[] {
    return Array.from(this.plugins.keys())
  }

  /**
   * 查询插件状态。
   *
   * @param name - 插件名称。
   * @returns 插件状态，未安装时返回 undefined。
   */
  state(name: string): PluginState | undefined {
    return this.stateMap.get(name)
  }

  /** 返回全部插件状态的快照。 */
  states(): Record<string, PluginState> {
    return Object.fromEntries(this.stateMap)
  }

  /** 同步插件状态到状态表与其作用域，保证 scope.state 与状态表一致。 */
  private setState(name: string, state: PluginState): void {
    this.stateMap.set(name, state)
    this.context.scopes.setState(name, state)
  }

  private async safeUninstall(
    plugin: Arc3DPlugin<TApp>,
    label: string,
  ): Promise<void> {
    try {
      await plugin.uninstall?.(this.app, this.context)
    } catch (error) {
      safeLog(this.context.logger, `${label}: ${plugin.name}`, error)
    }
  }
}

function assertPluginName(plugin: Arc3DPlugin): void {
  if (plugin.name === "core" || plugin.name === "arc3dlab") {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `Reserved plugin name: ${plugin.name}`,
    )
  }
}

async function dropPluginExtensions(
  context: Arc3DContext,
  plugin: string,
): Promise<void> {
  const errors: unknown[] = []
  try {
    context.commands.unregisterByPlugin(plugin)
  } catch (error) {
    errors.push(error)
  }
  try {
    await context.tools.unregisterByPlugin(plugin)
  } catch (error) {
    errors.push(error)
  }
  try {
    context.capabilities.unregisterByProvider(plugin)
  } catch (error) {
    errors.push(error)
  }
  for (const error of errors) {
    safeLog(context.logger, `Plugin extension cleanup failed: ${plugin}`, error)
  }
}

/** best-effort 日志上报：日志器自身抛错不应中断清理流程。 */
function safeLog(
  logger: { error(message: string, error?: unknown): void },
  message: string,
  error: unknown,
): void {
  try {
    logger.error(message, error)
  } catch {
    // 忽略日志器异常。
  }
}
