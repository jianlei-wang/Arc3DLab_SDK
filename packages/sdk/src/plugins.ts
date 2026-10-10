import {
  Arc3DError,
  type Arc3DContext,
  type PluginScope,
  type PluginState,
} from "@arc3dlab/core"

export interface Arc3DPlugin<TApp = unknown> {
  name: string
  version?: string
  /** @deprecated use requiresCapabilities */
  dependsOn?: string[]
  requiresCapabilities?: string[]
  dependsOnPlugins?: string[]
  install(
    app: TApp,
    context: Arc3DContext,
    scope: PluginScope,
  ): void | Promise<void>
  uninstall?(app: TApp, context: Arc3DContext): void | Promise<void>
}

interface PluginEntry<TApp> {
  plugin: Arc3DPlugin<TApp>
  scope: PluginScope
}

export class PluginManager<TApp = unknown> {
  private plugins = new Map<string, PluginEntry<TApp>>()
  private stateMap = new Map<string, PluginState>()

  constructor(
    private readonly app: TApp,
    private readonly context: Arc3DContext,
  ) {}

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

  list(): string[] {
    return Array.from(this.plugins.keys())
  }

  state(name: string): PluginState | undefined {
    return this.stateMap.get(name)
  }

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
