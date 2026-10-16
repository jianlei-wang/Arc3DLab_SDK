import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  LifecycleManager,
  ToolRegistry,
  type Arc3DContext,
} from "@arc3dlab/core"
import {
  PLOT_SYMBOLS,
  PLOTTING_TOOL_NAME,
  PlottingManager,
  bowPoints,
  circlePoints,
  distanceMeters,
  doubleArrow,
  fineArrow,
  flagPoints,
  formationPoints,
  rectanglePoints,
  type PlotPoint,
} from "@arc3dlab/plotting"

const center: PlotPoint = [116.39, 39.9]
const east: PlotPoint = [116.4, 39.9]

function makeContext(options: { failOnAdd?: number } = {}): {
  manager: PlottingManager
  added: unknown[]
} {
  const added: unknown[] = []
  let addCount = 0
  const viewer = {
    entities: {
      add(entity: unknown): unknown {
        addCount += 1
        if (options.failOnAdd === addCount) {
          throw new Error("entity add failed")
        }
        added.push(entity)
        return entity
      },
      remove(entity: unknown): void {
        const index = added.indexOf(entity)
        if (index >= 0) added.splice(index, 1)
      },
    },
  }
  const context = {
    lifecycle: new LifecycleManager(),
    engine: { native: { viewer } },
    tools: new ToolRegistry(),
  } as unknown as Arc3DContext
  return { manager: new PlottingManager(context), added }
}

function captureError(run: () => unknown): Arc3DError {
  try {
    run()
  } catch (error) {
    return error as Arc3DError
  }
  throw new Error("expected function to throw")
}

describe("plotting geometry", () => {
  it("computes metric distance between nearby points", () => {
    const meters = distanceMeters(center, east)
    expect(meters).toBeGreaterThan(800)
    expect(meters).toBeLessThan(900)
  })

  it("builds a closed circle with radius invariant", () => {
    const edge: PlotPoint = [116.39, 39.9045]
    const radius = distanceMeters(center, edge)
    const ring = circlePoints(center, edge, 32)
    expect(ring).toHaveLength(33)
    const first = ring[0]!
    const last = ring[ring.length - 1]!
    expect(distanceMeters(first, last)).toBeLessThan(1)
    for (const point of ring.slice(0, 8)) {
      expect(distanceMeters(point, center)).toBeGreaterThan(radius * 0.9)
      expect(distanceMeters(point, center)).toBeLessThan(radius * 1.1)
    }
  })

  it("builds a rectangle with four corners", () => {
    const ring = rectanglePoints([116.38, 39.89], [116.4, 39.91])
    expect(ring).toEqual([
      [116.38, 39.89],
      [116.4, 39.89],
      [116.4, 39.91],
      [116.38, 39.91],
    ])
  })

  it("produces non-empty geometry for complex polygons and arrows", () => {
    expect(bowPoints([116.38, 39.9], [116.4, 39.9])).toHaveLength(90)
    expect(fineArrow(center, [116.4, 39.905])).toHaveLength(8)
    expect(
      doubleArrow([
        [116.38, 39.9],
        [116.39, 39.905],
        [116.4, 39.9],
      ]).length,
    ).toBeGreaterThan(0)
    expect(flagPoints([116.38, 39.9], [116.39, 39.905]).length).toBeGreaterThan(
      0,
    )
  })

  it("generates a formation layout", () => {
    expect(formationPoints(center, east, 0).length).toBeGreaterThanOrEqual(90)
    expect(formationPoints(center, east, 1).length).toBeGreaterThanOrEqual(90)
  })

  it("exposes the full symbol catalog", () => {
    expect(PLOT_SYMBOLS).toHaveLength(24)
  })
})

describe("PlottingManager", () => {
  it("draws point, polyline, polygon and arrow symbols", () => {
    const { manager, added } = makeContext()
    const point = manager.draw("point", {
      positions: [{ longitude: 116.39, latitude: 39.9 }],
    })
    const line = manager.draw("polyline", {
      positions: [
        { longitude: 116.38, latitude: 39.9 },
        { longitude: 116.4, latitude: 39.9 },
      ],
    })
    const polygon = manager.draw("polygon", {
      positions: [
        { longitude: 116.38, latitude: 39.89 },
        { longitude: 116.4, latitude: 39.89 },
        { longitude: 116.39, latitude: 39.91 },
      ],
    })
    const arrow = manager.draw("straightArrow", {
      positions: [
        { longitude: 116.39, latitude: 39.9 },
        { longitude: 116.4, latitude: 39.905 },
      ],
    })
    expect(point.shapes[0]?.kind).toBe("point")
    expect(line.shapes[0]?.kind).toBe("polyline")
    expect(polygon.shapes[0]?.kind).toBe("polygon")
    expect(arrow.shapes.length).toBeGreaterThan(0)
    expect(added).toHaveLength(
      point.shapes.length +
        line.shapes.length +
        polygon.shapes.length +
        arrow.shapes.length,
    )
    expect(manager.results).toHaveLength(4)
  })

  it("rejects drawings with insufficient anchors", () => {
    const { manager } = makeContext()
    expect(() => manager.draw("point", { positions: [] })).toThrow(
      /more anchor/,
    )
    expect(() =>
      manager.draw("curve", {
        positions: [{ longitude: 116.39, latitude: 39.9 }],
      }),
    ).toThrow(/more anchor/)
  })

  it("registers the drawing tool and tracks results", () => {
    const { manager } = makeContext()
    const drawn = manager.draw("point", {
      positions: [{ longitude: 116.39, latitude: 39.9 }],
    })
    expect(PLOTTING_TOOL_NAME).toBe("plotting.drawing")
    expect(manager.get(drawn.id)).toBe(drawn)
  })

  it("removes entities and results", () => {
    const { manager, added } = makeContext()
    const drawn = manager.draw("point", {
      positions: [{ longitude: 116.39, latitude: 39.9 }],
    })
    expect(added).toHaveLength(1)
    expect(manager.remove(drawn.id)).toBe(true)
    expect(added).toHaveLength(0)
    expect(manager.results).toHaveLength(0)
  })

  it("destroys cleanly", () => {
    const { manager } = makeContext()
    manager.draw("point", {
      positions: [{ longitude: 116.39, latitude: 39.9 }],
    })
    expect(() => manager.destroy()).not.toThrow()
    expect(manager.results).toHaveLength(0)
  })

  it("rejects a duplicate result id before creating entities", () => {
    const { manager, added } = makeContext()
    const first = manager.draw("point", {
      id: "alpha",
      positions: [{ longitude: 116.39, latitude: 39.9 }],
    })
    const entityCount = added.length
    const error = captureError(() =>
      manager.draw("point", {
        id: "alpha",
        positions: [{ longitude: 116.4, latitude: 39.91 }],
      }),
    )
    expect(error.code).toBe("DUPLICATE_RESOURCE")
    expect(added).toHaveLength(entityCount)
    expect(manager.get("alpha")).toBe(first)
    expect(manager.results).toHaveLength(1)
  })

  it("rejects an empty explicit result id", () => {
    const { manager, added } = makeContext()
    const error = captureError(() =>
      manager.draw("point", {
        id: "",
        positions: [{ longitude: 116.39, latitude: 39.9 }],
      }),
    )
    expect(error.code).toBe("INVALID_ARGUMENT")
    expect(added).toHaveLength(0)
    expect(manager.results).toHaveLength(0)
  })

  it("rolls back created entities when a later entity fails", () => {
    const { manager, added } = makeContext({ failOnAdd: 2 })
    expect(() =>
      manager.draw("circle", {
        positions: [
          { longitude: 116.39, latitude: 39.9 },
          { longitude: 116.4, latitude: 39.9 },
        ],
      }),
    ).toThrow(/entity add failed/)
    expect(added).toHaveLength(0)
    expect(manager.results).toHaveLength(0)
  })

  it("commits multi-shape results and removes them all", () => {
    const { manager, added } = makeContext()
    const circle = manager.draw("circle", {
      id: "ring",
      positions: [
        { longitude: 116.39, latitude: 39.9 },
        { longitude: 116.4, latitude: 39.9 },
      ],
    })
    const flag = manager.draw("flag", {
      positions: [
        { longitude: 116.38, latitude: 39.9 },
        { longitude: 116.39, latitude: 39.905 },
      ],
    })
    expect(circle.entities).toHaveLength(circle.shapes.length)
    expect(added).toHaveLength(circle.shapes.length + flag.shapes.length)
    expect(manager.results).toHaveLength(2)
    manager.removeAll()
    expect(added).toHaveLength(0)
    expect(manager.results).toHaveLength(0)
  })
})
