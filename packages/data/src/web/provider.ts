import {
  Arc3DError,
  gcj02ToWgs84,
  wgs84ToGcj02,
  type LngLat,
} from "@arc3dlab/core"
import type {
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

/** 高德开放平台默认服务基地址。 */
const GAODE_ENDPOINT = "https://restapi.amap.com/"

/** 高德 Web 服务返回的 JSON 响应。 */
export interface GaodeResponse {
  /** HTTP 状态码。 */
  status?: number
  /** 响应正文的 JSON 解析函数。 */
  json(): Promise<unknown>
}

/** 最小化的 fetch 抽象，便于注入与测试。 */
export type GaodeFetch = (url: string) => Promise<GaodeResponse>

/** 构造高德 Web 服务提供者的选项。 */
export interface GaodeProviderOptions {
  /** 高德 Web 服务 Key；缺失时构造会抛出 `MISSING_CREDENTIALS`。 */
  key: string
  /** 自定义 fetch 实现，缺省时使用全局 fetch。 */
  fetch?: GaodeFetch
  /** 服务基地址，缺省为高德开放平台。 */
  endpoint?: string
}

interface GaodePayload {
  status?: string
  info?: string
  [key: string]: unknown
}

/**
 * 解析高德返回的 `lng,lat` 坐标字符串并转换为 WGS84。
 * @param value - 高德返回的坐标字符串。
 * @returns WGS84 坐标。
 * @throws {Arc3DError} 当坐标字符串格式非法时抛出，错误码为 `INVALID_FORMAT`。
 */
function parseGcjPoint(value: unknown): LngLat {
  if (typeof value !== "string" || !value.includes(",")) {
    throw new Arc3DError(
      "INVALID_FORMAT",
      `Invalid Gaode coordinate: ${String(value)}`,
    )
  }
  const [lng, lat] = value.split(",")
  return gcj02ToWgs84(Number(lng), Number(lat))
}

/**
 * 解析高德返回的分号分隔折线并转换为 WGS84。
 * @param value - 高德返回的折线字符串。
 * @returns WGS84 坐标数组。
 */
function parseGcjPolyline(value: unknown): LngLat[] {
  if (typeof value !== "string" || value.length === 0) return []
  return value
    .split(";")
    .filter((item) => item.length > 0)
    .map((item) => parseGcjPoint(item))
}

/**
 * 创建基于高德开放平台的 Web 数据服务提供者。
 *
 * 所有对外坐标均以 WGS84 表达，内部按高德要求完成 GCJ-02 与 WGS84 的互转；
 * 凭据与 fetch 均通过参数注入，不读取任何环境变量。
 *
 * @param options - 提供者选项，包含 Key 与可选的 fetch 实现。
 * @returns Web 服务提供者实例。
 * @throws {Arc3DError} 未提供 Key 时抛出 `MISSING_CREDENTIALS`；无可用 fetch 时抛出 `PROVIDER_UNAVAILABLE`。
 */
export function createGaodeProvider(
  options: GaodeProviderOptions,
): WebServiceProvider {
  const key = options.key?.trim()
  if (!key) {
    throw new Arc3DError(
      "MISSING_CREDENTIALS",
      "Gaode Web service key is required",
    )
  }
  const endpoint = options.endpoint ?? GAODE_ENDPOINT
  const fetchImpl =
    options.fetch ?? (globalThis.fetch as unknown as GaodeFetch | undefined)
  if (!fetchImpl) {
    throw new Arc3DError(
      "PROVIDER_UNAVAILABLE",
      "No fetch implementation available for Gaode provider",
    )
  }

  const request = async (
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<GaodePayload> => {
    const query = new URLSearchParams()
    query.set("key", key)
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) query.set(name, String(value))
    }
    const url = `${endpoint}${path}?${query.toString()}`
    let response: GaodeResponse
    try {
      response = await fetchImpl(url)
    } catch (error) {
      throw new Arc3DError(
        "NETWORK_FAILURE",
        `Gaode request failed: ${path}`,
        error,
      )
    }
    if (response.status !== undefined && response.status !== 200) {
      throw new Arc3DError(
        "NETWORK_FAILURE",
        `Gaode request failed with status ${response.status}`,
      )
    }
    const payload = (await response.json()) as GaodePayload
    if (payload.status !== undefined && payload.status !== "1") {
      throw new Arc3DError(
        "NETWORK_FAILURE",
        `Gaode response error: ${payload.info ?? payload.status}`,
      )
    }
    return payload
  }

  return {
    async driving(origin, destination): Promise<DrivingResult> {
      const gcjOrigin = wgs84ToGcj02(origin.longitude, origin.latitude)
      const gcjDestination = wgs84ToGcj02(
        destination.longitude,
        destination.latitude,
      )
      const payload = await request("v5/direction/driving", {
        show_fields: "cost,tmcs",
        origin: `${gcjOrigin.longitude.toFixed(6)},${gcjOrigin.latitude.toFixed(6)}`,
        destination: `${gcjDestination.longitude.toFixed(6)},${gcjDestination.latitude.toFixed(6)}`,
      })
      const route = payload.route as { paths?: unknown[] } | undefined
      const rawPaths = (route?.paths ?? []) as Array<Record<string, unknown>>
      const paths: RouteResult[] = rawPaths.map((path) => {
        const cost = path.cost as { duration?: unknown } | undefined
        const rawSteps = (path.steps ?? []) as Array<Record<string, unknown>>
        const steps: RouteStep[] = rawSteps.map((step) => {
          const stepCost = step.cost as { duration?: unknown } | undefined
          const rawTmcs = (step.tmcs ?? []) as Array<Record<string, unknown>>
          const tmcs: TmcSegment[] = rawTmcs.map((tmc) => ({
            polyline: parseGcjPolyline(tmc.tmc_polyline),
            distance: Number(tmc.tmc_distance ?? 0),
            status: tmc.tmc_status ? String(tmc.tmc_status) : undefined,
          }))
          return {
            duration: Number(stepCost?.duration ?? 0),
            distance: Number(step.step_distance ?? 0),
            instruction: String(step.instruction ?? ""),
            orientation: step.orientation
              ? String(step.orientation)
              : undefined,
            roadName: step.road_name ? String(step.road_name) : undefined,
            tmcs,
          }
        })
        return {
          distance: Number(path.distance ?? 0),
          duration: Number(cost?.duration ?? 0),
          steps,
        }
      })
      return { origin, destination, paths }
    },

    async poi(word, options: PoiOptions = {}): Promise<PoiResult[]> {
      const payload = await request("v5/place/text", {
        keywords: word,
        region: options.region,
        city_limit: options.region ? "true" : "false",
        page_size: options.count ?? 20,
      })
      const rawPois = (payload.pois ?? []) as Array<Record<string, unknown>>
      return rawPois.map((poi) => ({
        name: String(poi.name ?? ""),
        type: String(poi.type ?? ""),
        province: String(poi.pname ?? ""),
        city: String(poi.cityname ?? ""),
        district: String(poi.adname ?? ""),
        address: String(poi.address ?? ""),
        location: parseGcjPoint(poi.location),
      }))
    },

    async geocode(address): Promise<GeocodeResult[]> {
      const payload = await request("v3/geocode/geo", { address })
      const rawGeocodes = (payload.geocodes ?? []) as Array<
        Record<string, unknown>
      >
      return rawGeocodes.map((geocode) => ({
        province: String(geocode.province ?? ""),
        city: String(geocode.city ?? ""),
        district: String(geocode.district ?? ""),
        street: String(geocode.street ?? ""),
        number: String(geocode.number ?? ""),
        location: parseGcjPoint(geocode.location),
      }))
    },

    async reverseGeocode(position): Promise<ReverseGeocodeResult> {
      const gcj = wgs84ToGcj02(position.longitude, position.latitude)
      const payload = await request("v3/geocode/regeo", {
        location: `${gcj.longitude},${gcj.latitude}`,
        extensions: "all",
        roadlevel: 1,
      })
      const regeo = (payload.regeocode ?? {}) as Record<string, unknown>
      const component = (regeo.addressComponent ?? {}) as Record<
        string,
        unknown
      >
      return {
        province: String(component.province ?? ""),
        city: String(component.city ?? ""),
        district: String(component.district ?? ""),
        township: String(component.township ?? ""),
        address: String(regeo.formatted_address ?? ""),
      }
    },
  }
}
