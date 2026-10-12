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
 * 对目录中的值做防御性复制。
 *
 * 目录采用不可变快照语义：输入时复制，对外返回副本。无法结构化克隆的值
 * 退化为浅拷贝，调用方不应在目录对象上挂载不可序列化内容。
 *
 * @param value - 待复制的值。
 * @returns 复制后的值。
 */
function copy<T>(value: T): T {
  if (value === null || typeof value !== "object") return value
  try {
    return structuredClone(value)
  } catch {
    return (Array.isArray(value) ? value.slice() : { ...value }) as T
  }
}

/**
 * 内存数据目录，描述数据资产及其渲染图层。
 *
 * 图层通过 ID 引用资产；移除图层不会移除资产，因此同一份领域数据可以支撑多个视图。
 *
 * 可变性合同：目录采用**不可变快照模型**——注册时存储输入的独立副本，所有读取方法
 * 返回的也是副本。调用方修改最初传入的对象或读取到的对象，都不会改变目录内部状态；
 * 任何更新都必须通过目录自身的方法（如 {@link DataCatalog.updateLayer}）进行。注册
 * 操作是事务性的：任一约束校验失败时不会留下部分提交的状态。
 */
export class DataCatalog {
  private readonly assets = new Map<string, DataAsset>()
  private readonly schemas = new Map<string, FeatureSchema>()
  /** 由资产携带注册的 schema 归属：schemaId -> assetId。 */
  private readonly schemaOwners = new Map<string, string>()
  private readonly layers = new Map<string, LayerMetadata>()

  /**
   * 注册数据资产及其可选要素结构。
   *
   * 该操作是事务性的：先校验资产 ID 与 schema ID 均无冲突，再一次性提交资产与
   * schema；若 schema 冲突，资产不会被写入目录。资产携带的 schema 由该资产拥有，
   * 注销资产时会一并移除其 schema。
   *
   * @param asset - 数据资产。
   * @returns 已注册资产的快照副本。
   * @throws {Arc3DError} 当资产 ID 或 schema ID 已存在时抛出 `DUPLICATE_RESOURCE`。
   */
  registerAsset(asset: DataAsset): DataAsset {
    if (this.assets.has(asset.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Data asset already registered: ${asset.id}`,
      )
    }
    if (asset.schema && this.schemas.has(asset.schema.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Feature schema already registered: ${asset.schema.id}`,
      )
    }
    const stored = copy(asset)
    this.assets.set(stored.id, stored)
    if (stored.schema) {
      this.schemas.set(stored.schema.id, copy(stored.schema))
      this.schemaOwners.set(stored.schema.id, stored.id)
    }
    return copy(stored)
  }

  /**
   * 获取数据资产。
   *
   * @param id - 资产 ID。
   * @returns 资产的快照副本，不存在时为 undefined。
   */
  getAsset(id: string): DataAsset | undefined {
    const asset = this.assets.get(id)
    return asset ? copy(asset) : undefined
  }

  /**
   * 获取数据资产，不存在时抛错。
   *
   * @param id - 资产 ID。
   * @returns 资产的快照副本。
   * @throws {Arc3DError} 资产不存在时抛出 `RESOURCE_NOT_FOUND`。
   */
  requireAsset(id: string): DataAsset {
    const asset = this.assets.get(id)
    if (!asset) {
      throw new Arc3DError("RESOURCE_NOT_FOUND", `Data asset not found: ${id}`)
    }
    return copy(asset)
  }

  /**
   * 判断资产是否存在。
   *
   * @param id - 资产 ID。
   */
  hasAsset(id: string): boolean {
    return this.assets.has(id)
  }

  /** 列出全部数据资产（快照副本）。 */
  listAssets(): DataAsset[] {
    return Array.from(this.assets.values(), (asset) => copy(asset))
  }

  /**
   * 注销数据资产及其携带的 schema。
   *
   * 资产携带注册的 schema 归该资产所有：删除资产时会同时移除对应 schema，避免
   * 出现悬挂 schema 并允许之后用相同 ID 重新注册。
   *
   * @param id - 资产 ID。
   * @returns 是否删除了资产。
   */
  unregisterAsset(id: string): boolean {
    const asset = this.assets.get(id)
    const deleted = this.assets.delete(id)
    const schemaId = asset?.schema?.id
    if (schemaId && this.schemaOwners.get(schemaId) === id) {
      this.schemas.delete(schemaId)
      this.schemaOwners.delete(schemaId)
    }
    return deleted
  }

  /**
   * 注册一个独立于资产的要素结构。
   *
   * 通过本方法注册的 schema 不归任何资产所有，需通过 {@link unregisterSchema}
   * 显式注销。
   *
   * @param schema - 要素结构。
   * @returns 已注册结构的快照副本。
   * @throws {Arc3DError} 当 schema ID 已存在时抛出 `DUPLICATE_RESOURCE`。
   */
  registerSchema(schema: FeatureSchema): FeatureSchema {
    if (this.schemas.has(schema.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Feature schema already registered: ${schema.id}`,
      )
    }
    const stored = copy(schema)
    this.schemas.set(stored.id, stored)
    return copy(stored)
  }

  /**
   * 判断要素结构是否存在。
   *
   * @param id - schema ID。
   */
  hasSchema(id: string): boolean {
    return this.schemas.has(id)
  }

  /**
   * 注销独立注册的要素结构。
   *
   * @param id - schema ID。
   * @returns 是否删除了 schema。
   * @throws {Arc3DError} 当 schema 归某个仍存在的资产所有时抛出 `INVALID_ARGUMENT`，
   * 此时应先注销对应资产。
   */
  unregisterSchema(id: string): boolean {
    const ownerId = this.schemaOwners.get(id)
    if (ownerId && this.assets.has(ownerId)) {
      throw new Arc3DError(
        "INVALID_ARGUMENT",
        `Feature schema owned by asset ${ownerId}: ${id}`,
      )
    }
    this.schemaOwners.delete(id)
    return this.schemas.delete(id)
  }

  /**
   * 获取要素结构。
   *
   * @param id - schema ID。
   * @returns 结构的快照副本，不存在时为 undefined。
   */
  getSchema(id: string): FeatureSchema | undefined {
    const schema = this.schemas.get(id)
    return schema ? copy(schema) : undefined
  }

  /**
   * 注册图层元数据。
   *
   * @param metadata - 图层元数据。
   * @returns 已注册元数据的快照副本。
   * @throws {Arc3DError} 当图层 ID 已存在时抛出 `DUPLICATE_RESOURCE`。
   */
  registerLayer(metadata: LayerMetadata): LayerMetadata {
    if (this.layers.has(metadata.id)) {
      throw new Arc3DError(
        "DUPLICATE_RESOURCE",
        `Layer metadata already registered: ${metadata.id}`,
      )
    }
    const stored = copy(metadata)
    this.layers.set(stored.id, stored)
    return copy(stored)
  }

  /**
   * 更新图层元数据。
   *
   * @param id - 图层 ID。
   * @param patch - 需要更新的字段。
   * @returns 更新后的快照副本。
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
    const next = copy({ ...current, ...patch, id })
    this.layers.set(id, next)
    return copy(next)
  }

  /**
   * 获取图层元数据。
   *
   * @param id - 图层 ID。
   * @returns 元数据的快照副本，不存在时为 undefined。
   */
  getLayer(id: string): LayerMetadata | undefined {
    const layer = this.layers.get(id)
    return layer ? copy(layer) : undefined
  }

  /** 列出全部图层元数据（快照副本）。 */
  listLayers(): LayerMetadata[] {
    return Array.from(this.layers.values(), (layer) => copy(layer))
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
    this.schemaOwners.clear()
    this.layers.clear()
  }
}
