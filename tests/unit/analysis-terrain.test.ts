import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { TerrainAnalysis, resolveTerrainSample } from "@arc3dlab/analysis"
import { Cartographic } from "cesium"

function terrain(
  heightAt: (longitude: number, latitude: number) => number,
): TerrainAnalysis {
  return new TerrainAnalysis({
    lifecycle: new LifecycleManager(),
    engine: {
      native: {
        viewer: {
          scene: {
            sampleHeightSupported: false,
            globe: {
              getHeight(carto: Cartographic) {
                return heightAt(
                  (carto.longitude * 180) / Math.PI,
                  (carto.latitude * 180) / Math.PI,
                )
              },
            },
          },
        },
      },
    },
  } as Arc3DContext)
}

describe("TerrainAnalysis", () => {
  it("samples globe height when sampleHeight is unavailable", async () => {
    const result = await terrain(() => 321).sampleHeight({
      position: [120, 30],
    })
    expect(result.height).toBe(321)
    expect(result.source).toBe("globe")
    expect(result.status).toBe("sampled")
    expect(result.longitude).toBeCloseTo(120, 5)
    expect(result.latitude).toBeCloseTo(30, 5)
  })

  it("falls back to ellipsoid height when globe has no data", async () => {
    const analysis = new TerrainAnalysis({
      lifecycle: new LifecycleManager(),
      engine: {
        native: {
          viewer: {
            scene: {
              sampleHeightSupported: false,
              globe: {
                getHeight() {
                  return undefined
                },
              },
            },
          },
        },
      },
    } as Arc3DContext)
    const result = await analysis.sampleHeight({ position: [120, 30] })
    expect(result.height).toBe(0)
    expect(result.source).toBe("ellipsoid")
    expect(result.status).toBe("unavailable")
  })

  it("prefers sampleHeightMostDetailed over globe", async () => {
    const analysis = new TerrainAnalysis({
      lifecycle: new LifecycleManager(),
      engine: {
        native: {
          viewer: {
            scene: {
              sampleHeightSupported: true,
              async sampleHeightMostDetailed(cartos: Cartographic[]) {
                return cartos.map((item) => {
                  const next = item.clone()
                  next.height = 88
                  return next
                })
              },
              globe: {
                getHeight() {
                  return 1
                },
              },
            },
          },
        },
      },
    } as Arc3DContext)
    const result = await analysis.sampleHeight({ position: [104, 30] })
    expect(result.height).toBe(88)
    expect(result.source).toBe("sampleHeight")
    expect(result.status).toBe("sampled")
  })

  it("cancels sampling when the signal is aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      terrain(() => 10).sampleHeight({
        position: [120, 30],
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "CANCELLED" })
  })

  it("returns near-zero slope on a horizontal plane", async () => {
    const result = await terrain(() => 140).slope({
      position: [120, 30],
      sampleMeters: 20,
    })
    expect(result.slopeDegrees).toBeCloseTo(0, 5)
  })

  it("returns a monotonic profile along two points", async () => {
    const result = await terrain(() => 12).profile({
      positions: [
        [120, 30],
        [120.2, 30],
      ],
      samples: 5,
    })
    expect(result.points).toHaveLength(5)
    expect(result.points[0].distance).toBe(0)
    expect(result.points[4].distance).toBeGreaterThan(result.points[1].distance)
    expect(result.points.every((point) => point.height === 12)).toBe(true)
  })

  it("computes a west-facing slope from east-high samples", async () => {
    const analysis = terrain((longitude) => longitude * 1e6)
    const result = await analysis.slope({
      position: [120, 30],
      sampleMeters: 20,
    })
    expect(result.slopeDegrees).toBeGreaterThan(80)
    expect(result.aspectDegrees).toBeGreaterThan(240)
    expect(result.aspectDegrees).toBeLessThan(300)
  })

  it("writes vertical exaggeration onto the scene", () => {
    const scene = {
      verticalExaggeration: 1,
      sampleHeightSupported: false,
      globe: { getHeight: () => 0 },
    }
    const analysis = new TerrainAnalysis({
      lifecycle: new LifecycleManager(),
      engine: { native: { viewer: { scene } } },
    } as Arc3DContext)
    analysis.setExaggeration(2.5)
    expect(analysis.getExaggeration()).toBe(2.5)
    expect(scene.verticalExaggeration).toBe(2.5)
  })
})

describe("resolveTerrainSample", () => {
  it("classifies detailed, globe fallback, and ellipsoid unavailable", () => {
    expect(
      resolveTerrainSample({
        sampleHeightSupported: true,
        detailedHeight: 12,
        globeHeight: 3,
      }),
    ).toEqual({ height: 12, source: "sampleHeight", status: "sampled" })
    expect(
      resolveTerrainSample({
        sampleHeightSupported: true,
        detailedHeight: null,
        globeHeight: 3,
      }),
    ).toEqual({ height: 3, source: "globe", status: "fallback" })
    expect(
      resolveTerrainSample({
        sampleHeightSupported: false,
        globeHeight: undefined,
      }),
    ).toEqual({ height: 0, source: "ellipsoid", status: "unavailable" })
  })
})
