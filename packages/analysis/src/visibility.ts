import type { Arc3DContext, PositionInput } from "@arc3dlab/core"
import { getCesiumViewer, toCartesian3 } from "@arc3dlab/engine-cesium"
import {
  Cartesian3,
  Cartographic,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  GroundPrimitive,
  Math as CesiumMath,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
} from "cesium"
import { destinationLngLat, lineOfSightFromSamples, rayRangeMeters, viewshedEnvelope } from "./math"
import { sampleCartographics, toCartographic } from "./sampler"

export interface SightPoint {
  longitude: number
  latitude: number
  lineHeight: number
  terrainHeight: number
}

export interface LineOfSightResult {
  visible: boolean
  occludedIndex?: number
  samples: SightPoint[]
}

export interface ViewshedRay {
  heading: number
  visible: boolean
  occludedIndex?: number
  rangeMeters: number
}

export interface ViewshedResult {
  visibleCount: number
  rayCount: number
  rays: ViewshedRay[]
}

export class VisibilityAnalysis {
  private overlay: { remove: () => void } | undefined

  constructor(private readonly context: Arc3DContext) {}

  async lineOfSight(options: {
    from: PositionInput
    to: PositionInput
    samples?: number
  }): Promise<LineOfSightResult> {
    this.context.lifecycle.assertUsable("analyze line of sight")
    const count = Math.max(2, options.samples ?? 32)
    const start = toCartesian3(options.from)
    const end = toCartesian3(options.to)
    const cartos: Cartographic[] = []
    const lineHeights: number[] = []
    for (let i = 0; i < count; i += 1) {
      const point = Cartesian3.lerp(start, end, i / (count - 1), new Cartesian3())
      const carto = Cartographic.fromCartesian(point)
      lineHeights.push(carto.height)
      carto.height = 0
      cartos.push(carto)
    }
    const terrain = await sampleCartographics(this.context, cartos)
    const pairs = terrain.map((item, index) => ({
      lineHeight: lineHeights[index],
      terrainHeight: item.height,
    }))
    const result = lineOfSightFromSamples(pairs)
    return {
      visible: result.visible,
      occludedIndex: result.occludedIndex,
      samples: terrain.map((item, index) => ({
        longitude: CesiumMath.toDegrees(item.longitude),
        latitude: CesiumMath.toDegrees(item.latitude),
        lineHeight: pairs[index].lineHeight,
        terrainHeight: pairs[index].terrainHeight,
      })),
    }
  }

  async viewshed(options: {
    observer: PositionInput
    radius: number
    rays?: number
    observerHeight?: number
    samples?: number
    draw?: boolean
  }): Promise<ViewshedResult> {
    this.context.lifecycle.assertUsable("analyze viewshed")
    const rayCount = Math.max(1, options.rays ?? 36)
    const observerHeight = options.observerHeight ?? 2
    const sampleCount = Math.max(2, options.samples ?? 16)
    const origin = toCartographic(options.observer)
    const [sampled] = await sampleCartographics(this.context, [origin.clone()])
    const from: [number, number, number] = [
      CesiumMath.toDegrees(sampled.longitude),
      CesiumMath.toDegrees(sampled.latitude),
      sampled.height + observerHeight,
    ]
    const rays: ViewshedRay[] = []
    for (let i = 0; i < rayCount; i += 1) {
      const heading = (360 * i) / rayCount
      const dest = destinationLngLat(from[0], from[1], heading, options.radius)
      const sight = await this.lineOfSight({
        from,
        to: [dest.longitude, dest.latitude, sampled.height],
        samples: sampleCount,
      })
      rays.push({
        heading,
        visible: sight.visible,
        occludedIndex: sight.occludedIndex,
        rangeMeters: rayRangeMeters(options.radius, sampleCount, sight.occludedIndex),
      })
    }
    if (options.draw) this.drawEnvelope(from[0], from[1], rays)
    return {
      visibleCount: rays.filter((ray) => ray.visible).length,
      rayCount,
      rays,
    }
  }

  clearOverlay(): void {
    this.context.lifecycle.assertUsable("clear viewshed overlay")
    this.removeOverlay()
  }

  destroy(): void {
    this.removeOverlay()
  }

  private removeOverlay(): void {
    this.overlay?.remove()
    this.overlay = undefined
  }

  private drawEnvelope(longitude: number, latitude: number, rays: ViewshedRay[]): void {
    this.removeOverlay()
    if (rays.length < 3) return
    const ring = viewshedEnvelope(longitude, latitude, rays)
    const positions = ring.map((point) => Cartesian3.fromDegrees(point.longitude, point.latitude))
    const viewer = getCesiumViewer(this.context.engine.native.viewer)
    const primitive = new GroundPrimitive({
      geometryInstances: new GeometryInstance({
        geometry: new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(Color.fromBytes(115, 209, 61, 136)),
        },
      }),
      appearance: new PerInstanceColorAppearance({ translucent: true, flat: true }),
    })
    viewer.scene.primitives.add(primitive)
    this.overlay = {
      remove: () => {
        viewer.scene.primitives.remove(primitive)
      },
    }
  }
}
