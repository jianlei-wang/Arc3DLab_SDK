import { Arc3DError } from "./errors"
import { assertWritableExtension } from "./commands"

/** 工具的状态。 */
export type ToolState = "idle" | "deactivating" | "activating" | "active"

/** 描述一个工具的注册信息与激活逻辑。 */
export interface ToolSpec {
  /** 工具名称。 */
  name: string
  /** 工具版本。 */
  version: string
  /** 工具所属插件。 */
  plugin: string
  /** 依赖的其他工具名称。 */
  dependsOn?: string[]
  /** 激活工具。 */
  activate: () => void | Promise<void>
  /** 停用工具。 */
  deactivate?: () => void | Promise<void>
}

/** 管理工具注册、激活与停用的注册表。 */
export class ToolRegistry {
  private items = new Map<string, ToolSpec>()
  private active: string | undefined
  private current: ToolState = "idle"
  private queue: Promise<unknown> = Promise.resolve()

  /** 将状态迁移操作串行化到单一队列，避免并发激活/停用交错。 */
  private enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(operation, operation)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  /**
   * 注册一个工具。
   *
   * @param spec - 工具定义。
   * @param owner - 显式归属的插件名；省略时仅用于归属记录，不授予保留命名空间。
   * @throws {Arc3DError} 当工具名非法或已被注册时抛出，错误码为 `INVALID_ARGUMENT` 或 `DUPLICATE_RESOURCE`。
   */
  register(spec: ToolSpec, owner?: string): void {
    const resolved = owner ?? spec.plugin
    assertWritableExtension(spec.name, owner, "tool")
    if (this.items.has(spec.name)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Tool already registered: ${spec.name}`,
      )
    }
    this.items.set(spec.name, { ...spec, plugin: resolved })
  }

  /**
   * 注销指定工具，若其处于激活状态则先停用。
   *
   * 无论停用是否抛错，工具都会从注册表移除；停用错误会在移除后向外抛出。
   *
   * @param name - 工具名称。
   * @returns 停用与注销完成后的 Promise。
   */
  async unregister(name: string): Promise<void> {
    return this.enqueue(async () => {
      let deactivationError: unknown
      if (this.active === name) {
        this.current = "deactivating"
        try {
          await this.items.get(name)?.deactivate?.()
        } catch (error) {
          deactivationError = error
        } finally {
          this.active = undefined
          this.current = "idle"
        }
      }
      this.items.delete(name)
      if (deactivationError) throw deactivationError
    })
  }

  /**
   * 注销指定插件注册的全部工具。
   *
   * 逐项处理并聚合错误，某一项停用失败不会中止其余工具的注销。
   *
   * @param plugin - 插件名称。
   * @returns 全部工具注销完成后的 Promise。
   */
  async unregisterByPlugin(plugin: string): Promise<void> {
    const names = Array.from(this.items.entries())
      .filter(([, spec]) => spec.plugin === plugin)
      .map(([name]) => name)
    const errors: unknown[] = []
    for (const name of names) {
      try {
        await this.unregister(name)
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) {
      throw new Arc3DError(
        "ENGINE_FAILURE",
        `Failed to deactivate ${errors.length} tools for plugin ${plugin}`,
        errors,
      )
    }
  }

  /**
   * 判断工具是否已注册。
   *
   * @param name - 工具名称。
   * @returns 工具是否已注册。
   */
  has(name: string): boolean {
    return this.items.has(name)
  }

  /**
   * 列出全部已注册工具名称。
   *
   * @returns 工具名称数组。
   */
  list(): string[] {
    return Array.from(this.items.keys())
  }

  /** 当前激活的工具名，未激活时为 undefined。 */
  get activeTool(): string | undefined {
    return this.active
  }

  /** 当前工具状态。 */
  get state(): ToolState {
    return this.current
  }

  /**
   * 激活指定工具，必要时先停用当前工具。
   *
   * 停用旧工具有明确的失败契约：若 `deactivate()` 抛错，则回滚旧工具为活动状态
   * 并把状态恢复为 `active`，再向上抛出错误，避免遗留 `deactivating` 中间态。
   * 新工具 `activate()` 抛错时清空活动状态并置为 `idle`。
   *
   * @param name - 要激活的工具名称。
   * @returns 激活完成后的 Promise。
   * @throws {Arc3DError} 当工具未注册时抛出，错误码为 `RESOURCE_NOT_FOUND`。
   */
  async activate(name: string): Promise<void> {
    return this.enqueue(async () => {
      const spec = this.items.get(name)
      if (!spec) {
        throw new Arc3DError(
          "RESOURCE_NOT_FOUND",
          `Tool not registered: ${name}`,
        )
      }
      if (this.active === name) return
      if (this.active) {
        const previousName = this.active
        const previous = this.items.get(previousName)
        this.current = "deactivating"
        this.active = undefined
        try {
          await previous?.deactivate?.()
        } catch (error) {
          this.active = previousName
          this.current = "active"
          throw error
        }
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
    })
  }

  /**
   * 停用指定工具，默认停用当前激活的工具。
   *
   * @param name - 要停用的工具名称。
   * @returns 停用完成后的 Promise。
   */
  async deactivate(name?: string): Promise<void> {
    return this.enqueue(async () => {
      const target = name ?? this.active
      if (!target) return
      const spec = this.items.get(target)
      this.current = "deactivating"
      try {
        await spec?.deactivate?.()
      } finally {
        if (this.active === target) this.active = undefined
        this.current = this.active ? "active" : "idle"
      }
    })
  }
}
