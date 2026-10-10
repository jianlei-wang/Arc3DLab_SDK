import { createId } from "./ids"
import { Arc3DError } from "./errors"

export type ResourceId = string

export interface ResourceHandle<TNative = unknown> {
  id: ResourceId
  type: string
  native: TNative
  visible: boolean
  owned: boolean
  destroy(): void
}

export class ResourceRegistry<T extends ResourceHandle = ResourceHandle> {
  private items = new Map<ResourceId, T>()

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

  get(id: ResourceId): T | undefined {
    return this.items.get(id)
  }

  has(id: ResourceId): boolean {
    return this.items.has(id)
  }

  unregister(id: ResourceId): T | undefined {
    const item = this.items.get(id)
    if (!item) return undefined
    this.items.delete(id)
    return item
  }

  remove(id: ResourceId): boolean {
    const item = this.items.get(id)
    if (!item) return false
    this.items.delete(id)
    if (item.owned) item.destroy()
    return true
  }

  values(): T[] {
    return Array.from(this.items.values())
  }

  ids(): ResourceId[] {
    return Array.from(this.items.keys())
  }

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

export class ResourceTracker {
  private children = new Map<ResourceId, ResourceId[]>()

  link(parentId: ResourceId, childId: ResourceId): void {
    const list = this.children.get(parentId) ?? []
    list.push(childId)
    this.children.set(parentId, list)
  }

  childrenOf(parentId: ResourceId): ResourceId[] {
    return this.children.get(parentId) ?? []
  }

  unlink(parentId: ResourceId): ResourceId[] {
    const list = this.children.get(parentId) ?? []
    this.children.delete(parentId)
    return list
  }

  clear(): void {
    this.children.clear()
  }

  get size(): number {
    return this.children.size
  }
}

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
