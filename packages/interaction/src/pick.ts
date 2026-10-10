import type { PickKind } from "@arc3dlab/core"

/**
 * 图形类资源类型集合。
 */
const GRAPHIC_TYPES = new Set(["point", "polyline", "polygon", "model"])
/**
 * 图层类资源类型集合。
 */
const LAYER_TYPES = new Set([
  "imagery",
  "tileset",
  "basemap",
  "geojson",
  "kml",
  "czml",
])

/**
 * 从任意原生拾取对象中提取资源标识字符串。
 * @param raw - 原生拾取对象或其标识。
 * @returns 资源标识，无法解析时返回 undefined。
 */
export function normalizeResourceId(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === "string") return id
  }
  return undefined
}

/**
 * 从包含子项的资源标识中提取父级资源标识。
 * @param id - 完整的资源标识。
 * @returns 父级资源标识，不存在时返回 undefined。
 */
export function parentResourceId(id: string): string | undefined {
  const index = id.indexOf("#")
  if (index <= 0) return undefined
  return id.slice(0, index)
}

/**
 * 根据资源类型将拾取到的标识归类为图形或图层。
 * @param rawId - 原始资源标识。
 * @param lookup - 根据标识查询资源信息的函数。
 * @returns 包含图形标识或图层标识的对象。
 */
export function classifyPickedId(
  rawId: string | undefined,
  lookup: (id: string) => { id: string; type: string } | undefined,
): { graphicId?: string; layerId?: string } {
  if (!rawId) return {}
  const resource = lookup(rawId)
  if (resource && GRAPHIC_TYPES.has(resource.type))
    return { graphicId: resource.id }
  if (resource && LAYER_TYPES.has(resource.type))
    return { layerId: resource.id }
  const parentId = parentResourceId(rawId)
  if (parentId) {
    const parent = lookup(parentId)
    if (parent && GRAPHIC_TYPES.has(parent.type))
      return { graphicId: parent.id }
    if (parent && LAYER_TYPES.has(parent.type)) return { layerId: parent.id }
  }
  return {}
}

/**
 * 描述拾取解析后的结果。
 */
export interface ResolvedPick {
  /** 拾取结果类别。 */
  kind: PickKind
  /** 命中的图形标识。 */
  graphicId?: string
  /** 命中的图层标识。 */
  layerId?: string
}

/**
 * 描述解析拾取结果所需的输入。
 */
export interface ResolvePickInput {
  /** 原始资源标识。 */
  rawId?: string
  /** 根据标识查询资源信息的函数。 */
  lookup: (id: string) => { id: string; type: string } | undefined
  /** 三维瓦片集标识。 */
  tilesetId?: string
  /** 是否命中地形。 */
  isTerrain?: boolean
  /** 是否存在原生拾取对象。 */
  hasNative?: boolean
}

/**
 * 根据拾取输入综合判断拾取结果的类别与命中资源。
 * @param input - 解析拾取结果所需的输入。
 * @returns 解析后的拾取结果。
 */
export function resolvePick(input: ResolvePickInput): ResolvedPick {
  const classified = classifyPickedId(input.rawId, input.lookup)
  if (classified.graphicId) {
    return { kind: "graphic", graphicId: classified.graphicId }
  }
  if (input.tilesetId) {
    const tileset = input.lookup(input.tilesetId)
    if (tileset && LAYER_TYPES.has(tileset.type)) {
      return { kind: "tiles-feature", layerId: tileset.id }
    }
    return input.hasNative ? { kind: "native" } : { kind: "empty" }
  }
  if (classified.layerId) {
    return { kind: "layer", layerId: classified.layerId }
  }
  if (input.isTerrain) {
    return { kind: "terrain" }
  }
  if (input.hasNative) {
    return { kind: "native" }
  }
  return { kind: "empty" }
}

/**
 * 为拾取结果生成用于比较的稳定标识字符串。
 * @param result - 包含图形标识、图层标识或类别的拾取结果。
 * @returns 拾取结果的标识字符串。
 */
export function pickIdentity(result: {
  graphicId?: string
  layerId?: string
  kind?: string
}): string {
  if (result.graphicId) return `graphic:${result.graphicId}`
  if (result.layerId) return `layer:${result.layerId}`
  return result.kind ?? "empty"
}

/**
 * 悬停去重门控，用于避免重复触发相同目标的悬停事件。
 */
export class HoverGate {
  private lastKey: string | undefined

  /**
   * 记录并判断当前悬停目标是否发生变化。
   * @param key - 当前悬停目标的标识。
   * @returns 目标发生变化时返回 true。
   */
  observe(key: string): boolean {
    if (this.lastKey === key) return false
    this.lastKey = key
    return true
  }

  /**
   * 处理悬停离开并判断是否需要派发离开事件。
   * @returns 之前存在有效悬停目标时返回 true。
   */
  leave(): boolean {
    if (this.lastKey === undefined || this.lastKey === "empty") {
      this.lastKey = "empty"
      return false
    }
    this.lastKey = "empty"
    return true
  }

  /**
   * 重置门控状态。
   */
  reset(): void {
    this.lastKey = undefined
  }
}

export { GRAPHIC_TYPES, LAYER_TYPES }
