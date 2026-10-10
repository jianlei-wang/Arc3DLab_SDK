import { createId } from "./ids"
import { Arc3DError } from "./errors"

/** 资源标识符类型。 */
export type ResourceId = string

/** 描述一个已注册资源句柄的结构。 */
export interface ResourceHandle<TNative = unknown> {
  /** 资源唯一标识。 */
  id: ResourceId
  /** 资源类型。 */
  type: string
  /** 底层原生对象。 */
  native: TNative
  /** 资源当前是否可见。 */
  visible: boolean
  /** 资源是否由本 SDK 持有并负责销毁。 */
  owned: boolean
  /** 销毁该资源。 */
  destroy(): void
}

/** 维护资源句柄的注册表，支持增删查与级联清理。 */
export class ResourceRegistry<T extends ResourceHandle = ResourceHandle> {
  private items = new Map<ResourceId, T>()

  /**
   * 注册一个资源。
   *
   * @param resource - 待注册的资源句柄。
   * @returns 该资源的标识符。
   * @throws {Arc3DError} 当相同标识的资源已存在时抛出，错误码为 `DUPLICATE_RESOURCE`。
   */
  add(resource: T): ResourceId {
    if (this.items.has(resource.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Resource already exists: ${resource.id}`,
      )
    }
    this.items.set(resource.id, resource)
    return resource.id
  }

  /**
   * 按标识获取资源。
   *
   * @param id - 资源标识。
   * @returns 对应的资源句柄，不存在时为 undefined。
   */
  get(id: ResourceId): T | undefined {
    return this.items.get(id)
  }

  /**
   * 判断指定标识的资源是否存在。
   *
   * @param id - 资源标识。
   * @returns 资源是否存在。
   */
  has(id: ResourceId): boolean {
    return this.items.has(id)
  }

  /**
   * 从注册表中移除资源但不销毁它。
   *
   * @param id - 资源标识。
   * @returns 被移除的资源句柄，不存在时为 undefined。
   */
  unregister(id: ResourceId): T | undefined {
    const item = this.items.get(id)
    if (!item) return undefined
    this.items.delete(id)
    return item
  }

  /**
   * 从注册表中移除资源，并在其由 SDK 持有时销毁它。
   *
   * @param id - 资源标识。
   * @returns 是否成功移除。
   */
  remove(id: ResourceId): boolean {
    const item = this.items.get(id)
    if (!item) return false
    this.items.delete(id)
    if (item.owned) item.destroy()
    return true
  }

  /**
   * 获取全部已注册资源。
   *
   * @returns 资源句柄数组。
   */
  values(): T[] {
    return Array.from(this.items.values())
  }

  /**
   * 获取全部已注册资源的标识。
   *
   * @returns 资源标识数组。
   */
  ids(): ResourceId[] {
    return Array.from(this.items.keys())
  }

  /**
   * 按父子关系逐层清理并销毁全部资源。
   *
   * @param tracker - 提供父子关系的资源追踪器。
   */
  clear(tracker?: ResourceTracker): void {
    const seen = new Set<ResourceId>()
    const destroyTree = (id: ResourceId): void => {
      if (seen.has(id)) return
      seen.add(id)
      for (const child of [...(tracker?.childrenOf(id) ?? [])].reverse())
        destroyTree(child)
      const item = this.items.get(id)
      if (!item) return
      this.items.delete(id)
      if (item.owned) item.destroy()
    }
    for (const id of this.ids()) destroyTree(id)
    this.items.clear()
    tracker?.clear()
  }
}

/** 记录资源之间父子关系的追踪器，用于级联销毁。 */
export class ResourceTracker {
  private children = new Map<ResourceId, ResourceId[]>()

  /**
   * 建立父子资源关系。
   *
   * @param parentId - 父资源标识。
   * @param childId - 子资源标识。
   */
  link(parentId: ResourceId, childId: ResourceId): void {
    const list = this.children.get(parentId) ?? []
    list.push(childId)
    this.children.set(parentId, list)
  }

  /**
   * 获取指定资源的全部子资源。
   *
   * @param parentId - 父资源标识。
   * @returns 子资源标识数组。
   */
  childrenOf(parentId: ResourceId): ResourceId[] {
    return this.children.get(parentId) ?? []
  }

  /**
   * 解除指定资源与其子资源的关联。
   *
   * @param parentId - 父资源标识。
   * @returns 被解除关联的子资源标识数组。
   */
  unlink(parentId: ResourceId): ResourceId[] {
    const list = this.children.get(parentId) ?? []
    this.children.delete(parentId)
    return list
  }

  /** 清除全部父子关系记录。 */
  clear(): void {
    this.children.clear()
  }

  /** 已记录的父子关系数量。 */
  get size(): number {
    return this.children.size
  }
}

/**
 * 创建一个资源句柄，统一管理可见性与销毁行为。
 *
 * @param options - 句柄配置，包含可选的 `id`、`type`、`native`、`owned` 以及 `onDestroy`、`onVisible` 回调。
 * @returns 新建的资源句柄。
 */
export function createHandle<TNative>(options: {
  id?: string
  type: string
  native: TNative
  owned?: boolean
  onDestroy?: () => void
  onVisible?: (visible: boolean) => void
}): ResourceHandle<TNative> {
  let visible = true
  let destroyed = false
  const id = options.id ?? createId(options.type)

  return {
    id,
    type: options.type,
    native: options.native,
    owned: options.owned ?? true,
    get visible() {
      return visible
    },
    set visible(value: boolean) {
      visible = value
      options.onVisible?.(value)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      if (options.owned === false) return
      options.onDestroy?.()
    },
  }
}

/**
 * 以原子方式注册资源，注册失败时执行回滚。
 *
 * @param registry - 目标资源注册表。
 * @param resource - 待注册的资源句柄。
 * @param rollback - 注册失败时调用的回滚回调。
 * @returns 注册成功的资源句柄。
 * @throws {Arc3DError} 当注册失败时重新抛出注册表产生的错误。
 */
export function registerAtomically<T extends ResourceHandle>(
  registry: ResourceRegistry,
  resource: T,
  rollback: () => void,
): T {
  try {
    registry.add(resource)
    return resource
  } catch (error) {
    rollback()
    throw error
  }
}
