import {
  Arc3DError,
  afterAwait,
  assertNewResourceId,
  classifyLoadError,
  createHandle,
  createId,
  type Arc3DContext,
  type ResourceHandle,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  CzmlDataSource,
  GeoJsonDataSource,
  KmlDataSource,
  type DataSource,
} from "cesium"
import {
  createProviderHandle,
  type ProviderHandle,
  type ProviderSpec,
} from "./providers"

/**
 * 支持的数据源格式类型。
 */
export type DataFormat = "geojson" | "kml" | "czml"

/**
 * 描述一个待加载的数据源。
 */
export interface DataSourceSpec {
  /** 可选的资源标识符，未提供时自动生成。 */
  id?: string
  /** 数据源格式类型。 */
  type: DataFormat
  /** 数据源地址。 */
  url: string
}

/**
 * 负责创建影像提供者并加载、管理各类数据源。
 */
export class DataManager {
  /**
   * 创建数据管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 根据提供者规格创建影像提供者句柄。
   * @param spec - 影像提供者规格。
   * @returns 影像提供者句柄的 Promise。
   */
  async createProvider(spec: ProviderSpec): Promise<ProviderHandle> {
    this.context.lifecycle.assertUsable("create provider")
    return createProviderHandle(spec, this.context.config.tokens?.tdt)
  }

  /**
   * 加载数据源并返回资源句柄，是 add 的别名。
   * @param spec - 数据源规格。
   * @returns 资源句柄的 Promise。
   */
  load(spec: DataSourceSpec): Promise<ResourceHandle> {
    return this.add(spec)
  }

  /**
   * 将数据源添加到 Cesium 视图并注册对应图层。
   * @param spec - 数据源规格。
   * @returns 资源句柄的 Promise。
   */
  async add(spec: DataSourceSpec): Promise<ResourceHandle> {
    this.context.lifecycle.assertUsable("add data source")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = spec.id ?? createId(spec.type)
    assertNewResourceId(this.context.registry, id)
    this.context.catalog.registerAsset({ id, format: spec.type, uri: spec.url })
    this.context.catalog.registerLayer({
      id,
      kind: "data",
      assetId: id,
      visible: true,
      loadState: "loading",
    })

    let source: DataSource
    try {
      if (spec.type === "geojson")
        source = await GeoJsonDataSource.load(spec.url)
      else if (spec.type === "kml") source = await KmlDataSource.load(spec.url)
      else if (spec.type === "czml")
        source = await CzmlDataSource.load(spec.url)
      else
        throw new Arc3DError(
          "INVALID_ARGUMENT",
          `Unsupported data type: ${String(spec.type)}`,
        )
    } catch (error) {
      const classified = classifyLoadError(error)
      this.context.catalog.updateLayer(id, {
        loadState: "failed",
        error: { code: classified.code, message: classified.message },
      })
      throw classified
    }

    await afterAwait(this.context.lifecycle, "add data source", source)
    await viewer.dataSources.add(source)
    await afterAwait(this.context.lifecycle, "add data source", source, () => {
      viewer.dataSources.remove(source, true)
    })
    const handle = createHandle({
      id,
      type: spec.type,
      native: source,
      onVisible: (visible) => {
        source.show = visible
      },
      onDestroy: () => {
        viewer.dataSources.remove(source, true)
        this.context.registry.unregister(id)
        this.context.catalog.unregisterLayer(id)
        this.context.events.emit("layerRemoved", { id, type: spec.type })
      },
    })
    try {
      this.context.registry.add(handle)
    } catch (error) {
      viewer.dataSources.remove(source, true)
      this.context.catalog.unregisterLayer(id)
      throw error
    }
    this.context.catalog.updateLayer(id, { loadState: "ready" })
    this.context.events.emit("layerAdded", { id, type: spec.type })
    return handle
  }

  /**
   * 加载 GeoJSON 数据源。
   * @param options - 可选的资源标识符与数据源地址。
   * @returns 资源句柄的 Promise。
   */
  addGeoJson(options: { id?: string; url: string }): Promise<ResourceHandle> {
    return this.add({ ...options, type: "geojson" })
  }

  /**
   * 加载 KML 数据源。
   * @param options - 可选的资源标识符与数据源地址。
   * @returns 资源句柄的 Promise。
   */
  addKml(options: { id?: string; url: string }): Promise<ResourceHandle> {
    return this.add({ ...options, type: "kml" })
  }

  /**
   * 加载 CZML 数据源。
   * @param options - 可选的资源标识符与数据源地址。
   * @returns 资源句柄的 Promise。
   */
  addCzml(options: { id?: string; url: string }): Promise<ResourceHandle> {
    return this.add({ ...options, type: "czml" })
  }
}

export {
  createImageryProvider,
  createProviderHandle,
  tdtUrl,
  type ProviderHandle,
  type ProviderSpec,
  type ProviderType,
} from "./providers"
