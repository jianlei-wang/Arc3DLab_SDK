import { describe, expect, it } from "vitest"
import { LifecycleManager, type Arc3DContext } from "@arc3dlab/core"
import {
  MeasurementService,
  accumulateCutFillWeighted,
  buildCutFillGrid,
  cartesianDistanceMeters,
  geodesicDistanceMeters,
  polygonAreaSquareMeters,
  resolveTerrainSample,
  splitRectAtAntimeridian,
} from "@arc3dlab/analysis"
import {
  estimateCutFillError,
  type CutFillCell,
} from "../../packages/analysis/src/cutfill"
import { fromLocalMeters } from "../../packages/analysis/src/geometry"
import { WGS84_A } from "../../packages/analysis/src/units"

function measure(): MeasurementService {
  return new MeasurementService({
    lifecycle: new LifecycleManager(),
  } as Arc3DContext)
}

function expectInvalidArgument(run: () => unknown): void {
  try {
    run()
    throw new Error("expected an INVALID_ARGUMENT error")
  } catch (error) {
    expect(error).toMatchObject({ code: "INVALID_ARGUMENT" })
  }
}

const mercatorPit = [
  { longitude: 120, latitude: 30 },
  { longitude: 120.02, latitude: 30 },
  { longitude: 120.02, latitude: 30.02 },
  { longitude: 120, latitude: 30.02 },
]

describe("cut fill known answers", () => {
  it("converges to the local-planar rectangle area as samples increase", () => {
    const width =
      (120.02 - 120) *
      (Math.PI / 180) *
      WGS84_A *
      Math.cos((30 * Math.PI) / 180)
    const height = (30.02 - 30) * (Math.PI / 180) * WGS84_A
    const analyticArea = width * height

    let previousError = Number.POSITIVE_INFINITY
    for (const samples of [4, 8, 16, 32, 64]) {
      const grid = buildCutFillGrid(mercatorPit, samples)
      const area = grid.cells.reduce(
        (sum, cell) => sum + cell.areaSquareMeters,
        0,
      )
      const relativeError = Math.abs(analyticArea - area) / analyticArea
      expect(relativeError).toBeLessThan(previousError)
      if (samples >= 32) expect(relativeError).toBeLessThan(0.05)
      previousError = relativeError
    }
  })

  it("computes an exact constant-depth prism volume on full cells", () => {
    const cells: CutFillCell[] = [
      {
        longitude: 0,
        latitude: 0,
        coverage: 1,
        areaSquareMeters: 100,
      },
      {
        longitude: 0,
        latitude: 0,
        coverage: 1,
        areaSquareMeters: 50,
      },
    ]
    expect(
      accumulateCutFillWeighted(
        cells.map((cell) => ({ delta: 2, area: cell.areaSquareMeters })),
      ),
    ).toEqual({ cut: 300, fill: 0 })
    expect(
      accumulateCutFillWeighted(
        cells.map((cell) => ({ delta: -2, area: cell.areaSquareMeters })),
      ),
    ).toEqual({ cut: 0, fill: 300 })
    expect(
      accumulateCutFillWeighted([
        { delta: 3, area: 10 },
        { delta: -4, area: 5 },
      ]),
    ).toEqual({ cut: 30, fill: 20 })
  })

  it("matches the documented empirical coverage error formula", () => {
    const cells: CutFillCell[] = [
      { longitude: 0, latitude: 0, coverage: 1, areaSquareMeters: 100 },
      { longitude: 0, latitude: 0, coverage: 0.5, areaSquareMeters: 80 },
      { longitude: 0, latitude: 0, coverage: 0.25, areaSquareMeters: 40 },
    ]
    expect(estimateCutFillError(cells, [10, -2, 5])).toBeCloseTo(
      0.5 * 80 * 2 + 0.5 * 40 * 5,
      12,
    )
  })

  it("keeps zero-depth and negative-depth signs consistent", () => {
    expect(
      accumulateCutFillWeighted([
        { delta: 0, area: 100 },
        { delta: 0, area: 50 },
      ]),
    ).toEqual({ cut: 0, fill: 0 })
    expect(accumulateCutFillWeighted([{ delta: -0.5, area: 4 }])).toEqual({
      cut: 0,
      fill: 2,
    })
  })
})

describe("terrain sample semantics", () => {
  it("distinguishes a real zero elevation from missing terrain", () => {
    expect(
      resolveTerrainSample({
        sampleHeightSupported: false,
        globeHeight: 0,
      }),
    ).toEqual({ height: 0, source: "globe", status: "sampled" })
    expect(
      resolveTerrainSample({
        sampleHeightSupported: false,
        globeHeight: null,
      }),
    ).toEqual({ height: 0, source: "ellipsoid", status: "unavailable" })
  })

  it("marks a detailed-sample failure with a globe fallback as fallback", () => {
    expect(
      resolveTerrainSample({
        sampleHeightSupported: true,
        detailedHeight: Number.NaN,
        globeHeight: 12,
      }),
    ).toEqual({ height: 12, source: "globe", status: "fallback" })
  })
})

describe("numeric extremes", () => {
  it("returns finite zero for collinear and too-few rings", () => {
    expect(
      polygonAreaSquareMeters([
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
        { longitude: 2, latitude: 0 },
      ]),
    ).toBe(0)
    expect(polygonAreaSquareMeters([])).toBe(0)
  })

  it("keeps tiny and global-scale areas finite and non-negative", () => {
    const tiny = polygonAreaSquareMeters(
      [
        { longitude: 0, latitude: 0 },
        { longitude: 1e-6, latitude: 0 },
        { longitude: 0, latitude: 1e-6 },
      ],
      [],
      "planar",
    )
    expect(Number.isFinite(tiny)).toBe(true)
    expect(tiny).toBeGreaterThan(0)

    const global = polygonAreaSquareMeters([
      { longitude: -179, latitude: -89 },
      { longitude: 179, latitude: -89 },
      { longitude: 179, latitude: 89 },
      { longitude: -179, latitude: 89 },
    ])
    expect(Number.isFinite(global)).toBe(true)
    expect(global).toBeGreaterThan(0)
  })

  it("rejects NaN, infinity and out-of-range coordinates", () => {
    expectInvalidArgument(() =>
      geodesicDistanceMeters(
        { longitude: Number.NaN, latitude: 0 },
        { longitude: 0, latitude: 0 },
      ),
    )
    expectInvalidArgument(() =>
      polygonAreaSquareMeters([
        { longitude: 0, latitude: 0 },
        { longitude: Number.POSITIVE_INFINITY, latitude: 0 },
        { longitude: 0, latitude: 1 },
      ]),
    )
    expectInvalidArgument(() =>
      splitRectAtAntimeridian({
        west: 0,
        south: 10,
        east: 1,
        north: 0,
      }),
    )
    expectInvalidArgument(() =>
      polygonAreaSquareMeters([
        { longitude: 0, latitude: 95 },
        { longitude: 1, latitude: 95 },
        { longitude: 1, latitude: 96 },
      ]),
    )
  })

  it("rejects excessive heights before ECEF overflow", () => {
    expectInvalidArgument(() =>
      cartesianDistanceMeters(
        { longitude: 0, latitude: 0, height: 1e12 },
        { longitude: 0, latitude: 0, height: -1e12 },
      ),
    )
    const finite = cartesianDistanceMeters(
      { longitude: 0, latitude: 0, height: 1e9 },
      { longitude: 0, latitude: 0, height: -1e9 },
    )
    expect(Number.isFinite(finite)).toBe(true)
  })

  it("rejects local offsets that leave the longitude/latitude range", () => {
    expectInvalidArgument(() =>
      fromLocalMeters({ longitude: 179, latitude: 0 }, 1e9, 0),
    )
    expectInvalidArgument(() =>
      fromLocalMeters({ longitude: 0, latitude: 89 }, 0, 1e7),
    )
  })

  it("rejects excessive measurement heights through the public service", async () => {
    await expect(
      measure().distance({
        positions: [
          [120, 30, 1e12],
          [120, 30, 0],
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" })
  })
})
