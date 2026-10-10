import { describe, expect, it } from "vitest"
import {
  WGS84,
  WEB_MERCATOR,
  assertGeographicPosition,
  assertTimeRange,
  describeDefaultShorthand,
  identityTransform,
  isGeographic,
  resolveSpatialReference,
  resolveVerticalReference,
  tryCreateCoordinateTransform,
} from "@arc3dlab/core"

describe("Spatial reference semantics", () => {
  it("defaults shorthand positions to WGS84 degrees", () => {
    expect(resolveSpatialReference()).toEqual(WGS84)
    expect(resolveSpatialReference({ crs: "EPSG:3857" })).toMatchObject({
      crs: "EPSG:3857",
      axisOrder: "lng-lat",
      angularUnit: "degrees",
      linearUnit: "meters",
    })
    expect(describeDefaultShorthand()).toContain("WGS84")
  })

  it("distinguishes geographic from projected references", () => {
    expect(isGeographic(WGS84)).toBe(true)
    expect(isGeographic(WEB_MERCATOR)).toBe(false)
    expect(() => assertGeographicPosition(WGS84, "measure")).not.toThrow()
    expect(() => assertGeographicPosition(WEB_MERCATOR, "measure")).toThrow(
      /projected/,
    )
  })

  it("only builds an identity transform for identical references", () => {
    const identity = tryCreateCoordinateTransform(WGS84, WGS84)
    expect(identity).toBeDefined()
    expect(identity?.forward({ longitude: 1, latitude: 2, height: 3 })).toEqual(
      {
        longitude: 1,
        latitude: 2,
        height: 3,
      },
    )
    expect(tryCreateCoordinateTransform(WGS84, WEB_MERCATOR)).toBeUndefined()
    const direct = identityTransform()
    expect(direct.source).toEqual(WGS84)
  })

  it("defaults vertical reference to the ellipsoid", () => {
    expect(resolveVerticalReference()).toMatchObject({
      datum: "ellipsoid",
      linearUnit: "meters",
    })
    expect(
      resolveVerticalReference({ datum: "orthometric", geoidModel: "EGM96" }),
    ).toMatchObject({ datum: "orthometric", geoidModel: "EGM96" })
  })

  it("validates ISO 8601 time ranges", () => {
    expect(() =>
      assertTimeRange(
        { start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" },
        "asset",
      ),
    ).not.toThrow()
    expect(() =>
      assertTimeRange(
        { start: "2024-01-02T00:00:00Z", end: "2024-01-01T00:00:00Z" },
        "asset",
      ),
    ).toThrow(/precedes/)
    expect(() =>
      assertTimeRange(
        { start: "not-a-date", end: "2024-01-01T00:00:00Z" },
        "asset",
      ),
    ).toThrow(/ISO 8601/)
  })
})
