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
      throw new Arc3DError("DUPLICATE_RESOURCE", `Resource already exists: ${resource.id}`)
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

  clear(): void {
    for (const item of Array.from(this.items.values())) {
      if (item.owned) item.destroy()
    }
    this.items.clear()
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
}

export function createHandle<TNative>(
  options: {
    id?: string
    type: string
    native: TNative
    owned?: boolean
    onDestroy?: () => void
    onVisible?: (visible: boolean) => void
  }
): ResourceHandle<TNative> {
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
      options.onDestroy?.()
    },
  }
}
