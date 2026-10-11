import { describe, expect, it } from "vitest"
import {
  bd09ToGcj02,
  bd09ToWgs84,
  gcj02ToBd09,
  gcj02ToWgs84,
  outOfChina,
  wgs84ToBd09,
  wgs84ToGcj02,
} from "../../packages/core/src/datum"

describe("outOfChina", () => {
  it("is true outside the China bounding box", () => {
    expect(outOfChina(0, 0)).toBe(true)
    expect(outOfChina(120, 30)).toBe(false)
  })
})

describe("GCJ-02 conversion", () => {
  const lng = 116.397
  const lat = 39.909

  it("shifts coordinates inside China", () => {
    const gcj = wgs84ToGcj02(lng, lat)
    expect(gcj.longitude).not.toBeCloseTo(lng, 6)
    expect(gcj.latitude).not.toBeCloseTo(lat, 6)
  })

  it("round-trips WGS84 to GCJ-02 within tolerance", () => {
    const gcj = wgs84ToGcj02(lng, lat)
    const back = gcj02ToWgs84(gcj.longitude, gcj.latitude)
    expect(back.longitude).toBeCloseTo(lng, 5)
    expect(back.latitude).toBeCloseTo(lat, 5)
  })

  it("passes through coordinates outside China", () => {
    const gcj = wgs84ToGcj02(0, 0)
    expect(gcj).toEqual({ longitude: 0, latitude: 0 })
  })
})

describe("BD-09 conversion", () => {
  const lng = 116.397
  const lat = 39.909

  it("round-trips GCJ-02 to BD-09", () => {
    const bd = gcj02ToBd09(lng, lat)
    const back = bd09ToGcj02(bd.longitude, bd.latitude)
    expect(back.longitude).toBeCloseTo(lng, 5)
    expect(back.latitude).toBeCloseTo(lat, 5)
  })

  it("round-trips WGS84 to BD-09", () => {
    const bd = wgs84ToBd09(lng, lat)
    const back = bd09ToWgs84(bd.longitude, bd.latitude)
    expect(back.longitude).toBeCloseTo(lng, 4)
    expect(back.latitude).toBeCloseTo(lat, 4)
  })
})
