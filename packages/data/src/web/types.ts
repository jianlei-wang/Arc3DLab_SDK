import type { LngLat } from "@arc3dlab/core"

/** 驾车路径规划中的路况分段。 */
export interface TmcSegment {
  /** 分段折线坐标（WGS84）。 */
  polyline: LngLat[]
  /** 分段距离（米）。 */
  distance: number
  /** 分段路况状态码。 */
  status?: string
}

/** 驾车路径规划中的单个导航段。 */
export interface RouteStep {
  /** 该段的预计耗时（秒）。 */
  duration: number
  /** 该段的行驶距离（米）。 */
  distance: number
  /** 导航提示文本。 */
  instruction: string
  /** 进入该段时的方向。 */
  orientation?: string
  /** 道路名称。 */
  roadName?: string
  /** 路况分段集合。 */
  tmcs: TmcSegment[]
}

/** 一条完整的驾车路径。 */
export interface RouteResult {
  /** 路径总距离（米）。 */
  distance: number
  /** 路径总耗时（秒）。 */
  duration: number
  /** 导航段集合。 */
  steps: RouteStep[]
}

/** 驾车路径规划结果。 */
export interface DrivingResult {
  /** 起点（WGS84）。 */
  origin: LngLat
  /** 终点（WGS84）。 */
  destination: LngLat
  /** 候选路径集合。 */
  paths: RouteResult[]
}

/** POI 检索结果。 */
export interface PoiResult {
  /** POI 名称。 */
  name: string
  /** POI 类型。 */
  type: string
  /** 所在省份。 */
  province: string
  /** 所在城市。 */
  city: string
  /** 所在区县。 */
  district: string
  /** 详细地址。 */
  address: string
  /** POI 坐标（WGS84）。 */
  location: LngLat
}

/** 地理编码结果。 */
export interface GeocodeResult {
  /** 省份。 */
  province: string
  /** 城市。 */
  city: string
  /** 区县。 */
  district: string
  /** 街道。 */
  street: string
  /** 门牌号。 */
  number: string
  /** 坐标（WGS84）。 */
  location: LngLat
}

/** 逆地理编码结果。 */
export interface ReverseGeocodeResult {
  /** 省份。 */
  province: string
  /** 城市。 */
  city: string
  /** 区县。 */
  district: string
  /** 乡镇或街道。 */
  township: string
  /** 格式化地址。 */
  address: string
}

/** POI 检索选项。 */
export interface PoiOptions {
  /** 限定检索的城市或区域名称。 */
  region?: string
  /** 期望返回的结果数量上限。 */
  count?: number
}

/** 可注入的 Web 数据服务提供者。 */
export interface WebServiceProvider {
  /**
   * 执行驾车路径规划。
   * @param origin - 起点（WGS84）。
   * @param destination - 终点（WGS84）。
   * @returns 含路况分段的路径规划结果。
   */
  driving(origin: LngLat, destination: LngLat): Promise<DrivingResult>

  /**
   * 执行关键字 POI 检索。
   * @param word - 检索关键字。
   * @param options - 检索选项。
   * @returns POI 结果集合。
   */
  poi(word: string, options?: PoiOptions): Promise<PoiResult[]>

  /**
   * 执行地址地理编码。
   * @param address - 结构化地址。
   * @returns 地理编码结果集合。
   */
  geocode(address: string): Promise<GeocodeResult[]>

  /**
   * 执行坐标逆地理编码。
   * @param position - 待解析坐标（WGS84）。
   * @returns 逆地理编码结果。
   */
  reverseGeocode(position: LngLat): Promise<ReverseGeocodeResult>
}
