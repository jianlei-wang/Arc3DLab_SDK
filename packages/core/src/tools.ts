import { Arc3DError } from "./errors"
import { assertWritableExtension } from "./commands"

export interface ToolSpec {
  name: string
  version: string
  plugin: string
  dependsOn?: string[]
  activate: () => void | Promise<void>
  deactivate?: () => void | Promise<void>
}

export class ToolRegistry {
  private items = new Map<string, ToolSpec>()
  private active: string | undefined

  register(spec: ToolSpec): void {
    assertWritableExtension(spec.name, spec.plugin, "tool")
    if (this.items.has(spec.name)) {
      throw new Arc3DError("DUPLICATE_RESOURCE", `Tool already registered: ${spec.name}`)
    }
    this.items.set(spec.name, spec)
  }

  unregister(name: string): void {
    if (this.active === name) this.active = undefined
    this.items.delete(name)
  }

  unregisterByPlugin(plugin: string): void {
    for (const [name, spec] of [...this.items]) {
      if (spec.plugin !== plugin) continue
      if (this.active === name) this.active = undefined
      this.items.delete(name)
    }
  }

  has(name: string): boolean {
    return this.items.has(name)
  }

  list(): string[] {
    return Array.from(this.items.keys())
  }

  get activeTool(): string | undefined {
    return this.active
  }

  async activate(name: string): Promise<void> {
    const spec = this.items.get(name)
    if (!spec) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Tool not registered: ${name}`)
    }
    if (this.active && this.active !== name) {
      const current = this.items.get(this.active)
      await current?.deactivate?.()
    }
    await spec.activate()
    this.active = name
  }

  async deactivate(name = this.active): Promise<void> {
    if (!name) return
    const spec = this.items.get(name)
    if (this.active === name) this.active = undefined
    await spec?.deactivate?.()
  }
}
