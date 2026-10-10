import { Arc3DError } from "./errors"
import type { SpatialReference, TimeRange, VerticalReference } from "./spatial"

/** 属性字段类型。 */
export type AttributeType =
  "string" | "number" | "integer" | "boolean" | "date" | "enum" | "geometry"

/** 要素属性字段定义。 */
export interface AttributeField {
  /** 字段名。 */
  name: string
  /** 字段类型。 */
  type: AttributeType
  /** 单位。 */
  unit?: string
  /** 枚举取值（`type` 为 `enum` 时使用）。 */
  enum?: ReadonlyArray<string | number>
  /** 是否必填。 */
  required?: boolean
  /** 展示名称。 */
  displayName?: string
  /** 是否为派生字段。 */
  derived?: boolean
}

/** 几何类型。 */
export type GeometryType =
  "point" | "multipoint" | "polyline" | "polygon" | "unknown"

/** 要素结构（属性 schema 与几何类型）。 */
export interface FeatureSchema {
  /** schema ID。 */
  id: string
  /** 属性字段列表。 */
  fields: AttributeField[]
  /** 几何类型。 */
  geometryType?: GeometryType
}

/** 数据资产格式。 */
export type DataAssetFormat =
  "geojson" | "kml" | "czml" | "3dtiles" | "terrain" | "raster" | "other"

/** 数据资产描述，与渲染视图解耦。 */
export interface DataAsset {
  /** 资产 ID。 */
  id: string
  /** 资产格式。 */
  format: DataAssetFormat
  /** 数据地址。 */
  uri?: string
  /** 数据版本。 */
  version?: string
  /** 空间范围 `[west, south, east, north]`（度）。 */
  extent?: [number, number, number, number]
  /** 时间范围。 */
  timeRange?: TimeRange
  /** 水平空间参考。 */
  spatialReference?: SpatialReference
  /** 垂直参考。 */
  verticalReference?: VerticalReference
  /** 要素结构。 */
  schema?: FeatureSchema
  /** 版权信息。 */
  copyright?: string
  /** 校验和。 */
  checksum?: string
  /** 数据来源。 */
  source?: string
}

/** 图层种类。 */
export type LayerKind =
  "basemap" | "imagery" | "tileset" | "vector" | "data" | (string & {})

/** 加载状态。 */
export type LoadState = "idle" | "loading" | "ready" | "failed" | "unloaded"

/** 图层元数据。 */
export interface LayerMetadata {
  /** 图层 ID。 */
  id: string
  /** 图层种类。 */
  kind: LayerKind
  /** 关联的数据资产 ID。 */
  assetId?: string
  /** 样式标识。 */
  style?: string
  /** 分组。 */
  group?: string
  /** 层级顺序。 */
  zIndex?: number
  /** 是否可见。 */
  visible: boolean
  /** 加载状态。 */
  loadState: LoadState
  /** 错误信息。 */
  error?: { code?: string; message: string }
  /** 版权信息。 */
  copyright?: string
  /** 水平空间参考。 */
  spatialReference?: SpatialReference
}

/** 稳定的要素引用。 */
export interface FeatureRef {
  /** 要素 ID。 */
  featureId: string
  /** 所属资产 ID。 */
  assetId: string
  /** 资产版本。 */
  version?: string
  /** 数据来源。 */
  source?: string
}

/**
 * 内存数据目录，描述数据资产及其渲染图层。
 *
 * 图层通过 ID 引用资产；移除图层不会移除资产，因此同一份领域数据可以支撑多个视图。
 */
export class DataCatalog {
  private readonly assets = new Map<string, DataAsset>()
  private readonly schemas = new Map<string, FeatureSchema>()
  private readonly layers = new Map<string, LayerMetadata>()

  /**
   * 注册数据资产。
   *
   * @param asset - 数据资产。
   * @throws {Arc3DError} 当资产 ID 已存在时抛出 `DUPLICATE_RESOURCE`。
   */
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

  /**
   * 获取数据资产。
   *
   * @param id - 资产 ID。
   */
  getAsset(id: string): DataAsset | undefined {
    return this.assets.get(id)
  }

  /**
   * 获取数据资产，不存在时抛错。
   *
   * @param id - 资产 ID。
   * @throws {Arc3DError} 资产不存在时抛出 `RESOURCE_NOT_FOUND`。
   */
  requireAsset(id: string): DataAsset {
    const asset = this.assets.get(id)
    if (!asset) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Data asset not found: ${id}`)
    }
    return asset
  }

  /**
   * 判断资产是否存在。
   *
   * @param id - 资产 ID。
   */
  hasAsset(id: string): boolean {
    return this.assets.has(id)
  }

  /** 列出全部数据资产。 */
  listAssets(): DataAsset[] {
    return Array.from(this.assets.values())
  }

  /**
   * 注销数据资产。
   *
   * @param id - 资产 ID。
   * @returns 是否删除了资产。
   */
  unregisterAsset(id: string): boolean {
    return this.assets.delete(id)
  }

  /**
   * 注册要素结构。
   *
   * @param schema - 要素结构。
   * @throws {Arc3DError} 当 schema ID 已存在时抛出 `DUPLICATE_RESOURCE`。
   */
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

  /**
   * 获取要素结构。
   *
   * @param id - schema ID。
   */
  getSchema(id: string): FeatureSchema | undefined {
    return this.schemas.get(id)
  }

  /**
   * 注册图层元数据。
   *
   * @param metadata - 图层元数据。
   * @throws {Arc3DError} 当图层 ID 已存在时抛出 `DUPLICATE_RESOURCE`。
   */
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

  /**
   * 更新图层元数据。
   *
   * @param id - 图层 ID。
   * @param patch - 需要更新的字段。
   * @throws {Arc3DError} 图层不存在时抛出 `RESOURCE_NOT_FOUND`。
   */
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

  /**
   * 获取图层元数据。
   *
   * @param id - 图层 ID。
   */
  getLayer(id: string): LayerMetadata | undefined {
    return this.layers.get(id)
  }

  /** 列出全部图层元数据。 */
  listLayers(): LayerMetadata[] {
    return Array.from(this.layers.values())
  }

  /**
   * 注销图层元数据。
   *
   * @param id - 图层 ID。
   * @returns 是否删除了图层。
   */
  unregisterLayer(id: string): boolean {
    return this.layers.delete(id)
  }

  /**
   * 解析要素引用到其数据资产。
   *
   * @param ref - 要素引用。
   * @throws {Arc3DError} 资产不存在时抛出 `RESOURCE_NOT_FOUND`。
   */
  resolveFeature(ref: FeatureRef): DataAsset {
    return this.requireAsset(ref.assetId)
  }

  /** 清空目录中的资产、结构与图层。 */
  clear(): void {
    this.assets.clear()
    this.schemas.clear()
    this.layers.clear()
  }
}
