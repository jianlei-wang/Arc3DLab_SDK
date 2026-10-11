import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  gcj02ToWgs84,
  LifecycleManager,
  wgs84ToGcj02,
  type Arc3DContext,
} from "@arc3dlab/core"
import {
  createGaodeProvider,
  WebServiceManager,
  type GaodeFetch,
} from "@arc3dlab/data"

function response(payload: unknown): {
  status: number
  json(): Promise<unknown>
} {
  return { status: 200, json: async () => payload }
}

function captureCode(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return (error as Arc3DError).code
  }
  throw new Error("expected function to throw")
}

describe("createGaodeProvider credentials", () => {
  it("rejects a missing key with MISSING_CREDENTIALS", () => {
    const code = captureCode(() =>
      createGaodeProvider({ key: "  ", fetch: async () => response({}) }),
    )
    expect(code).toBe("MISSING_CREDENTIALS")
  })

  it("reports PROVIDER_UNAVAILABLE when no fetch is available", () => {
    const scope = globalThis as { fetch?: unknown }
    const original = scope.fetch
    scope.fetch = undefined
    try {
      const code = captureCode(() => createGaodeProvider({ key: "abc" }))
      expect(code).toBe("PROVIDER_UNAVAILABLE")
    } finally {
      scope.fetch = original
    }
  })
})

describe("createGaodeProvider.driving", () => {
  it("converts WGS84 input to GCJ-02 and parses route with tmcs", async () => {
    const urls: string[] = []
    const fetchImpl: GaodeFetch = async (url) => {
      urls.push(url)
      return response({
        status: "1",
        route: {
          paths: [
            {
              distance: "1200",
              cost: { duration: "90" },
              steps: [
                {
                  cost: { duration: "90" },
                  step_distance: "1200",
                  instruction: "直行",
                  orientation: "N",
                  road_name: "示例路",
                  tmcs: [
                    {
                      tmc_polyline: "116.400000,39.900000;116.410000,39.910000",
                      tmc_distance: "1200",
                      tmc_status: "1",
                    },
                  ],
                },
              ],
            },
          ],
        },
      })
    }
    const provider = createGaodeProvider({ key: "unit-key", fetch: fetchImpl })
    const origin = { longitude: 116.397, latitude: 39.908 }
    const destination = { longitude: 116.41, latitude: 39.92 }
    const result = await provider.driving(origin, destination)

    const gcj = wgs84ToGcj02(origin.longitude, origin.latitude)
    expect(urls[0]).toContain("key=unit-key")
    expect(urls[0]).toContain(
      `origin=${gcj.longitude.toFixed(6)}%2C${gcj.latitude.toFixed(6)}`,
    )
    expect(result.origin).toEqual(origin)
    expect(result.destination).toEqual(destination)
    expect(result.paths[0].distance).toBe(1200)
    expect(result.paths[0].duration).toBe(90)
    const segment = result.paths[0].steps[0].tmcs[0]
    expect(segment.polyline).toHaveLength(2)
    expect(segment.polyline[0]).toEqual(gcj02ToWgs84(116.4, 39.9))
    expect(segment.status).toBe("1")
    expect(result.paths[0].steps[0].instruction).toBe("直行")
  })

  it("throws NETWORK_FAILURE when the service rejects", async () => {
    const provider = createGaodeProvider({
      key: "k",
      fetch: async () => response({ status: "0", info: "INVALID" }),
    })
    await expect(
      provider.driving(
        { longitude: 116, latitude: 39 },
        { longitude: 117, latitude: 40 },
      ),
    ).rejects.toMatchObject({ code: "NETWORK_FAILURE" })
  })
})

describe("createGaodeProvider queries", () => {
  it("parses POI results into WGS84", async () => {
    const urls: string[] = []
    const provider = createGaodeProvider({
      key: "k",
      fetch: async (url) => {
        urls.push(url)
        return response({
          status: "1",
          pois: [
            {
              name: "天安门",
              type: "风景",
              pname: "北京市",
              cityname: "北京市",
              adname: "东城区",
              address: "长安街",
              location: "116.400000,39.900000",
            },
          ],
        })
      },
    })
    const result = await provider.poi("天安门", { region: "北京", count: 5 })
    expect(urls[0]).toContain("keywords=%E5%A4%A9%E5%AE%89%E9%97%A8")
    expect(urls[0]).toContain("region=%E5%8C%97%E4%BA%AC")
    expect(urls[0]).toContain("page_size=5")
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("天安门")
    expect(result[0].location).toEqual(gcj02ToWgs84(116.4, 39.9))
  })

  it("parses geocode and reverse geocode results", async () => {
    const provider = createGaodeProvider({
      key: "k",
      fetch: async (url) => {
        if (url.includes("/geo?")) {
          return response({
            status: "1",
            geocodes: [
              {
                province: "北京市",
                city: "北京市",
                district: "东城区",
                street: "长安街",
                number: "1",
                location: "116.400000,39.900000",
              },
            ],
          })
        }
        return response({
          status: "1",
          regeocode: {
            formatted_address: "北京市东城区",
            addressComponent: {
              province: "北京市",
              city: "北京市",
              district: "东城区",
              township: "东华门街道",
            },
          },
        })
      },
    })
    const geocodes = await provider.geocode("北京市东城区")
    expect(geocodes[0].district).toBe("东城区")
    expect(geocodes[0].location).toEqual(gcj02ToWgs84(116.4, 39.9))

    const reverse = await provider.reverseGeocode({
      longitude: 116.397,
      latitude: 39.908,
    })
    expect(reverse.township).toBe("东华门街道")
    expect(reverse.address).toBe("北京市东城区")
  })
})

describe("WebServiceManager", () => {
  function makeManager(): WebServiceManager {
    const context = { lifecycle: new LifecycleManager() } as Arc3DContext
    return new WebServiceManager(context)
  }

  it("throws PROVIDER_UNAVAILABLE when no provider is configured", () => {
    const manager = makeManager()
    expect(manager.provider).toBeUndefined()
    const code = captureCode(() =>
      manager.driving(
        { longitude: 116, latitude: 39 },
        { longitude: 117, latitude: 40 },
      ),
    )
    expect(code).toBe("PROVIDER_UNAVAILABLE")
  })

  it("delegates to the injected provider", async () => {
    const manager = makeManager()
    manager.setProvider({
      driving: async (origin, destination) => ({
        origin,
        destination,
        paths: [],
      }),
      poi: async () => [],
      geocode: async () => [],
      reverseGeocode: async () => ({
        province: "",
        city: "",
        district: "",
        township: "",
        address: "",
      }),
    })
    expect(manager.provider).toBeDefined()
    const result = await manager.driving(
      { longitude: 1, latitude: 2 },
      { longitude: 3, latitude: 4 },
    )
    expect(result.paths).toEqual([])
    manager.setProvider(undefined)
    expect(manager.provider).toBeUndefined()
  })
})
