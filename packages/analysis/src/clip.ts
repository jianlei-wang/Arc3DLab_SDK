import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3, toCartesian3Array } from "@arc3dlab/engine-cesium"
import {
  Cartesian3,
  Cartographic,
  ClippingPlane,
  ClippingPlaneCollection,
  ClippingPolygon,
  ClippingPolygonCollection,
  EllipsoidGeodesic,
  Math as CesiumMath,
  Transforms,
} from "cesium"

export interface ExcavationResult {
  depth: number
  volumetric: boolean
  method: "clipping-polygon-and-floor-plane"
}

export class ClipAnalysis {
  private active: string[] = []
  private excavation: ExcavationResult | undefined

  constructor(private readonly context: Arc3DContext) {}

  setPlane(options: { origin: PositionInput; heading?: number }): void {
    this.context.lifecycle.assertUsable("set clip plane")
    const heading = CesiumMath.toRadians(options.heading ?? 0)
    const origin = toCartesian3(options.origin)
    this.applyPlanes(
      "plane",
      new ClippingPlaneCollection({
        modelMatrix: Transforms.eastNorthUpToFixedFrame(origin),
        planes: [new ClippingPlane(new Cartesian3(Math.sin(heading), Math.cos(heading), 0), 0)],
        enabled: true,
      })
    )
  }

  setBox(options: { west: number; south: number; east: number; north: number }): void {
    this.context.lifecycle.assertUsable("set clip box")
    const centerLon = (options.west + options.east) / 2
    const centerLat = (options.south + options.north) / 2
    const origin = Cartesian3.fromDegrees(centerLon, centerLat)
    const west = Cartographic.fromDegrees(options.west, centerLat)
    const east = Cartographic.fromDegrees(options.east, centerLat)
    const south = Cartographic.fromDegrees(centerLon, options.south)
    const north = Cartographic.fromDegrees(centerLon, options.north)
    const halfX = new EllipsoidGeodesic(west, east).surfaceDistance / 2
    const halfY = new EllipsoidGeodesic(south, north).surfaceDistance / 2
    this.applyPlanes(
      "box",
      new ClippingPlaneCollection({
        modelMatrix: Transforms.eastNorthUpToFixedFrame(origin),
        planes: [
          new ClippingPlane(new Cartesian3(1, 0, 0), halfX),
          new ClippingPlane(new Cartesian3(-1, 0, 0), halfX),
          new ClippingPlane(new Cartesian3(0, 1, 0), halfY),
          new ClippingPlane(new Cartesian3(0, -1, 0), halfY),
        ],
        enabled: true,
      })
    )
  }

  setPolygon(options: { positions: PositionInput[] }): void {
    this.context.lifecycle.assertUsable("set clip polygon")
    this.clearPlanes()
    const globe = getCesiumViewer(this.context.engine.native.viewer).scene.globe
    globe.clippingPolygons = new ClippingPolygonCollection({
      polygons: [new ClippingPolygon({ positions: toCartesian3Array(options.positions) })],
      enabled: true,
    })
    this.active = ["polygon"]
  }

  setExcavation(options: { positions: PositionInput[]; depth: number }): ExcavationResult {
    this.context.lifecycle.assertUsable("set excavation")
    const cartesians = toCartesian3Array(options.positions)
    if (cartesians.length < 3) {
      const empty: ExcavationResult = {
        depth: Math.max(0, options.depth),
        volumetric: false,
        method: "clipping-polygon-and-floor-plane",
      }
      this.excavation = empty
      this.active = []
      return empty
    }
    const origin = cartesians.reduce((sum, point) => Cartesian3.add(sum, point, sum), new Cartesian3())
    Cartesian3.multiplyByScalar(origin, 1 / cartesians.length, origin)
    const globe = getCesiumViewer(this.context.engine.native.viewer).scene.globe
    globe.clippingPolygons = new ClippingPolygonCollection({
      polygons: [new ClippingPolygon({ positions: cartesians })],
      enabled: true,
    })
    const depth = Math.max(0, options.depth)
    const volumetric = depth > 0
    if (volumetric) {
      globe.clippingPlanes?.destroy?.()
      globe.clippingPlanes = new ClippingPlaneCollection({
        modelMatrix: Transforms.eastNorthUpToFixedFrame(origin),
        planes: [new ClippingPlane(new Cartesian3(0, 0, -1), depth)],
        enabled: true,
      })
    } else {
      this.clearPlanes()
    }
    const result: ExcavationResult = {
      depth,
      volumetric,
      method: "clipping-polygon-and-floor-plane",
    }
    this.excavation = result
    this.active = ["excavation"]
    return result
  }

  list(): string[] {
    return [...this.active]
  }

  clear(): void {
    this.context.lifecycle.assertUsable("clear clip")
    this.removeAll()
  }

  destroy(): void {
    this.removeAll()
  }

  private applyPlanes(name: string, collection: ClippingPlaneCollection): void {
    this.clearPolygons()
    const globe = getCesiumViewer(this.context.engine.native.viewer).scene.globe
    globe.clippingPlanes?.destroy?.()
    globe.clippingPlanes = collection
    this.active = [name]
  }

  private clearPlanes(): void {
    const globe = getCesiumViewer(this.context.engine.native.viewer).scene.globe
    globe.clippingPlanes?.removeAll?.()
    globe.clippingPlanes?.destroy?.()
    globe.clippingPlanes = new ClippingPlaneCollection({ enabled: false })
  }

  private clearPolygons(): void {
    const globe = getCesiumViewer(this.context.engine.native.viewer).scene.globe
    globe.clippingPolygons?.removeAll?.()
    globe.clippingPolygons = new ClippingPolygonCollection({ enabled: false })
  }

  private removeAll(): void {
    this.clearPlanes()
    this.clearPolygons()
    this.active = []
    this.excavation = undefined
  }
}
