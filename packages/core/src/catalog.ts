import { Arc3DError } from "./errors"
import type { SpatialReference, TimeRange, VerticalReference } from "./spatial"

export type AttributeType =
  "string" | "number" | "integer" | "boolean" | "date" | "enum" | "geometry"

export interface AttributeField {
  name: string
  type: AttributeType
  unit?: string
  enum?: ReadonlyArray<string | number>
  required?: boolean
  displayName?: string
  derived?: boolean
}

export type GeometryType =
  "point" | "multipoint" | "polyline" | "polygon" | "unknown"

export interface FeatureSchema {
  id: string
  fields: AttributeField[]
  geometryType?: GeometryType
}

export type DataAssetFormat =
  "geojson" | "kml" | "czml" | "3dtiles" | "terrain" | "raster" | "other"

export interface DataAsset {
  id: string
  format: DataAssetFormat
  uri?: string
  version?: string
  extent?: [number, number, number, number]
  timeRange?: TimeRange
  spatialReference?: SpatialReference
  verticalReference?: VerticalReference
  schema?: FeatureSchema
  copyright?: string
  checksum?: string
  source?: string
}

export type LayerKind =
  "basemap" | "imagery" | "tileset" | "vector" | "data" | (string & {})

export type LoadState = "idle" | "loading" | "ready" | "failed" | "unloaded"

export interface LayerMetadata {
  id: string
  kind: LayerKind
  assetId?: string
  style?: string
  group?: string
  zIndex?: number
  visible: boolean
  loadState: LoadState
  error?: { code?: string; message: string }
  copyright?: string
  spatialReference?: SpatialReference
}

export interface FeatureRef {
  featureId: string
  assetId: string
  version?: string
  source?: string
}

/**
 * In-memory catalog describing data assets and the layers that render them.
 *
 * A layer references an asset by id; removing the layer never removes the
 * asset, so the same domain data can back multiple views.
 */
export class DataCatalog {
  private readonly assets = new Map<string, DataAsset>()
  private readonly schemas = new Map<string, FeatureSchema>()
  private readonly layers = new Map<string, LayerMetadata>()

  registerAsset(asset: DataAsset): DataAsset {
    if (this.assets.has(asset.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Data asset already registered: ${asset.id}`,
      )
    }
    this.assets.set(asset.id, asset)
    if (asset.schema) this.registerSchema(asset.schema)
    return asset
  }

  getAsset(id: string): DataAsset | undefined {
    return this.assets.get(id)
  }

  requireAsset(id: string): DataAsset {
    const asset = this.assets.get(id)
    if (!asset) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Data asset not found: ${id}`)
    }
    return asset
  }

  hasAsset(id: string): boolean {
    return this.assets.has(id)
  }

  listAssets(): DataAsset[] {
    return Array.from(this.assets.values())
  }

  unregisterAsset(id: string): boolean {
    return this.assets.delete(id)
  }

  registerSchema(schema: FeatureSchema): FeatureSchema {
    if (this.schemas.has(schema.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Feature schema already registered: ${schema.id}`,
      )
    }
    this.schemas.set(schema.id, schema)
    return schema
  }

  getSchema(id: string): FeatureSchema | undefined {
    return this.schemas.get(id)
  }

  registerLayer(metadata: LayerMetadata): LayerMetadata {
    if (this.layers.has(metadata.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Layer metadata already registered: ${metadata.id}`,
      )
    }
    this.layers.set(metadata.id, metadata)
    return metadata
  }

  updateLayer(id: string, patch: Partial<LayerMetadata>): LayerMetadata {
    const current = this.layers.get(id)
    if (!current) {
      throw new Arc3DError(
        "RESOURCE_NOT_FOUND",
        `Layer metadata not found: ${id}`,
      )
    }
    const next = { ...current, ...patch, id }
    this.layers.set(id, next)
    return next
  }

  getLayer(id: string): LayerMetadata | undefined {
    return this.layers.get(id)
  }

  listLayers(): LayerMetadata[] {
    return Array.from(this.layers.values())
  }

  unregisterLayer(id: string): boolean {
    return this.layers.delete(id)
  }

  resolveFeature(ref: FeatureRef): DataAsset {
    return this.requireAsset(ref.assetId)
  }

  clear(): void {
    this.assets.clear()
    this.schemas.clear()
    this.layers.clear()
  }
}
