import { Arc3DError, type Arc3DContext } from "@arc3dlab/core"

export interface Arc3DPlugin<TApp = unknown> {
  name: string
  version?: string
  dependsOn?: string[]
  install(app: TApp, context: Arc3DContext): void | Promise<void>
  uninstall?(app: TApp, context: Arc3DContext): void | Promise<void>
}

export class PluginManager<TApp = unknown> {
  private plugins = new Map<string, Arc3DPlugin<TApp>>()

  constructor(
    private readonly app: TApp,
    private readonly context: Arc3DContext
  ) {}

  async use(plugin: Arc3DPlugin<TApp>): Promise<void> {
    this.context.lifecycle.assertUsable("install plugin")
    if (plugin.name === "core" || plugin.name === "arc3dlab") {
      throw new Arc3DError("INVALID_ARGUMENT", `Reserved plugin name: ${plugin.name}`)
    }
    if (this.plugins.has(plugin.name)) {
      throw new Arc3DError("DUPLICATE_RESOURCE", `Plugin already installed: ${plugin.name}`)
    }
    for (const capability of plugin.dependsOn ?? []) {
      this.context.capabilities.require(capability, `install plugin ${plugin.name}`)
    }
    try {
      await plugin.install(this.app, this.context)
    } catch (error) {
      try {
        await plugin.uninstall?.(this.app, this.context)
      } catch (rollbackError) {
        this.context.logger.error(`Plugin rollback failed: ${plugin.name}`, rollbackError)
      }
      dropPluginExtensions(this.context, plugin.name)
      throw error
    }
    this.plugins.set(plugin.name, plugin)
  }

  async uninstall(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Plugin not installed: ${name}`)
    }
    this.plugins.delete(name)
    await plugin.uninstall?.(this.app, this.context)
    dropPluginExtensions(this.context, name)
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
}

function dropPluginExtensions(context: Arc3DContext, plugin: string): void {
  context.commands?.unregisterByPlugin(plugin)
  context.tools?.unregisterByPlugin(plugin)
  context.capabilities?.unregisterByProvider(plugin)
}
