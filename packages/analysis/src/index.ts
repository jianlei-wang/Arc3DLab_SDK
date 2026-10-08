import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { toCartesian3Array } from "@arc3dlab/engine-cesium"
import { Cartesian3 } from "cesium"

export class MeasurementService {
  constructor(private readonly context: Arc3DContext) {}

  async distance(options: { positions: PositionInput[] }): Promise<{ meters: number }> {
    this.context.lifecycle.assertUsable("measure distance")
    const points = toCartesian3Array(options.positions)
    let meters = 0
    for (let i = 1; i < points.length; i += 1) {
      meters += Cartesian3.distance(points[i - 1], points[i])
    }
    return { meters }
  }

  async area(options: { positions: PositionInput[] }): Promise<{ squareMeters: number }> {
    this.context.lifecycle.assertUsable("measure area")
    const points = toCartesian3Array(options.positions)
    if (points.length < 3) return { squareMeters: 0 }
    let area = 0
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      area += Cartesian3.cross(a, b, new Cartesian3()).x
    }
    return { squareMeters: Math.abs(area) / 2 }
  }
}

export class AnalysisManager {
  readonly measure: MeasurementService

  constructor(context: Arc3DContext) {
    this.measure = new MeasurementService(context)
  }
}
