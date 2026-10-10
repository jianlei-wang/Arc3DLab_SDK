import { Arc3DError, type Arc3DContext } from "@arc3dlab/core"
import { PostProcessManager } from "./postprocess"

export type MaterialFactory = (options?: Record<string, unknown>) => unknown

export class MaterialRegistry {
  private factories = new Map<string, MaterialFactory>()
  private owners = new Map<string, string>()

  constructor(private readonly context: Arc3DContext) {
    this.register("color", (options) => options?.color ?? "#ffffff")
  }

  register(type: string, factory: MaterialFactory): void {
    this.context.lifecycle.assertUsable("register material")
    this.factories.set(type, factory)
    const owner = this.context.scopes?.owner
    if (owner) {
      this.owners.set(type, owner)
      this.context.scopes.get(owner)?.track(() => this.unregister(type))
    }
  }

  unregister(type: string): void {
    this.factories.delete(type)
    this.owners.delete(type)
  }

  unregisterByOwner(owner: string): void {
    for (const [type, registeredOwner] of this.owners) {
      if (registeredOwner === owner) this.unregister(type)
    }
  }

  has(type: string): boolean {
    return this.factories.has(type)
  }

  create(type: string, options?: Record<string, unknown>): unknown {
    this.context.lifecycle.assertUsable("create material")
    const factory = this.factories.get(type)
    if (!factory) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Unknown material: ${type}`)
    }
    return factory(options)
  }

  list(): string[] {
    return Array.from(this.factories.keys())
  }
}

export class EffectsManager {
  readonly materials: MaterialRegistry
  readonly postprocess: PostProcessManager

  constructor(context: Arc3DContext) {
    this.materials = new MaterialRegistry(context)
    this.postprocess = new PostProcessManager(context)
  }

  destroy(): void {
    this.postprocess.destroy()
  }
}

export { PostProcessManager, type PostProcessStageFactory } from "./postprocess"
