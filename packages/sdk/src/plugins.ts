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
  /** 声明依赖的能力。 */
  /** @deprecated use requiresCapabilities */
  dependsOn?: string[]
  /** 声明所需的运行时能力。 */
  requiresCapabilities?: string[]
  /** 声明依赖的其他插件名称。 */
  dependsOnPlugins?: string[]
  /**
   * 安装插件。
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

  /**
   * 安装插件。
   *
   * @param plugin - 插件对象。
   */
  async use(plugin: Arc3DPlugin<TApp>): Promise<void> {
    this.context.lifecycle.assertUsable("install plugin")
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
    const requires = plugin.requiresCapabilities ?? plugin.dependsOn ?? []
    for (const capability of requires) {
      this.context.capabilities.require(
        capability,
        `install plugin ${plugin.name}`,
      )
    }
    const scope = this.context.scopes.open(plugin.name)
    this.stateMap.set(plugin.name, "installing")
    this.context.scopes.setActive(plugin.name)
    try {
      await plugin.install(this.app, this.context, scope)
      this.plugins.set(plugin.name, { plugin, scope })
      this.stateMap.set(plugin.name, "installed")
    } catch (error) {
      this.stateMap.set(plugin.name, "failed")
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
    const entry = this.plugins.get(name)
    if (!entry) {
      throw new Arc3DError(
        "RESOURCE_NOT_FOUND",
        `Plugin not installed: ${name}`,
      )
    }
    for (const [other, candidate] of this.plugins) {
      if (candidate.plugin.dependsOnPlugins?.includes(name)) {
        throw new Arc3DError(
          "INVALID_ARGUMENT",
          `Cannot uninstall plugin ${name}: plugin ${other} depends on it`,
        )
      }
    }
    this.stateMap.set(name, "uninstalling")
    this.plugins.delete(name)
    this.context.scopes.setActive(name)
    try {
      await this.safeUninstall(entry.plugin, "Plugin uninstall failed")
      const scopeErrors = await this.context.scopes.close(name)
      for (const scopeError of scopeErrors) {
        this.context.logger.error(
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

  /** 逆序卸载全部插件。 */
  async destroy(): Promise<void> {
    const names = Array.from(this.plugins.keys()).reverse()
    for (const name of names) {
      try {
        await this.uninstall(name)
      } catch (error) {
        this.context.logger.error(`Plugin uninstall failed: ${name}`, error)
      }
    }
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

  private async safeUninstall(
    plugin: Arc3DPlugin<TApp>,
    label: string,
  ): Promise<void> {
    try {
      await plugin.uninstall?.(this.app, this.context)
    } catch (error) {
      this.context.logger.error(`${label}: ${plugin.name}`, error)
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
  context.commands.unregisterByPlugin(plugin)
  await context.tools.unregisterByPlugin(plugin)
  context.capabilities.unregisterByProvider(plugin)
}
