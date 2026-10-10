import { describe, expect, it } from "vitest"
import {
  LifecycleManager,
  ResourceRegistry,
  type Arc3DContext,
} from "@arc3dlab/core"
import {
  AnalysisManager,
  SpatialQueryService,
  TerrainAnalysis,
} from "@arc3dlab/analysis"
import { Cartographic } from "cesium"

function baseContext(extra: Record<string, unknown> = {}): Arc3DContext {
  return {
    lifecycle: new LifecycleManager(),
    registry: new ResourceRegistry(),
    events: { emit() {} },
    ...extra,
  } as unknown as Arc3DContext
}

function terrainContext(
  heightAt: (longitude: number, latitude: number) => number,
): Arc3DContext {
  return baseContext({
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
  })
}

describe("analysis task variants", () => {
  it("routes measurement and query through the shared task registry", async () => {
    const manager = new AnalysisManager(baseContext())

    const distance = await manager.measure.distanceTask({
      positions: [
        [120, 30],
        [120.01, 30],
      ],
    })
    expect(distance.status).toBe("succeeded")
    expect(distance.algorithm).toBe("measure.distance")
    expect(distance.units?.length).toBe("m")
    expect(distance.value?.meters ?? 0).toBeGreaterThan(0)
    expect(distance.spatialReference).toBeDefined()
    expect(manager.tasks.get(distance.taskId)?.status).toBe("succeeded")

    const query = await manager.query.rectangleTask({
      west: 120,
      south: 30,
      east: 121,
      north: 31,
    })
    expect(query.status).toBe("succeeded")
    expect(query.algorithm).toBe("query.rectangle")
    expect(query.value?.graphics).toEqual([])
    expect(manager.tasks.get(query.taskId)?.status).toBe("succeeded")
  })

  it("exposes terrain sampling state on the unified result", async () => {
    const terrain = new TerrainAnalysis(terrainContext(() => 42))
    const result = await terrain.sampleHeightTask({ position: [120, 30] })

    expect(result.status).toBe("succeeded")
    expect(result.algorithm).toBe("terrain.sampleHeight")
    expect(result.units?.length).toBe("m")
    expect(result.value?.height).toBeCloseTo(42, 5)
    expect(result.value?.status).toBeDefined()
    expect(result.verticalReference).toBeDefined()
  })

  it("returns a zeroed volume result without needing a viewer", async () => {
    const manager = new AnalysisManager(baseContext())
    const result = await manager.volume.cutFillTask({
      positions: [
        [120, 30],
        [120.01, 30],
      ],
    })
    expect(result.status).toBe("succeeded")
    expect(result.algorithm).toBe("volume.cutFill")
    expect(result.value?.sampleCount).toBe(0)
    expect(result.units?.volume).toBe("m3")
  })

  it("maps an aborted signal to a cancelled task", async () => {
    const manager = new AnalysisManager(baseContext())
    const controller = new AbortController()
    controller.abort()
    const result = await manager.volume.cutFillTask({
      positions: [[120, 30]],
      signal: controller.signal,
    })
    expect(result.status).toBe("cancelled")
    expect(result.error?.code).toBe("CANCELLED")
  })

  it("keeps a standalone query service task-capable", async () => {
    const query = new SpatialQueryService(baseContext())
    const result = await query.distanceTask({
      position: [120, 30],
      meters: 500,
    })
    expect(result.status).toBe("succeeded")
    expect(result.value?.graphics).toEqual([])
  })
})
