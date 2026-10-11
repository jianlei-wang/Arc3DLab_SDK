import { Arc3DError, type Arc3DContext, type LngLat } from "@arc3dlab/core"
import type {
  DrivingResult,
  GeocodeResult,
  PoiOptions,
  PoiResult,
  ReverseGeocodeResult,
  WebServiceProvider,
} from "./types"

export { createGaodeProvider } from "./provider"
export type {
  GaodeFetch,
  GaodeProviderOptions,
  GaodeResponse,
} from "./provider"
export type {
  DrivingResult,
  GeocodeResult,
  PoiOptions,
  PoiResult,
  ReverseGeocodeResult,
  RouteResult,
  RouteStep,
  TmcSegment,
  WebServiceProvider,
} from "./types"

/**
 * Web 数据服务管理器，持有可注入的 {@link WebServiceProvider} 并代理其能力。
 *
 * 未注入提供者时，所有请求方法都会抛出错误码为 `PROVIDER_UNAVAILABLE` 的
 * {@link Arc3DError}，从而把“外部服务是否可用”的决策交给调用方。
 */
export class WebServiceManager {
  private current: WebServiceProvider | undefined

  /**
   * 创建 Web 数据服务管理器。
   * @param context - Arc3D 运行时上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /** 当前已注入的提供者，未注入时为 undefined。 */
  get provider(): WebServiceProvider | undefined {
    return this.current
  }

  /**
   * 注入或清除 Web 数据服务提供者。
   * @param provider - 提供者实例，传入 undefined 表示清除。
   */
  setProvider(provider?: WebServiceProvider): void {
    this.current = provider
  }

  /**
   * 执行驾车路径规划。
   * @param origin - 起点（WGS84）。
   * @param destination - 终点（WGS84）。
   * @returns 含路况分段的路径规划结果。
   */
  driving(origin: LngLat, destination: LngLat): Promise<DrivingResult> {
    return this.require("driving").driving(origin, destination)
  }

  /**
   * 执行关键字 POI 检索。
   * @param word - 检索关键字。
   * @param options - 检索选项。
   * @returns POI 结果集合。
   */
  poi(word: string, options?: PoiOptions): Promise<PoiResult[]> {
    return this.require("poi").poi(word, options)
  }

  /**
   * 执行地址地理编码。
   * @param address - 结构化地址。
   * @returns 地理编码结果集合。
   */
  geocode(address: string): Promise<GeocodeResult[]> {
    return this.require("geocode").geocode(address)
  }

  /**
   * 执行坐标逆地理编码。
   * @param position - 待解析坐标（WGS84）。
   * @returns 逆地理编码结果。
   */
  reverseGeocode(position: LngLat): Promise<ReverseGeocodeResult> {
    return this.require("reverseGeocode").reverseGeocode(position)
  }

  private require(action: string): WebServiceProvider {
    this.context.lifecycle.assertUsable(`use Web service (${action})`)
    if (!this.current) {
      throw new Arc3DError(
        "PROVIDER_UNAVAILABLE",
        `No Web service provider configured (${action})`,
      )
    }
    return this.current
  }
}
