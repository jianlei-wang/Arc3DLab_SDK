import { describe, expect, it } from "vitest"
import { LifecycleManager, ResourceRegistry, type Arc3DContext, type ResourceHandle } from "@arc3dlab/core"
import { SpatialQueryService } from "@arc3dlab/analysis"

function graphic(id: string, type: string, positions: { longitude: number; latitude: number; height: number }[]): ResourceHandle {
  return {
    id,
    type,
    native: {},
    visible: true,
    owned: false,
    positions,
    destroy() {
      return undefined
    },
  } as ResourceHandle
}

function service(items: ResourceHandle[]): SpatialQueryService {
  const registry = new ResourceRegistry()
  for (const item of items) registry.add(item)
  return new SpatialQueryService({
    lifecycle: new LifecycleManager(),
    registry,
  } as Arc3DContext)
}

describe("SpatialQueryService", () => {
  it("selects graphics inside a rectangle", async () => {
    const query = service([
      graphic("in", "point", [{ longitude: 120.1, latitude: 30.1, height: 0 }]),
      graphic("out", "point", [{ longitude: 121.5, latitude: 31.5, height: 0 }]),
    ])
    const result = await query.rectangle({ west: 120, south: 30, east: 120.5, north: 30.5 })
    expect(result.graphics.map((item) => item.id)).toEqual(["in"])
  })

  it("selects graphics inside a polygon", async () => {
    const query = service([
      graphic("poly-hit", "polygon", [{ longitude: 120.05, latitude: 30.05, height: 0 }]),
      graphic("poly-miss", "polygon", [{ longitude: 122, latitude: 32, height: 0 }]),
    ])
    const result = await query.polygon({
      positions: [
        [120, 30],
        [120.2, 30],
        [120.2, 30.2],
        [120, 30.2],
      ],
    })
    expect(result.graphics.map((item) => item.id)).toEqual(["poly-hit"])
  })

  it("selects graphics within a distance", async () => {
    const query = service([
      graphic("near", "point", [{ longitude: 120.001, latitude: 30, height: 0 }]),
      graphic("far", "point", [{ longitude: 121, latitude: 31, height: 0 }]),
    ])
    const result = await query.distance({ position: [120, 30], meters: 500 })
    expect(result.graphics.map((item) => item.id)).toEqual(["near"])
  })

  it("selects a polyline that crosses a rectangle", async () => {
    const query = service([
      graphic("cross", "polyline", [
        { longitude: 119.9, latitude: 30.1, height: 0 },
        { longitude: 120.3, latitude: 30.1, height: 0 },
      ]),
    ])
    const result = await query.rectangle({ west: 120, south: 30, east: 120.2, north: 30.2 })
    expect(result.graphics.map((item) => item.id)).toEqual(["cross"])
  })

  it("keeps crossing polylines out of within queries", async () => {
    const query = service([
      graphic("cross", "polyline", [
        { longitude: 119.9, latitude: 30.1, height: 0 },
        { longitude: 120.3, latitude: 30.1, height: 0 },
      ]),
    ])
    const result = await query.rectangle({
      west: 120,
      south: 30,
      east: 120.2,
      north: 30.2,
      relation: "within",
    })
    expect(result.graphics).toEqual([])
  })

  it("selects graphics across the antimeridian", async () => {
    const query = service([
      graphic("wrap", "point", [{ longitude: 179, latitude: 0.5, height: 0 }]),
      graphic("other", "point", [{ longitude: 0, latitude: 0.5, height: 0 }]),
    ])
    const result = await query.rectangle({ west: 170, south: 0, east: -170, north: 1 })
    expect(result.graphics.map((item) => item.id)).toEqual(["wrap"])
  })

  it("selects a polyline by distance to the segment", async () => {
    const query = service([
      graphic("seg", "polyline", [
        { longitude: 119.9, latitude: 30, height: 0 },
        { longitude: 120.1, latitude: 30, height: 0 },
      ]),
    ])
    const result = await query.distance({ position: [120, 30.0005], meters: 200 })
    expect(result.graphics.map((item) => item.id)).toEqual(["seg"])
  })
})
