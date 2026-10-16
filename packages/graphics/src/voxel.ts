import {
  createId,
  type Arc3DContext,
  type ResourceHandle,
} from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import {
  Cartesian3,
  Color,
  CustomShader,
  Matrix4,
  MetadataComponentType,
  MetadataType,
  PointPrimitiveCollection,
  Transforms,
  VoxelContent,
  VoxelPrimitive,
  VoxelShapeType,
  type Viewer,
} from "cesium"

/** 体素点数据，坐标为经纬度与高程，`value` 为标量值；`value` 为 `NaN` 表示缺失。 */
export interface VoxelPoint {
  /** WGS84 经度（度）。 */
  x: number
  /** WGS84 纬度（度）。 */
  y: number
  /** 相对 WGS84 椭球面的高程（米）。 */
  z: number
  /** 标量值；`NaN` 表示缺失。 */
  value: number
}

/** 体素插值方法。 */
export type VoxelInterpolationMethod = "idw" | "nearest"

/** 体素创建选项。 */
export interface VoxelOptions {
  /** 每个维度的体元数量，默认为 15。 */
  dimensions?: number
  /** 颜色刻度列表（CSS 颜色字符串），高值映射到列表首项。 */
  colorsList?: string[]
  /** 插值方法，默认为 `idw`。 */
  method?: VoxelInterpolationMethod
  /** IDW 权重幂次，默认为 2。 */
  power?: number
  /** 各维度按米扩展体素盒范围，默认为 0。 */
  padding?: number
}

/** 体素数据请求选项。 */
export interface VoxelTileRequest {
  /** 瓦片层级。 */
  tileLevel: number
  /** 瓦片 X 索引。 */
  tileX: number
  /** 瓦片 Y 索引。 */
  tileY: number
  /** 瓦片 Z 索引。 */
  tileZ: number
}

const DEFAULT_COLORS = [
  "#ff0000",
  "#ff5100",
  "#ff7700",
  "#fe9600",
  "#fbb200",
  "#efbf00",
  "#e2cc00",
  "#d2d900",
  "#b5dc00",
  "#94de00",
  "#69df00",
  "#0de01f",
]

/** 纬度每度对应的米数。 */
const METERS_PER_DEGREE_LATITUDE = 110540
/** 赤道处经度每度对应的米数，其余纬度按 `cos(latitude)` 折算。 */
const METERS_PER_DEGREE_LONGITUDE = 111320
/** 零跨度维度的最小跨度（米），保证体素盒非退化。 */
const MIN_AXIS_SPAN = 1
/** 默认的 IDW 权重幂次。 */
const DEFAULT_POWER = 2
/** 判定查询点与输入点重合的距离阈值（米）。 */
const DISTANCE_EPSILON = 1e-9

const VOXEL_SHADER_TEXT = `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    material.diffuse = fsInput.metadata.color.rgb;
    float transparency = 1.0 - fsInput.metadata.color.a;
    float thickness = fsInput.voxel.travelDistance * 16.0;
    material.alpha = 1.0 - pow(transparency, thickness);
}`

/**
 * 多瓦片体素对象，将离散点数据插值为体素盒并按数值着色。
 *
 * 该对象实现 {@link ResourceHandle} 合同：由 `GraphicManager.addVoxel` 创建时登记进
 * 共享资源注册表，`destroy()` 幂等，可经自身或应用级销毁释放图元与点集合资源。
 */
export class MultiTileVoxel implements ResourceHandle<
  VoxelPrimitive | PointPrimitiveCollection | undefined
> {
  /** 资源唯一标识。 */
  readonly id: string = createId("voxel")
  /** 资源类型。 */
  readonly type = "voxel"
  /** 资源是否由本 SDK 持有并负责销毁。 */
  readonly owned = true
  /** 体素点数据。 */
  readonly pointData: VoxelPoint[]
  /** 各维度的体元数量。 */
  readonly dimensions: number
  /** 颜色刻度。 */
  readonly colorsList: string[]
  /** 插值方法。 */
  readonly method: VoxelInterpolationMethod
  /** IDW 权重幂次。 */
  readonly power: number
  /** 各维度按米扩展的范围。 */
  readonly padding: number
  private readonly validPoints: VoxelPoint[]
  private readonly minValue: number
  private readonly maxValue: number
  private readonly centerLon: number
  private readonly centerLat: number
  private readonly centerZ: number
  private readonly spanX: number
  private readonly spanY: number
  private readonly spanZ: number
  private readonly metersPerDegLon: number
  private readonly metersPerDegLat: number
  private readonly viewer: Viewer | undefined
  private primitive: VoxelPrimitive | undefined
  private pointCollection: PointPrimitiveCollection | undefined

  /**
   * 创建体素对象。
   * @param context - Arc3D 运行时上下文。
   * @param pointData - 体素点数据。
   * @param options - 体素配置。
   */
  constructor(
    context: Arc3DContext,
    pointData: VoxelPoint[],
    options: VoxelOptions = {},
  ) {
    this.pointData = pointData
    this.dimensions = Math.max(1, Math.floor(options.dimensions ?? 15))
    this.colorsList =
      options.colorsList && options.colorsList.length > 0
        ? options.colorsList
        : DEFAULT_COLORS
    this.method = options.method === "nearest" ? "nearest" : "idw"
    this.power =
      options.power !== undefined && options.power > 0
        ? options.power
        : DEFAULT_POWER
    this.padding =
      options.padding !== undefined && options.padding > 0 ? options.padding : 0
    this.validPoints = pointData.filter((point) => Number.isFinite(point.value))
    const values = this.validPoints.map((point) => point.value)
    this.minValue = values.length > 0 ? Math.min(...values) : 0
    this.maxValue = values.length > 0 ? Math.max(...values) : 1

    const bounds = this.computeBounds()
    this.centerLon = bounds.centerLon
    this.centerLat = bounds.centerLat
    this.centerZ = bounds.centerZ
    this.metersPerDegLat = METERS_PER_DEGREE_LATITUDE
    this.metersPerDegLon = Math.max(
      METERS_PER_DEGREE_LONGITUDE *
        Math.max(Math.cos((this.centerLat * Math.PI) / 180), 1e-6),
      1e-6,
    )
    this.spanX = Math.max(
      bounds.spanLon * this.metersPerDegLon + 2 * this.padding,
      MIN_AXIS_SPAN,
    )
    this.spanY = Math.max(
      bounds.spanLat * this.metersPerDegLat + 2 * this.padding,
      MIN_AXIS_SPAN,
    )
    this.spanZ = Math.max(bounds.spanZ + 2 * this.padding, MIN_AXIS_SPAN)

    this.viewer = getCesiumViewer(context.engine.native.viewer) as
      Viewer | undefined
    this.buildPrimitive()
  }

  /**
   * 在离散点之间按配置方法插值，返回查询位置的标量值。
   *
   * `x` / `y` / `z` 与 `VoxelPoint` 使用相同坐标系统（经度、纬度、高程）。
   * @param x - 查询点经度（度）。
   * @param y - 查询点纬度（度）。
   * @param z - 查询点高程（米）。
   * @returns 插值得到的标量值；无有效输入点时返回 `NaN`。
   */
  interpolate(x: number, y: number, z: number): number {
    return this.sampleAt(x, y, z)
  }

  /**
   * 异步请求体素瓦片数据。
   * @param options - 瓦片索引。
   * @returns 以 RGBA 浮点数组形式返回的体素数据。
   */
  requestData(options: VoxelTileRequest): Promise<Float32Array[]> | undefined {
    if (options.tileLevel > 0) return undefined
    const dimensions = this.dimensions
    const channelCount = 4
    const nodeCount = dimensions ** 3
    const samples = new Float32Array(nodeCount)
    let sampleMin = Number.POSITIVE_INFINITY
    let sampleMax = Number.NEGATIVE_INFINITY
    let hasSample = false
    let cursor = 0
    for (let z = 0; z < dimensions; z++) {
      for (let y = 0; y < dimensions; y++) {
        for (let x = 0; x < dimensions; x++) {
          const node = this.nodeCoordinate(x, y, z)
          const sample = this.sampleAt(node.lon, node.lat, node.height)
          samples[cursor++] = sample
          if (Number.isFinite(sample)) {
            sampleMin = Math.min(sampleMin, sample)
            sampleMax = Math.max(sampleMax, sample)
            hasSample = true
          }
        }
      }
    }
    const data = new Float32Array(nodeCount * channelCount)
    cursor = 0
    for (let i = 0; i < nodeCount; i++) {
      const sample = samples[i]!
      if (Number.isFinite(sample)) {
        const color = this.colorForValue(
          sample,
          hasSample ? sampleMin : 0,
          hasSample ? sampleMax : 1,
        )
        data[cursor++] = color.red
        data[cursor++] = color.green
        data[cursor++] = color.blue
        data[cursor++] = 1
      } else {
        data[cursor++] = 0
        data[cursor++] = 0
        data[cursor++] = 0
        data[cursor++] = 0
      }
    }
    return Promise.resolve([data])
  }

  /**
   * 显示或隐藏原始点数据。
   * @param visible - 是否显示。
   */
  showPoints(visible: boolean): void {
    if (!this.viewer?.scene) return
    if (visible && !this.pointCollection) {
      const collection = new PointPrimitiveCollection()
      for (const point of this.pointData) {
        if (!Number.isFinite(point.value)) continue
        collection.add({
          position: Cartesian3.fromDegrees(point.x, point.y, point.z),
          color: this.colorForValue(point.value, this.minValue, this.maxValue),
        })
      }
      this.pointCollection = this.viewer.scene.primitives.add(
        collection,
      ) as unknown as PointPrimitiveCollection
    }
    if (this.pointCollection) this.pointCollection.show = visible
  }

  /**
   * 底层原生对象，优先返回体素图元，其次返回点集合。
   */
  get native(): VoxelPrimitive | PointPrimitiveCollection | undefined {
    return this.primitive ?? this.pointCollection
  }

  /**
   * 体素与点集合的可见性。
   */
  get visible(): boolean {
    return this.primitive?.show ?? this.pointCollection?.show ?? false
  }

  set visible(value: boolean) {
    if (this.primitive) this.primitive.show = value
    if (this.pointCollection) this.pointCollection.show = value
  }

  /**
   * 销毁体素对象并释放图元、点集合与着色器资源。
   */
  destroy(): void {
    const scene = this.viewer?.scene
    if (this.pointCollection) {
      scene?.primitives?.remove(this.pointCollection)
      this.pointCollection = undefined
    }
    if (this.primitive) {
      scene?.primitives?.remove(this.primitive)
      this.primitive = undefined
    }
  }

  /**
   * 计算有效点边界与体素盒中心、地理跨度。
   * @returns 盒中心坐标与经度、纬度、高程跨度；无有效点时全部为零。
   */
  private computeBounds(): {
    centerLon: number
    centerLat: number
    centerZ: number
    spanLon: number
    spanLat: number
    spanZ: number
  } {
    if (this.validPoints.length === 0) {
      return {
        centerLon: 0,
        centerLat: 0,
        centerZ: 0,
        spanLon: 0,
        spanLat: 0,
        spanZ: 0,
      }
    }
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let minZ = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let maxZ = Number.NEGATIVE_INFINITY
    for (const point of this.validPoints) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      minZ = Math.min(minZ, point.z)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
      maxZ = Math.max(maxZ, point.z)
    }
    return {
      centerLon: (minX + maxX) / 2,
      centerLat: (minY + maxY) / 2,
      centerZ: (minZ + maxZ) / 2,
      spanLon: maxX - minX,
      spanLat: maxY - minY,
      spanZ: maxZ - minZ,
    }
  }

  /**
   * 将网格节点索引映射为采样地理坐标。
   * @param xIndex - 经度方向节点索引。
   * @param yIndex - 纬度方向节点索引。
   * @param zIndex - 高程方向节点索引。
   * @returns 节点经纬度与高程。
   */
  private nodeCoordinate(
    xIndex: number,
    yIndex: number,
    zIndex: number,
  ): { lon: number; lat: number; height: number } {
    const east = (this.axisRatio(xIndex) - 0.5) * this.spanX
    const north = (this.axisRatio(yIndex) - 0.5) * this.spanY
    const up = (this.axisRatio(zIndex) - 0.5) * this.spanZ
    return {
      lon: this.centerLon + east / this.metersPerDegLon,
      lat: this.centerLat + north / this.metersPerDegLat,
      height: this.centerZ + up,
    }
  }

  private axisRatio(index: number): number {
    return this.dimensions === 1 ? 0 : index / (this.dimensions - 1)
  }

  /**
   * 在 ENU 米制距离下按配置方法对查询点插值。
   * @param lon - 查询点经度。
   * @param lat - 查询点纬度。
   * @param height - 查询点高程。
   * @returns 插值结果；无有效输入点时返回 `NaN`。
   */
  private sampleAt(lon: number, lat: number, height: number): number {
    if (this.validPoints.length === 0) return Number.NaN
    if (this.method === "nearest") {
      let nearestDistance = Number.POSITIVE_INFINITY
      let nearestValue = Number.NaN
      for (const point of this.validPoints) {
        const distance = this.distanceMeters(point, lon, lat, height)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestValue = point.value
        }
      }
      return nearestValue
    }
    let weightedSum = 0
    let weightTotal = 0
    for (const point of this.validPoints) {
      const distance = this.distanceMeters(point, lon, lat, height)
      if (distance < DISTANCE_EPSILON) return point.value
      const weight = 1 / distance ** this.power
      weightedSum += weight * point.value
      weightTotal += weight
    }
    return weightTotal === 0 ? Number.NaN : weightedSum / weightTotal
  }

  private distanceMeters(
    point: VoxelPoint,
    lon: number,
    lat: number,
    height: number,
  ): number {
    const dx = (lon - point.x) * this.metersPerDegLon
    const dy = (lat - point.y) * this.metersPerDegLat
    const dz = height - point.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  private buildPrimitive(): void {
    const scene = this.viewer?.scene
    if (!scene) return
    if (this.validPoints.length === 0) return
    const center = Cartesian3.fromDegrees(
      this.centerLon,
      this.centerLat,
      this.centerZ,
    )
    const modelMatrix = Transforms.eastNorthUpToFixedFrame(center)
    const scale = new Cartesian3(this.spanX / 2, this.spanY / 2, this.spanZ / 2)
    Matrix4Scale(modelMatrix, scale)
    const shader = new CustomShader({ fragmentShaderText: VOXEL_SHADER_TEXT })
    this.primitive = scene.primitives.add(
      new VoxelPrimitive({
        provider: new GridVoxelProvider(this),
        customShader: shader,
        modelMatrix,
      }),
    ) as unknown as VoxelPrimitive
  }

  private colorForValue(value: number, min: number, max: number): Color {
    const clamped = Math.min(Math.max(value, min), max)
    const ratio = max === min ? 0 : 1 - (clamped - min) / (max - min)
    let index = Math.floor(ratio * this.colorsList.length)
    if (!this.colorsList[index]) index = this.colorsList.length - 1
    return Color.fromCssColorString(this.colorsList[index]!) ?? Color.WHITE
  }
}

function Matrix4Scale(matrix: unknown, scale: Cartesian3): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = matrix as any
  const x = scale.x
  const y = scale.y
  const z = scale.z
  for (let i = 0; i < 4; i++) {
    m[i] *= x
    m[4 + i] *= y
    m[8 + i] *= z
  }
}

/**
 * 体素数据提供程序，向 Cesium 提供体素维度与插值后的颜色数据。
 */
class GridVoxelProvider {
  readonly globalTransform = Matrix4.IDENTITY
  readonly shapeTransform = Matrix4.IDENTITY
  readonly shape = VoxelShapeType.BOX
  readonly minBounds = undefined
  readonly maxBounds = undefined
  readonly dimensions: Cartesian3
  readonly paddingBefore = new Cartesian3(1, 1, 1)
  readonly paddingAfter = new Cartesian3(1, 1, 1)
  readonly names = ["color"]
  readonly types = [MetadataType.VEC4]
  readonly componentTypes = [MetadataComponentType.FLOAT32]
  readonly levelCount = 1
  readonly minimumValues = undefined
  readonly maximumValues = undefined
  readonly maximumTileCount = undefined
  readonly availableLevels = undefined

  /**
   * 创建体素数据提供程序。
   * @param voxel - 所属体素对象。
   */
  constructor(private readonly voxel: MultiTileVoxel) {
    const d = voxel.dimensions
    this.dimensions = new Cartesian3(d, d, d)
  }

  /**
   * 请求指定瓦片的数据。
   * @param options - 瓦片索引。
   * @returns 体素内容，或在无法调度时返回 undefined。
   */
  requestData(options?: VoxelTileRequest): Promise<VoxelContent> | undefined {
    if (!options) return undefined
    const pending = this.voxel.requestData(options)
    if (!pending) return undefined
    return pending.then((arrays) => VoxelContent.fromMetadataArray(arrays))
  }
}
