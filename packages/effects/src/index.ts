import { Arc3DError, type Arc3DContext } from "@arc3dlab/core"
import { PostProcessManager } from "./postprocess"

/**
 * 材质工厂函数类型，根据可选配置创建材质实例。
 */
export type MaterialFactory = (options?: Record<string, unknown>) => unknown

/**
 * 材质注册表，按类型注册、创建与注销材质工厂。
 */
export class MaterialRegistry {
  private factories = new Map<string, MaterialFactory>()
  private owners = new Map<string, string>()

  /**
   * 创建材质注册表实例。
   * @param context - Arc3D 运行时上下文
   */
  constructor(private readonly context: Arc3DContext) {
    this.register("color", (options) => options?.color ?? "#ffffff")
  }

  /**
   * 注册指定类型的材质工厂，并在存在作用域时记录归属。
   * @param type - 材质类型标识
   * @param factory - 用于创建该类型材质的工厂函数
   */
  register(type: string, factory: MaterialFactory): void {
    this.context.lifecycle.assertUsable("register material")
    this.factories.set(type, factory)
    const owner = this.context.scopes?.owner
    if (owner) {
      this.owners.set(type, owner)
      this.context.scopes.get(owner)?.track(() => this.unregister(type))
    }
  }

  /**
   * 注销指定类型的材质工厂。
   * @param type - 材质类型标识
   */
  unregister(type: string): void {
    this.factories.delete(type)
    this.owners.delete(type)
  }

  /**
   * 注销指定归属者注册的全部材质工厂。
   * @param owner - 归属者标识
   */
  unregisterByOwner(owner: string): void {
    for (const [type, registeredOwner] of this.owners) {
      if (registeredOwner === owner) this.unregister(type)
    }
  }

  /**
   * 判断指定类型的材质是否已注册。
   * @param type - 材质类型标识
   * @returns 已注册时返回 true
   */
  has(type: string): boolean {
    return this.factories.has(type)
  }

  /**
   * 创建指定类型的材质实例。
   * @param type - 材质类型标识
   * @param options - 传递给工厂的可选配置
   * @returns 工厂创建出的材质实例
   * @throws {Arc3DError} 当指定类型未注册时抛出
   */
  create(type: string, options?: Record<string, unknown>): unknown {
    this.context.lifecycle.assertUsable("create material")
    const factory = this.factories.get(type)
    if (!factory) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Unknown material: ${type}`)
    }
    return factory(options)
  }

  /**
   * 列出所有已注册的材质类型。
   * @returns 材质类型标识数组
   */
  list(): string[] {
    return Array.from(this.factories.keys())
  }
}

/**
 * 效果管理器，聚合材质注册表与后处理管理器。
 */
export class EffectsManager {
  /**
   * 材质注册表实例。
   */
  readonly materials: MaterialRegistry
  /**
   * 后处理管理器实例。
   */
  readonly postprocess: PostProcessManager

  /**
   * 创建效果管理器实例。
   * @param context - Arc3D 运行时上下文
   */
  constructor(context: Arc3DContext) {
    this.materials = new MaterialRegistry(context)
    this.postprocess = new PostProcessManager(context)
  }

  /**
   * 销毁效果管理器并释放后处理资源。
   */
  destroy(): void {
    this.postprocess.destroy()
  }
}

export { PostProcessManager, type PostProcessStageFactory } from "./postprocess"
