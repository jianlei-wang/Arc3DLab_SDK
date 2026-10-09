import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import { VisibilityAnalysis } from "@arc3dlab/analysis"
import { Cartographic } from "cesium"

function visibility(heightAt: (longitude: number, latitude: number) => number): VisibilityAnalysis {
  return new VisibilityAnalysis({
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
                  (carto.latitude * 180) / Math.PI
                )
              },
            },
          },
        },
      },
    },
  } as Arc3DContext)
}

describe("VisibilityAnalysis", () => {
  it("reports a clear line of sight over flat terrain", async () => {
    const result = await visibility(() => 0).lineOfSight({
      from: [120, 30, 20],
      to: [120.02, 30, 20],
      samples: 8,
    })
    expect(result.visible).toBe(true)
    expect(result.samples).toHaveLength(8)
  })

  it("detects a ridge that blocks the sight line", async () => {
    const result = await visibility((longitude) => (longitude > 120.008 && longitude < 120.012 ? 80 : 0)).lineOfSight({
      from: [120, 30, 10],
      to: [120.02, 30, 10],
      samples: 16,
    })
    expect(result.visible).toBe(false)
    expect(result.occludedIndex).toBeGreaterThan(0)
  })

  it("returns radial viewshed rays on flat terrain", async () => {
    const result = await visibility(() => 0).viewshed({
      observer: [120, 30],
      radius: 500,
      rays: 8,
      observerHeight: 2,
      samples: 6,
    })
    expect(result.rayCount).toBe(8)
    expect(result.visibleCount).toBe(8)
    expect(result.rays.every((ray) => ray.rangeMeters === 500)).toBe(true)
  })

  it("shortens rangeMeters when a ridge occludes a ray", async () => {
    const result = await visibility((longitude) => (longitude > 120.002 ? 80 : 0)).viewshed({
      observer: [120, 30],
      radius: 500,
      rays: 4,
      observerHeight: 2,
      samples: 8,
    })
    const east = result.rays.find((ray) => ray.heading === 90)
    expect(east?.visible).toBe(false)
    expect(east?.rangeMeters).toBeGreaterThan(0)
    expect(east?.rangeMeters).toBeLessThan(500)
  })

  it("draws a ground primitive when draw is true", async () => {
    const primitives: { items: unknown[]; add(item: unknown): unknown; remove(item: unknown): void } = {
      items: [],
      add(item) {
        this.items.push(item)
        return item
      },
      remove(item) {
        this.items = this.items.filter((entry) => entry !== item)
      },
    }
    const analysis = new VisibilityAnalysis({
      lifecycle: new LifecycleManager(),
      engine: {
        native: {
          viewer: {
            scene: {
              sampleHeightSupported: false,
              primitives,
              globe: {
                getHeight() {
                  return 0
                },
              },
            },
          },
        },
      },
    } as Arc3DContext)
    await analysis.viewshed({
      observer: [120, 30],
      radius: 400,
      rays: 8,
      draw: true,
      samples: 4,
    })
    expect(primitives.items).toHaveLength(1)
    analysis.clearOverlay()
    expect(primitives.items).toHaveLength(0)
  })
})
