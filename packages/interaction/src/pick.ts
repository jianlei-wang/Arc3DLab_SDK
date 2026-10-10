import type { PickKind } from "@arc3dlab/core"

const GRAPHIC_TYPES = new Set(["point", "polyline", "polygon", "model"])
const LAYER_TYPES = new Set([
  "imagery",
  "tileset",
  "basemap",
  "geojson",
  "kml",
  "czml",
])

export function normalizeResourceId(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === "string") return id
  }
  return undefined
}

export function parentResourceId(id: string): string | undefined {
  const index = id.indexOf("#")
  if (index <= 0) return undefined
  return id.slice(0, index)
}

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

export interface ResolvedPick {
  kind: PickKind
  graphicId?: string
  layerId?: string
}

export interface ResolvePickInput {
  rawId?: string
  lookup: (id: string) => { id: string; type: string } | undefined
  tilesetId?: string
  isTerrain?: boolean
  hasNative?: boolean
}

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

export function pickIdentity(result: {
  graphicId?: string
  layerId?: string
  kind?: string
}): string {
  if (result.graphicId) return `graphic:${result.graphicId}`
  if (result.layerId) return `layer:${result.layerId}`
  return result.kind ?? "empty"
}

export class HoverGate {
  private lastKey: string | undefined

  observe(key: string): boolean {
    if (this.lastKey === key) return false
    this.lastKey = key
    return true
  }

  leave(): boolean {
    if (this.lastKey === undefined || this.lastKey === "empty") {
      this.lastKey = "empty"
      return false
    }
    this.lastKey = "empty"
    return true
  }

  reset(): void {
    this.lastKey = undefined
  }
}

export { GRAPHIC_TYPES, LAYER_TYPES }
