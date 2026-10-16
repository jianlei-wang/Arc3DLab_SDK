import { describe, expect, it } from "vitest"
import {
  Arc3DError,
  ELLIPSOID_VERTICAL,
  WGS84,
  WEB_MERCATOR,
  assertGeographicPosition,
  assertTimeRange,
  createCoordinateTransform,
  describeDefaultShorthand,
  identityTransform,
  isGeographic,
  resolveSpatialReference,
  resolveVerticalReference,
  sameHorizontalReference,
  sameSpatialReference,
  sameVerticalReference,
  tryCreateCoordinateTransform,
  type SpatialReference,
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

  it("treats a linear unit difference as non-equivalent", () => {
    const feet: SpatialReference = { ...WGS84, linearUnit: "feet" }
    expect(sameSpatialReference(WGS84, feet)).toBe(false)
    expect(tryCreateCoordinateTransform(WGS84, feet)).toBeUndefined()
    const error = (() => {
      try {
        createCoordinateTransform(WGS84, feet)
      } catch (caught) {
        return caught
      }
      throw new Error("expected createCoordinateTransform to throw")
    })() as Arc3DError
    expect(error.code).toBe("UNSUPPORTED_CAPABILITY")
    expect(error.message).toMatch(/linear unit/)
  })

  it("compares horizontal and vertical references independently", () => {
    expect(
      sameHorizontalReference(WGS84, { ...WGS84, linearUnit: "feet" }),
    ).toBe(true)
    expect(
      sameHorizontalReference(WGS84, { ...WGS84, axisOrder: "lat-lng" }),
    ).toBe(false)
    expect(
      sameHorizontalReference(WGS84, { ...WGS84, angularUnit: "radians" }),
    ).toBe(false)
    expect(
      sameVerticalReference(ELLIPSOID_VERTICAL, { datum: "ellipsoid" }),
    ).toBe(true)
    expect(
      sameVerticalReference(ELLIPSOID_VERTICAL, {
        datum: "ellipsoid",
        linearUnit: "feet",
      }),
    ).toBe(false)
    expect(
      sameVerticalReference(ELLIPSOID_VERTICAL, { datum: "orthometric" }),
    ).toBe(false)
  })

  it("defaults the linear unit to meters when omitted", () => {
    expect(sameSpatialReference({ crs: "EPSG:4326" }, WGS84)).toBe(true)
    expect(
      sameSpatialReference(
        { crs: "EPSG:4326", linearUnit: "meters" },
        { crs: "EPSG:4326" },
      ),
    ).toBe(true)
  })

  it("returns an identity transform carrying the requested references", () => {
    const source: SpatialReference = {
      crs: "EPSG:4326",
      axisOrder: "lng-lat",
      angularUnit: "degrees",
      linearUnit: "meters",
    }
    const target: SpatialReference = { crs: "EPSG:4326" }
    const transform = tryCreateCoordinateTransform(source, target)
    expect(transform?.source).toBe(source)
    expect(transform?.target).toBe(target)
  })

  it("builds an explicit transform or throws for unsupported conversions", () => {
    const same = createCoordinateTransform(WGS84, WGS84)
    expect(same.forward({ longitude: 5, latitude: 6, height: 7 })).toEqual({
      longitude: 5,
      latitude: 6,
      height: 7,
    })
    const error = (() => {
      try {
        createCoordinateTransform(WGS84, WEB_MERCATOR)
      } catch (caught) {
        return caught
      }
      throw new Error("expected createCoordinateTransform to throw")
    })() as Arc3DError
    expect(error.code).toBe("UNSUPPORTED_CAPABILITY")
    expect(error.message).toContain("EPSG:4326")
    expect(error.message).toContain("EPSG:3857")
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
