import type { ResourceHandle } from "@arc3dlab/core"
import type { ProviderSpec } from "@arc3dlab/data"

export interface Layer extends ResourceHandle {
  name?: string
  zIndex?: number
  group?: string
}

export type BasemapSpec = ProviderSpec

export interface TerrainSpec {
  type: "url" | "ion" | "none"
  url?: string
  assetId?: number
}
