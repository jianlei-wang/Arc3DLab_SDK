import { Arc3DError } from "./errors"
import { assertWritableExtension } from "./commands"

export type ToolState = "idle" | "deactivating" | "activating" | "active"

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
  private current: ToolState = "idle"

  constructor(private readonly ownerProvider?: () => string | undefined) {}

  register(spec: ToolSpec): void {
    const owner = this.ownerProvider?.() ?? spec.plugin
    assertWritableExtension(spec.name, owner, "tool")
    if (this.items.has(spec.name)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Tool already registered: ${spec.name}`,
      )
    }
    this.items.set(spec.name, { ...spec, plugin: owner })
  }

  async unregister(name: string): Promise<void> {
    if (this.active === name) {
      this.current = "deactivating"
      try {
        await this.items.get(name)?.deactivate?.()
      } finally {
        this.active = undefined
        this.current = "idle"
      }
    }
    this.items.delete(name)
  }

  async unregisterByPlugin(plugin: string): Promise<void> {
    const names = Array.from(this.items.entries())
      .filter(([, spec]) => spec.plugin === plugin)
      .map(([name]) => name)
    for (const name of names) {
      await this.unregister(name)
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

  get state(): ToolState {
    return this.current
  }

  async activate(name: string): Promise<void> {
    const spec = this.items.get(name)
    if (!spec) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Tool not registered: ${name}`)
    }
    if (this.active === name) return
    if (this.active) {
      const previousName = this.active
      const previous = this.items.get(previousName)
      this.current = "deactivating"
      this.active = undefined
      await previous?.deactivate?.()
    }
    this.current = "activating"
    try {
      await spec.activate()
      this.active = name
      this.current = "active"
    } catch (error) {
      this.active = undefined
      this.current = "idle"
      throw error
    }
  }

  async deactivate(name = this.active): Promise<void> {
    if (!name) return
    const spec = this.items.get(name)
    this.current = "deactivating"
    try {
      await spec?.deactivate?.()
    } finally {
      if (this.active === name) this.active = undefined
      this.current = this.active ? "active" : "idle"
    }
  }
}
