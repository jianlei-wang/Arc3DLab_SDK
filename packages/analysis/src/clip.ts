import {
  Arc3DError,
  type Arc3DContext,
  type PositionInput,
} from "@arc3dlab/core"
import {
  getCesiumViewer,
  toCartesian3,
  toCartesian3Array,
} from "@arc3dlab/engine-cesium"
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

/**
 * Globe 上可被裁剪分析接管的槽位。
 *
 * Cesium 声明这两个属性为非可选，但底层实际可能为 `undefined`（尚未设置），
 * 因此以可选形式建模，以便在释放后把槽位恢复为 `undefined`。
 */
interface ClippingHost {
  clippingPlanes?: ClippingPlaneCollection
  clippingPolygons?: ClippingPolygonCollection
}

/** 开挖结果，描述深度、是否为体积开挖及所采用的方法。 */
export interface ExcavationResult {
  /** 开挖深度，单位为米。 */
  depth: number
  /** 是否为体积开挖。 */
  volumetric: boolean
  /** 所采用的开挖方法。 */
  method: "clipping-polygon-and-floor-plane"
}

/**
 * 裁剪分析服务，基于 Cesium 裁剪平面与裁剪多边形实现剖切与开挖。
 *
 * 该服务遵循明确的所有权规则：首次写入前捕获 Globe 上既有的裁剪集合作为
 * 基线，之后只释放自身创建的集合，`clear()` / `destroy()` 时恢复基线，因此
 * 不会清理调用者或其它子系统设置的裁剪状态。
 */
export class ClipAnalysis {
  private active: string[] = []
  private excavation: ExcavationResult | undefined
  private captured = false
  private baselinePlanes: ClippingPlaneCollection | undefined
  private baselinePolygons: ClippingPolygonCollection | undefined
  private ownedPlanes: ClippingPlaneCollection | undefined

  /**
   * 创建裁剪分析服务。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 设置基于平面的剖切。
   * @param options - 剖切选项，包含原点与可选方位角。
   */
  setPlane(options: { origin: PositionInput; heading?: number }): void {
    this.context.lifecycle.assertUsable("set clip plane")
    const heading = CesiumMath.toRadians(options.heading ?? 0)
    const origin = toCartesian3(options.origin)
    const collection = new ClippingPlaneCollection({
      modelMatrix: Transforms.eastNorthUpToFixedFrame(origin),
      planes: [
        new ClippingPlane(
          new Cartesian3(Math.sin(heading), Math.cos(heading), 0),
          0,
        ),
      ],
      enabled: true,
    })
    this.applyClip("plane", { planes: collection })
  }

  /**
   * 设置基于地理范围的盒状剖切。
   * @param options - 盒状范围，包含西、南、东、北边界。
   */
  setBox(options: {
    west: number
    south: number
    east: number
    north: number
  }): void {
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
    const collection = new ClippingPlaneCollection({
      modelMatrix: Transforms.eastNorthUpToFixedFrame(origin),
      planes: [
        new ClippingPlane(new Cartesian3(1, 0, 0), halfX),
        new ClippingPlane(new Cartesian3(-1, 0, 0), halfX),
        new ClippingPlane(new Cartesian3(0, 1, 0), halfY),
        new ClippingPlane(new Cartesian3(0, -1, 0), halfY),
      ],
      enabled: true,
    })
    this.applyClip("box", { planes: collection })
  }

  /**
   * 设置基于多边形的剖切。
   * @param options - 剖切选项，包含多边形顶点。
   * @throws {Arc3DError} 当顶点少于三个时抛出 `INVALID_ARGUMENT`，且不改变现有裁剪。
   */
  setPolygon(options: { positions: PositionInput[] }): void {
    this.context.lifecycle.assertUsable("set clip polygon")
    assertPolygon(options.positions)
    const collection = new ClippingPolygonCollection({
      polygons: [
        new ClippingPolygon({
          positions: toCartesian3Array(options.positions),
        }),
      ],
      enabled: true,
    })
    this.applyClip("polygon", { polygons: collection })
  }

  /**
   * 设置多边形与底面平面构成的开挖。
   * @param options - 开挖选项，包含多边形顶点与深度。
   * @returns 开挖结果。
   * @throws {Arc3DError} 当顶点少于三个时抛出 `INVALID_ARGUMENT`，且不改变现有裁剪。
   */
  setExcavation(options: {
    positions: PositionInput[]
    depth: number
  }): ExcavationResult {
    this.context.lifecycle.assertUsable("set excavation")
    assertPolygon(options.positions)
    const cartesians = toCartesian3Array(options.positions)
    const origin = cartesians.reduce(
      (sum, point) => Cartesian3.add(sum, point, sum),
      new Cartesian3(),
    )
    Cartesian3.multiplyByScalar(origin, 1 / cartesians.length, origin)
    const polygons = new ClippingPolygonCollection({
      polygons: [new ClippingPolygon({ positions: cartesians })],
      enabled: true,
    })
    const depth = Math.max(0, options.depth)
    const volumetric = depth > 0
    const planes = volumetric
      ? new ClippingPlaneCollection({
          modelMatrix: Transforms.eastNorthUpToFixedFrame(origin),
          planes: [new ClippingPlane(new Cartesian3(0, 0, -1), depth)],
          enabled: true,
        })
      : undefined
    this.applyClip("excavation", { planes, polygons })
    const result: ExcavationResult = {
      depth,
      volumetric,
      method: "clipping-polygon-and-floor-plane",
    }
    this.excavation = result
    return result
  }

  /**
   * 列出当前生效的裁剪类型。
   * @returns 裁剪类型名称列表。
   */
  list(): string[] {
    return [...this.active]
  }

  /** 清除当前所有裁剪效果并恢复调用前的基线状态。 */
  clear(): void {
    this.context.lifecycle.assertUsable("clear clip")
    this.resetToBaseline()
    this.active = []
    this.excavation = undefined
  }

  /** 释放裁剪服务占用的资源并恢复调用前的基线状态。 */
  destroy(): void {
    this.resetToBaseline()
    this.active = []
    this.excavation = undefined
  }

  private globe(): ClippingHost {
    return getCesiumViewer(this.context.engine.native.viewer).scene.globe
  }

  /**
   * 在首次写入裁剪槽位前记录既有的裁剪集合作为基线。
   * @param globe - 当前 Globe。
   */
  private captureBaseline(globe: ClippingHost): void {
    if (this.captured) return
    this.baselinePlanes = globe.clippingPlanes
    this.baselinePolygons = globe.clippingPolygons
    this.captured = true
  }

  /**
   * 统一挂载裁剪集合：释放上一个自有集合，写入新集合，未使用的槽位恢复基线。
   * @param name - 记录到 `list()` 的裁剪类型名称。
   * @param next - 本次要挂载的自有集合。
   */
  private applyClip(
    name: string,
    next: {
      planes?: ClippingPlaneCollection
      polygons?: ClippingPolygonCollection
    },
  ): void {
    const globe = this.globe()
    this.captureBaseline(globe)
    const previousPlanes = this.ownedPlanes
    this.ownedPlanes = undefined
    globe.clippingPlanes = next.planes ?? this.restorePlanes()
    this.ownedPlanes = next.planes
    globe.clippingPolygons = next.polygons ?? this.baselinePolygons
    this.disposeOwnedPlanes(previousPlanes)
    this.active = [name]
  }

  /**
   * 释放全部自有集合并将裁剪槽位恢复到基线。
   */
  private resetToBaseline(): void {
    if (this.captured) {
      const globe = this.globe()
      const previousPlanes = this.ownedPlanes
      this.ownedPlanes = undefined
      globe.clippingPlanes = this.restorePlanes()
      restorePolygons(globe, this.baselinePolygons)
      this.disposeOwnedPlanes(previousPlanes)
    }
    this.captured = false
    this.baselinePlanes = undefined
    this.baselinePolygons = undefined
  }

  /**
   * 计算裁剪平面槽位的恢复值。
   * @returns 可用的基线集合；基线缺失或已被销毁时返回 `undefined`。
   */
  private restorePlanes(): ClippingPlaneCollection | undefined {
    const baseline = this.baselinePlanes
    if (!baseline) return undefined
    return isDestroyed(baseline) ? undefined : baseline
  }

  /**
   * 释放自有裁剪平面集合。
   *
   * 仍挂载在 Globe 槽位上的集合由 Cesium 的槽位替换语义释放；此处只释放已经
   * 脱挂、但仍被本服务持有的自有集合，避免重复销毁。
   *
   * @param collection - 上一个自有集合。
   */
  private disposeOwnedPlanes(
    collection: ClippingPlaneCollection | undefined,
  ): void {
    if (!collection || isDestroyed(collection)) return
    collection.destroy?.()
  }
}

/**
 * 校验裁剪多边形顶点数量。
 * @param positions - 多边形顶点。
 * @throws {Arc3DError} 当顶点少于三个时抛出 `INVALID_ARGUMENT`。
 */
function assertPolygon(positions: PositionInput[]): void {
  if (positions.length < 3) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      "Clip polygon requires at least 3 positions",
    )
  }
}

/**
 * 判断裁剪平面集合是否已被销毁。
 * @param collection - 待判断的集合。
 * @returns 集合已销毁时返回 true。
 */
function isDestroyed(collection: ClippingPlaneCollection): boolean {
  const fn = (collection as { isDestroyed?: () => boolean }).isDestroyed
  return typeof fn === "function" && fn.call(collection)
}

/**
 * 将多边形槽位恢复到基线。
 *
 * Cesium 的 `ClippingPolygonCollection` 槽位替换语义会脱挂旧集合但保留其
 * `_owner`，在调试构建下重新挂载旧基线可能触发所有权校验异常，因此恢复失败时
 * 回退为清空槽位，保证清理流程不阻断。
 *
 * @param globe - 当前 Globe。
 * @param baseline - 首次写入前捕获的多边形集合。
 */
function restorePolygons(
  globe: ClippingHost,
  baseline: ClippingPolygonCollection | undefined,
): void {
  try {
    globe.clippingPolygons = baseline
  } catch {
    globe.clippingPolygons = undefined
  }
}
