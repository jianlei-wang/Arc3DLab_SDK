import {
  Arc3DError,
  afterAwait,
  assertNewResourceId,
  classifyLoadError,
  createHandle,
  createId,
  runWithIonToken,
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
import { WebServiceManager } from "./web"

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
   * Web 数据服务管理器，可注入外部 Web 服务提供者。
   */
  readonly web: WebServiceManager

  /**
   * 创建数据管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {
    this.web = new WebServiceManager(context)
  }

  /**
   * 根据提供者规格创建影像提供者句柄。
   * @param spec - 影像提供者规格。
   * @returns 影像提供者句柄的 Promise。
   */
  async createProvider(spec: ProviderSpec): Promise<ProviderHandle> {
    this.context.lifecycle.assertUsable("create provider")
    return createProviderHandle(spec, {
      tdtToken: this.context.config.tokens?.tdt,
      runWithIonToken: (work, token) =>
        runWithIonToken(this.context, work, token),
    })
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
   *
   * 加载失败时保留 `loadState: "failed"` 的图层与资产作为诊断记录；再次使用
   * 同一 `id` 调用会先重置该失败记录，再按全新资产重试。加载成功后的视图登记、
   * 生命周期校验或注册表登记失败会回滚图层与资产，不保留半成品记录。
   *
   * @param spec - 数据源规格。
   * @returns 资源句柄的 Promise。
   * @throws {Arc3DError} 资源 ID 已被成功或正在加载的记录占用时抛出
   * `DUPLICATE_RESOURCE`；加载失败时抛出分类后的错误。
   */
  async add(spec: DataSourceSpec): Promise<ResourceHandle> {
    this.context.lifecycle.assertUsable("add data source")
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const id = spec.id ?? createId(spec.type)
    assertNewResourceId(this.context.registry, id)
    this.resetFailedRecord(id)
    this.context.catalog.registerAsset({ id, format: spec.type, uri: spec.url })
    try {
      this.context.catalog.registerLayer({
        id,
        kind: "data",
        assetId: id,
        visible: true,
        loadState: "loading",
      })
    } catch (error) {
      this.context.catalog.unregisterAsset(id)
      throw error
    }

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
      if (this.context.lifecycle.isTerminating) {
        this.rollbackRegistration(id)
        throw new Arc3DError(
          "APP_DESTROYED",
          "Cannot add data source after Arc3DApp has been destroyed",
        )
      }
      const classified = classifyLoadError(error)
      this.context.catalog.updateLayer(id, {
        loadState: "failed",
        error: { code: classified.code, message: classified.message },
      })
      throw classified
    }

    const removeSource = (): void => {
      try {
        viewer.dataSources.remove(source, true)
      } catch {
        // 应用销毁后底层 Viewer 可能已不可用。
      }
    }

    let registered = false
    try {
      await afterAwait(this.context.lifecycle, "add data source", source)
      await viewer.dataSources.add(source)
      await afterAwait(
        this.context.lifecycle,
        "add data source",
        source,
        removeSource,
      )
      const handle = createHandle({
        id,
        type: spec.type,
        native: source,
        onVisible: (visible) => {
          source.show = visible
        },
        onDestroy: () => {
          removeSource()
          this.context.registry.unregister(id)
          this.context.catalog.unregisterLayer(id)
          this.context.catalog.unregisterAsset(id)
          this.context.events.emit("layerRemoved", { id, type: spec.type })
        },
      })
      this.context.registry.add(handle)
      registered = true
      this.context.catalog.updateLayer(id, { loadState: "ready" })
      this.context.events.emit("layerAdded", { id, type: spec.type })
      return handle
    } catch (error) {
      if (registered) this.context.registry.unregister(id)
      removeSource()
      this.rollbackRegistration(id)
      throw error
    }
  }

  /**
   * 重置同一 ID 上保留的失败记录；成功或加载中的记录按重复资源处理。
   * @param id - 数据源标识。
   * @throws {Arc3DError} 存在非失败记录时抛出 `DUPLICATE_RESOURCE`。
   */
  private resetFailedRecord(id: string): void {
    const layer = this.context.catalog.getLayer(id)
    const asset = this.context.catalog.getAsset(id)
    if (!layer && !asset) return
    if (layer?.loadState === "failed") {
      this.context.catalog.unregisterLayer(id)
      this.context.catalog.unregisterAsset(id)
      return
    }
    throw new Arc3DError(
      "DUPLICATE_RESOURCE",
      `Data source already registered: ${id}`,
    )
  }

  /**
   * 回滚未成功登记为资源句柄的目录记录。
   * @param id - 数据源标识。
   */
  private rollbackRegistration(id: string): void {
    this.context.catalog.unregisterLayer(id)
    this.context.catalog.unregisterAsset(id)
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
  type ProviderOptions,
  type ProviderSpec,
  type ProviderType,
} from "./providers"
export {
  WebServiceManager,
  createGaodeProvider,
  type DrivingResult,
  type GaodeFetch,
  type GaodeProviderOptions,
  type GaodeResponse,
  type GeocodeResult,
  type PoiOptions,
  type PoiResult,
  type ReverseGeocodeResult,
  type RouteResult,
  type RouteStep,
  type TmcSegment,
  type WebServiceProvider,
} from "./web"
